import { HomeworkItem, SubmissionItem } from '../api/types';
import {
  start as startRecord,
  stop as stopRecord,
  isRecording,
  RecordResult,
} from '../utils/recorder';
import { beep } from '../utils/beep';
import { playbackLocal, uploadRecording } from '../utils/recording-flow';
import { getMySubmission } from '../api/submission';

const CARD_MAX_MS = 30_000; // 单词卡片录音上限 30 秒
const REF_TO_BEEP_DELAY_MS = 1_000; // 范读结束 → 嘟 之间的间隔

type Phase =
  | 'idle'
  | 'playing'
  | 'beeping'
  | 'recording'
  | 'stopping'
  | 'recorded' // 本次已录（本地，未提交）
  | 'uploaded' // 之前已提交（服务器已有）
  | 'error';

interface WordCardData {
  items: HomeworkItem[];
  item: HomeworkItem | null;
  totalCount: number;
  currentIndex: number;
  phase: Phase;
  elapsedSec: number;
  maxSec: number;
  errorMsg: string;
  doneCount: number; // 已录音/已提交的卡数
  submitting: boolean; // 整体提交（上传 + finalize）中
}

interface PageState {
  assignmentId: string;
  audioCtx: WechatMiniprogram.InnerAudioContext | null;
  playbackCtx: WechatMiniprogram.InnerAudioContext | null;
  recordedMap: Record<string, RecordResult>; // 本次各卡的本地录音
  uploadedMap: Record<string, SubmissionItem>; // 之前已提交的
  delayTimer: ReturnType<typeof setTimeout> | null;
  flowRunning: boolean;
}

