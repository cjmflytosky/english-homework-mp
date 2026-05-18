import { HomeworkItem, HomeworkType, SubmissionItem } from '../../api/types';
import {
  start as startRecord,
  stop as stopRecord,
  getMaxDurationMs,
} from '../../utils/recorder';
import { uploadFile } from '../../utils/upload';
import {
  uploadSubmissionItem,
  getMySubmission,
} from '../../api/submission';

type Phase = 'idle' | 'recording' | 'uploading' | 'scoring' | 'done' | 'error';

interface TaskContentData {
  item: HomeworkItem | null;
  typeLabel: string;
  totalCount: number;
  currentIndex: number;
  hasPrev: boolean;
  hasNext: boolean;

  phase: Phase;
  elapsedSec: number;
  maxSec: number;

  score: SubmissionItem | null;
  errorMsg: string;
  scoredCount: number; // 已完成题数（用于「整体提交」按钮）
}

interface PageState {
  assignmentId: string;
  items: HomeworkItem[];
  type: HomeworkType;
  audioCtx: WechatMiniprogram.InnerAudioContext | null;
  scoredMap: Record<string, SubmissionItem>;
}

Page<TaskContentData, PageState>({
  data: {
    item: null,
    typeLabel: '',
    totalCount: 0,
    currentIndex: 0,
    hasPrev: false,
    hasNext: false,

    phase: 'idle',
    elapsedSec: 0,
    maxSec: Math.floor(getMaxDurationMs() / 1000),

    score: null,
    errorMsg: '',
    scoredCount: 0,
  },

  assignmentId: '',
  items: [],
  type: 'REPEAT',
  audioCtx: null,
  scoredMap: {},

  onLoad(query: Record<string, string | undefined>) {
    const items = (wx.getStorageSync('current_task_items') as HomeworkItem[]) || [];
    const meta = (wx.getStorageSync('current_task_meta') as {
      assignmentId: string;
      homeworkTitle: string;
      type: HomeworkType;
    }) || { assignmentId: '', homeworkTitle: '任务详情', type: 'REPEAT' };

    if (items.length === 0 || !meta.assignmentId) {
      wx.showToast({ title: '请从作业详情进入', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.items = items;
    this.type = meta.type;
    this.assignmentId = meta.assignmentId;

    void this.preloadScored();

    const idx = Math.max(0, Math.min(Number(query.idx ?? 0), items.length - 1));
    this.renderAt(idx);
  },

  async preloadScored() {
    try {
      const sub = await getMySubmission(this.assignmentId);
      if (!sub) return;
      const map: Record<string, SubmissionItem> = {};
      sub.items.forEach((it) => { map[it.homeworkItemId] = it; });
      this.scoredMap = map;
      this.setData({ scoredCount: Object.keys(map).length });
      this.refreshScoreOfCurrent();
    } catch (err) {
      console.warn('[task-content] preload submission failed', err);
    }
  },

  refreshScoreOfCurrent() {
    const cur = this.data.item;
    if (!cur) return;
    this.setData({ score: this.scoredMap[cur.id] ?? null });
  },

  onUnload() {
    this.audioCtx?.stop();
    this.audioCtx?.destroy?.();
    this.audioCtx = null;
  },

  renderAt(idx: number) {
    const item = this.items[idx];
    this.setData({
      item,
      typeLabel: this.type === 'REPEAT' ? '跟读' : '背诵',
      totalCount: this.items.length,
      currentIndex: idx,
      hasPrev: idx > 0,
      hasNext: idx < this.items.length - 1,
      phase: 'idle',
      elapsedSec: 0,
      score: this.scoredMap[item.id] ?? null,
      errorMsg: '',
    });
  },

  // ------------------------- 范读 -------------------------
  onPlayRef() {
    const item = this.data.item;
    if (!item?.refAudioUrl) {
      wx.showToast({ title: '暂无参考音频', icon: 'none' });
      return;
    }
    if (!this.audioCtx) this.audioCtx = wx.createInnerAudioContext();
    this.audioCtx.src = item.refAudioUrl;
    this.audioCtx.play();
  },

  // ------------------------- 录音 -------------------------
  async onToggleRecord() {
    const phase = this.data.phase;
    if (phase === 'recording') {
      await this.handleStop();
    } else if (phase === 'idle' || phase === 'done' || phase === 'error') {
      await this.handleStart();
    }
    // uploading / scoring 期间不响应
  },

  async handleStart() {
    try {
      const auth = await new Promise<boolean>((resolve) => {
        wx.getSetting({
          success: (r: any) => {
            if (r.authSetting['scope.record'] === false) {
              wx.showModal({
                title: '需要麦克风权限',
                content: '请到设置中开启麦克风权限',
                confirmText: '去设置',
                success: (m: any) => {
                  if (m.confirm) wx.openSetting({ complete: () => resolve(false) });
                  else resolve(false);
                },
              });
            } else resolve(true);
          },
          fail: () => resolve(true),
        });
      });
      if (!auth) return;

      this.setData({ phase: 'recording', elapsedSec: 0, errorMsg: '', score: null });
      await startRecord((ms) => {
        this.setData({ elapsedSec: Math.floor(ms / 1000) });
      });
    } catch (err) {
      this.setData({
        phase: 'error',
        errorMsg: err instanceof Error ? err.message : '录音失败',
      });
    }
  },

  async handleStop() {
    const item = this.data.item;
    if (!item) return;
    try {
      const rec = await stopRecord();
      this.setData({ phase: 'uploading' });
      const upload = await uploadFile(rec.tempFilePath);
      this.setData({ phase: 'scoring' });
      const { item: scored } = await uploadSubmissionItem({
        assignmentId: this.assignmentId,
        homeworkItemId: item.id,
        audioUrl: upload.url,
        duration: Math.round(rec.duration / 1000),
      });
      this.scoredMap[item.id] = scored;
      this.setData({
        phase: 'done',
        score: scored,
        scoredCount: Object.keys(this.scoredMap).length,
      });
    } catch (err) {
      this.setData({
        phase: 'error',
        errorMsg: err instanceof Error ? err.message : '提交失败',
      });
    }
  },

  // ------------------------- 翻题 / 完成 -------------------------
  goPrev() { if (this.data.hasPrev) this.renderAt(this.data.currentIndex - 1); },
  goNext() { if (this.data.hasNext) this.renderAt(this.data.currentIndex + 1); },

  goFinalize() {
    if (this.data.scoredCount < this.items.length) {
      wx.showToast({ title: '还有题目未完成', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: `/pages/submit-result/index?id=${this.assignmentId}&action=finalize`,
    });
  },
});
