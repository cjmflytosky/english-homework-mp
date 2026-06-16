import { HomeworkItem, SubmissionItem } from '../../api/types';
import {
  start as startRecord,
  stop as stopRecord,
  isRecording,
  RecordResult,
} from '../../utils/recorder';
import { playbackLocal, uploadRecording } from '../../utils/recording-flow';
import { getMySubmission } from '../../api/submission';

const SENTENCE_MAX_MS = 60_000; // 长句录音上限 60 秒

type Phase =
  | 'idle'
  | 'recording'
  | 'stopping'
  | 'recorded'
  | 'uploading'
  | 'uploaded'
  | 'error';

interface SentenceData {
  item: HomeworkItem | null;
  totalCount: number;
  currentIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  phase: Phase;
  elapsedSec: number;
  maxSec: number;
  recordedSec: number;
  errorMsg: string;
  uploadedCount: number;
  busy: boolean;
}

interface PageState {
  assignmentId: string;
  items: HomeworkItem[];
  audioCtx: WechatMiniprogram.InnerAudioContext | null;
  playbackCtx: WechatMiniprogram.InnerAudioContext | null;
  uploadedMap: Record<string, SubmissionItem>;
  lastRecord: RecordResult | null;
}

Page<SentenceData, PageState>({
  data: {
    item: null,
    totalCount: 0,
    currentIndex: 0,
    hasPrev: false,
    hasNext: false,
    phase: 'idle',
    elapsedSec: 0,
    maxSec: Math.floor(SENTENCE_MAX_MS / 1000),
    recordedSec: 0,
    errorMsg: '',
    uploadedCount: 0,
    busy: false,
  },

  assignmentId: '',
  items: [],
  audioCtx: null,
  playbackCtx: null,
  uploadedMap: {},
  lastRecord: null,

  onLoad(query: Record<string, string | undefined>) {
    const items =
      (wx.getStorageSync('current_task_items') as HomeworkItem[]) || [];
    const meta = (wx.getStorageSync('current_task_meta') as {
      assignmentId: string;
    }) || { assignmentId: '' };

    if (items.length === 0 || !meta.assignmentId) {
      wx.showToast({ title: '请从作业详情进入', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.items = items;
    this.assignmentId = meta.assignmentId;

    void this.preloadUploaded();
    const idx = Math.max(0, Math.min(Number(query.idx ?? 0), items.length - 1));
    this.renderAt(idx);
  },

  async preloadUploaded() {
    try {
      const sub = await getMySubmission(this.assignmentId);
      if (!sub) return;
      const map: Record<string, SubmissionItem> = {};
      sub.items.forEach((it) => {
        map[it.homeworkItemId] = it;
      });
      this.uploadedMap = map;
      this.setData({ uploadedCount: Object.keys(map).length });
      const cur = this.data.item;
      if (cur && map[cur.id]) {
        this.setData({ phase: 'uploaded', recordedSec: map[cur.id].duration ?? 0 });
      }
    } catch (err) {
      console.warn('[sentence-task] preload failed', err);
    }
  },

  onUnload() {
    if (this.data.phase === 'recording') {
      void stopRecord().catch(() => undefined);
    }
    this.cleanupAudio();
  },

  cleanupAudio() {
    this.audioCtx?.stop();
    this.audioCtx?.destroy?.();
    this.audioCtx = null;
    this.playbackCtx?.stop();
    this.playbackCtx?.destroy?.();
    this.playbackCtx = null;
  },

  renderAt(idx: number) {
    this.cleanupAudio();
    this.lastRecord = null;
    const item = this.items[idx];
    const uploaded = this.uploadedMap[item.id];
    this.setData({
      item,
      totalCount: this.items.length,
      currentIndex: idx,
      hasPrev: idx > 0,
      hasNext: idx < this.items.length - 1,
      phase: uploaded ? 'uploaded' : 'idle',
      elapsedSec: 0,
      recordedSec: uploaded?.duration ?? 0,
      errorMsg: '',
      busy: false,
    });
  },

  // ---------------- 播放老师范读 ----------------
  onPlayRef() {
    const item = this.data.item;
    if (!item?.refAudioUrl) {
      wx.showToast({ title: '老师暂未上传范读', icon: 'none' });
      return;
    }
    if (!this.audioCtx) this.audioCtx = wx.createInnerAudioContext();
    this.audioCtx.src = item.refAudioUrl;
    this.audioCtx.play();
  },

  // ---------------- 录音（手动开始 / 结束，60s 自动停） ----------------
  async onStartRecord() {
    if (this.data.busy || isRecording()) return;
    const ok = await this.ensureMicAuth();
    if (!ok) return;
    await this.beginRecord();
  },

  async beginRecord() {
    try {
      this.lastRecord = null;
      this.setData({ phase: 'recording', elapsedSec: 0, errorMsg: '', busy: true });
      await startRecord(
        (ms) => {
          const sec = Math.floor(ms / 1000);
          if (sec !== this.data.elapsedSec) this.setData({ elapsedSec: sec });
        },
        SENTENCE_MAX_MS,
        (rec) => this.onRecorded(rec), // 到 60s 自动停
      );
    } catch (err) {
      this.setData({
        phase: 'error',
        busy: false,
        errorMsg: err instanceof Error ? err.message : '录音失败',
      });
    }
  },

  onStopRecord() {
    void this.handleManualStop();
  },

  async handleManualStop() {
    if (this.data.phase !== 'recording') return;
    this.setData({ phase: 'stopping' });
    try {
      const rec = await stopRecord();
      this.onRecorded(rec);
    } catch (err) {
      this.setData({
        phase: 'error',
        busy: false,
        errorMsg: err instanceof Error ? err.message : '录音结束失败',
      });
    }
  },

  /** 录音停止（手动或自动）后统一进入「已录制」 */
  onRecorded(rec: RecordResult) {
    if (this.data.phase === 'recorded' || this.data.phase === 'uploaded') return;
    this.lastRecord = rec;
    this.setData({
      phase: 'recorded',
      recordedSec: Math.round(rec.duration / 1000),
      busy: false,
    });
  },

  // ---------------- 回放 / 重录 / 上传 ----------------
  onPlayback() {
    if (!this.lastRecord) return;
    this.playbackCtx?.destroy?.();
    this.playbackCtx = playbackLocal(this.lastRecord.tempFilePath);
  },

  onReRecord() {
    if (isRecording()) return;
    void this.beginRecord();
  },

  async onUpload() {
    const item = this.data.item;
    if (!item || !this.lastRecord) return;
    this.setData({ phase: 'uploading', busy: true });
    try {
      const saved = await uploadRecording({
        assignmentId: this.assignmentId,
        homeworkItemId: item.id,
        filePath: this.lastRecord.tempFilePath,
        durationMs: this.lastRecord.duration,
      });
      this.uploadedMap[item.id] = saved;
      this.setData({
        phase: 'uploaded',
        busy: false,
        uploadedCount: Object.keys(this.uploadedMap).length,
      });
    } catch (err) {
      this.setData({
        phase: 'error',
        busy: false,
        errorMsg: err instanceof Error ? err.message : '上传失败',
      });
    }
  },

  // ---------------- 翻页 / 提交 ----------------
  goPrev() {
    if (this.data.hasPrev && !this.data.busy) this.renderAt(this.data.currentIndex - 1);
  },
  goNext() {
    if (this.data.hasNext && !this.data.busy) this.renderAt(this.data.currentIndex + 1);
  },

  goFinalize() {
    if (this.data.uploadedCount < this.items.length) {
      wx.showToast({ title: '还有内容未完成', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: `/pages/submit-result/index?id=${this.assignmentId}&action=finalize`,
    });
  },

  ensureMicAuth(): Promise<boolean> {
    return new Promise((resolve) => {
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
  },
});
