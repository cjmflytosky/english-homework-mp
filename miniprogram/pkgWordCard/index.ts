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
  | 'recorded'
  | 'uploading'
  | 'uploaded'
  | 'error';

interface WordCardData {
  items: HomeworkItem[];
  item: HomeworkItem | null;
  totalCount: number;
  currentIndex: number;
  phase: Phase;
  elapsedSec: number;
  maxSec: number;
  recordedSec: number;
  errorMsg: string;
  uploadedCount: number;
  busy: boolean; // 串联/录音/上传中
}

interface PageState {
  assignmentId: string;
  audioCtx: WechatMiniprogram.InnerAudioContext | null;
  playbackCtx: WechatMiniprogram.InnerAudioContext | null;
  uploadedMap: Record<string, SubmissionItem>;
  lastRecord: RecordResult | null;
  delayTimer: ReturnType<typeof setTimeout> | null;
  flowRunning: boolean; // 同步守卫，防止「范读→嘟→录音」被重复触发
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
    recordedSec: 0,
    errorMsg: '',
    uploadedCount: 0,
    busy: false,
  },

  assignmentId: '',
  audioCtx: null,
  playbackCtx: null,
  uploadedMap: {},
  lastRecord: null,
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
      this.setData({ uploadedCount: Object.keys(map).length });
      const cur = this.data.item;
      if (cur && map[cur.id]) {
        this.setData({ phase: 'uploaded', recordedSec: map[cur.id].duration ?? 0 });
      }
    } catch (err) {
      console.warn('[word-card] preload failed', err);
    }
  },

  onUnload() {
    this.abortOngoing();
    this.cleanupAudio();
  },

  /** 停掉进行中的录音/串联（切卡、卸载时用，丢弃未上传的本地录音） */
  abortOngoing() {
    if (isRecording()) void stopRecord().catch(() => undefined);
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

  renderAt(idx: number) {
    this.cleanupAudio();
    this.lastRecord = null;
    const item = this.data.items[idx];
    const uploaded = this.uploadedMap[item.id];
    this.setData({
      item,
      currentIndex: idx,
      phase: uploaded ? 'uploaded' : 'idle',
      elapsedSec: 0,
      recordedSec: uploaded?.duration ?? 0,
      errorMsg: '',
      busy: false,
    });
  },

  // ---------------- swiper 滑动切卡 ----------------
  onSwiperChange(e: { detail: { current: number } }) {
    const next = e.detail.current;
    if (next === this.data.currentIndex) return;
    // 切走时停掉当前进行中的录音/串联（未上传的会丢弃）
    this.abortOngoing();
    this.renderAt(next);
  },

  // ---------------- 串联：（范读 →）嘟 → 自动录音 ----------------
  onTapCard() {
    const { phase } = this.data;
    if (
      phase === 'idle' ||
      phase === 'recorded' ||
      phase === 'uploaded' ||
      phase === 'error'
    ) {
      void this.startFlow();
    }
  },

  async startFlow() {
    if (this.flowRunning || isRecording()) return; // 同步防重入
    this.flowRunning = true;
    try {
      const item = this.data.item;
      if (!item) return;
      const ok = await this.ensureMicAuth();
      if (!ok) return;

      this.lastRecord = null;
      this.setData({ busy: true, errorMsg: '' });

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
      this.setData({ phase: 'recording', elapsedSec: 0, busy: true });
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
    if (this.flowRunning || isRecording()) return;
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

  // ---------------- 提交 ----------------
  goFinalize() {
    if (this.data.uploadedCount < this.data.items.length) {
      wx.showToast({ title: '还有卡片未完成', icon: 'none' });
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