Page<WordCardData, PageState>({
  data: {
    items: [],
    item: null,
    totalCount: 0,
    currentIndex: 0,
    phase: 'idle',
    elapsedSec: 0,
    maxSec: Math.floor(CARD_MAX_MS / 1000),
    errorMsg: '',
    doneCount: 0,
    submitting: false,
  },

  assignmentId: '',
  audioCtx: null,
  playbackCtx: null,
  recordedMap: {},
  uploadedMap: {},
  delayTimer: null,
  flowRunning: false,

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
    this.assignmentId = meta.assignmentId;
    this.setData({ items, totalCount: items.length });

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
      this.refreshDone();
      this.applyPhaseForCurrent();
    } catch (err) {
      console.warn('[word-card] preload failed', err);
    }
  },

  /** 已录音/已提交的卡数（本地录音 ∪ 服务器已有，按 itemId 去重） */
  refreshDone() {
    const ids = new Set([
      ...Object.keys(this.recordedMap),
      ...Object.keys(this.uploadedMap),
    ]);
    this.setData({ doneCount: ids.size });
  },

  applyPhaseForCurrent() {
    const cur = this.data.item;
    if (!cur) return;
    if (this.recordedMap[cur.id]) this.setData({ phase: 'recorded' });
    else if (this.uploadedMap[cur.id]) this.setData({ phase: 'uploaded' });
  },

  onUnload() {
    this.abortFlow();
    if (isRecording()) void stopRecord().catch(() => undefined);
    this.cleanupAudio();
  },

  /** 停掉串联中的播放/计时（不动已保存的录音） */
  abortFlow() {
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    this.flowRunning = false;
  },

  cleanupAudio() {
    this.audioCtx?.stop();
    this.audioCtx?.destroy?.();
    this.audioCtx = null;
    this.playbackCtx?.stop();
    this.playbackCtx?.destroy?.();
    this.playbackCtx = null;
  },

  /** 根据 maps 推导某张卡的初始 phase */
  phaseOf(itemId: string): Phase {
    if (this.recordedMap[itemId]) return 'recorded';
    if (this.uploadedMap[itemId]) return 'uploaded';
    return 'idle';
  },

  renderAt(idx: number) {
    this.cleanupAudio();
    const item = this.data.items[idx];
    this.setData({
      item,
      currentIndex: idx,
      phase: this.phaseOf(item.id),
      elapsedSec: 0,
      errorMsg: '',
    });
  },

  // ---------------- swiper 滑动切卡 ----------------
  async onSwiperChange(e: { detail: { current: number } }) {
    const next = e.detail.current;
    if (next === this.data.currentIndex) return;
    // 录音中滑走：先停止并把录音保存到当前卡（不丢失）
    if (this.data.phase === 'recording') {
      await this.handleManualStop();
    } else {
      this.abortFlow();
    }
    this.renderAt(next);
  },

  // ---------------- （范读 →）嘟 → 自动录音 ----------------
  onTapCard() {
    this.tryStartFlow();
  },
  onStartRecord() {
    this.tryStartFlow();
  },

  tryStartFlow() {
    const { phase } = this.data;
    if (phase === 'idle' || phase === 'error') void this.startFlow();
  },

  async startFlow() {
    if (this.flowRunning || isRecording()) return;
    this.flowRunning = true;
    try {
      const item = this.data.item;
      if (!item) return;
      const ok = await this.ensureMicAuth();
      if (!ok) return;

      this.setData({ errorMsg: '' });
      if (item.refAudioUrl) {
        this.setData({ phase: 'playing' });
        await this.playRef(item.refAudioUrl);
        await this.wait(REF_TO_BEEP_DELAY_MS);
      }
      this.setData({ phase: 'beeping' });
      await beep();
      await this.beginRecord();
    } finally {
      this.flowRunning = false;
    }
  },

  playRef(src: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioCtx) this.audioCtx = wx.createInnerAudioContext();
      const ctx = this.audioCtx;
      ctx.src = src;
      const done = () => {
        ctx.offEnded?.(done);
        ctx.offError?.(done);
        resolve();
      };
      ctx.onEnded?.(done);
      ctx.onError?.(done);
      ctx.play();
    });
  },

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.delayTimer = setTimeout(() => {
        this.delayTimer = null;
        resolve();
      }, ms);
    });
  },

  async beginRecord() {
    try {
      this.setData({ phase: 'recording', elapsedSec: 0 });
      await startRecord(
        (ms) => {
          const sec = Math.floor(ms / 1000);
          if (sec !== this.data.elapsedSec) this.setData({ elapsedSec: sec });
        },
        CARD_MAX_MS,
        (rec) => this.onRecorded(rec), // 到 30s 自动停
      );
    } catch (err) {
      this.setData({
        phase: 'error',
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
        errorMsg: err instanceof Error ? err.message : '录音结束失败',
      });
    }
  },

  /** 录音停止（手动或自动）后存到当前卡，进入「已录制」 */
  onRecorded(rec: RecordResult) {
    if (this.data.phase === 'recorded') return;
    const item = this.data.item;
    if (!item) return;
    this.recordedMap[item.id] = rec;
    this.refreshDone();
    this.setData({ phase: 'recorded', elapsedSec: 0 });
  },

  // ---------------- 回放 / 重录 ----------------
  onPlayback() {
    const item = this.data.item;
    if (!item) return;
    const local = this.recordedMap[item.id];
    const remoteUrl = this.uploadedMap[item.id]?.audioUrl;
    const src = local?.tempFilePath || remoteUrl;
    if (!src) return;
    this.playbackCtx?.destroy?.();
    this.playbackCtx = playbackLocal(src);
  },

  onReRecord() {
    if (this.flowRunning || isRecording()) return;
    void this.startFlowForce();
  },

  /** 重录：跳过「已录制」判断，直接重新走串联 */
  async startFlowForce() {
    this.setData({ phase: 'idle' });
    await this.startFlow();
  },

  // ---------------- 整体提交：上传所有本地录音 + finalize ----------------
  async goFinalize() {
    if (this.data.doneCount < this.data.totalCount) {
      wx.showToast({ title: '还有卡片未录制', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      // 逐个上传本次新录音（已在服务器的跳过）
      for (const itemId of Object.keys(this.recordedMap)) {
        const rec = this.recordedMap[itemId];
        const saved = await uploadRecording({
          assignmentId: this.assignmentId,
          homeworkItemId: itemId,
          filePath: rec.tempFilePath,
          durationMs: rec.duration,
        });
        this.uploadedMap[itemId] = saved;
      }
      this.recordedMap = {};
      // 复用 submit-result 的 finalize 流程
      wx.redirectTo({
        url: `/pages/submit-result/index?id=${this.assignmentId}&action=finalize`,
      });
    } catch (err) {
      this.setData({ submitting: false });
      wx.showToast({
        title: err instanceof Error ? err.message : '提交失败',
        icon: 'none',
      });
    }
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
