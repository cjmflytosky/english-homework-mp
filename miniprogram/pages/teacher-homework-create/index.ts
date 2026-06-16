/**
 * 老师端：布置长句作业。
 *   1. 编辑步骤：填标题 + 长句文字 + 录制朗读（60s/手动停）→ 回放/重录/上传 COS。
 *   2. 创建作业（type=SENTENCE，单题：text=长句，refAudioUrl=老师录音）。
 *   3. 派发步骤（分开的一步）：选班级 + 截止日期 → 派发；也可「稍后再派发」。
 */
import {
  createHomework,
  publishAssignment,
  listClassesForTeacher,
} from '../../api/teacher';
import {
  start as startRecord,
  stop as stopRecord,
  isRecording,
  RecordResult,
} from '../../utils/recorder';
import { playbackLocal } from '../../utils/recording-flow';
import { uploadFile } from '../../utils/upload';

const SENTENCE_MAX_MS = 60_000; // 老师录音上限 60 秒
const DEFAULT_DUE_DAYS = 7;

type RecPhase =
  | 'idle'
  | 'recording'
  | 'stopping'
  | 'recorded'
  | 'uploading'
  | 'uploaded'
  | 'error';
type Step = 'edit' | 'publish';

interface CreateData {
  step: Step;
  title: string;
  sentence: string;

  recPhase: RecPhase;
  elapsedSec: number;
  maxSec: number;
  recordedSec: number;
  refAudioUrl: string;
  recErrorMsg: string;
  creating: boolean;

  // 派发步骤
  homeworkId: string;
  classNames: string[];
  classIndex: number;
  endDate: string;
  publishing: boolean;
}

interface PageState {
  classIds: string[];
  playbackCtx: WechatMiniprogram.InnerAudioContext | null;
  lastRecord: RecordResult | null;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_DUE_DAYS);
  // YYYY-MM-DD（本地）
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

Page<CreateData, PageState>({
  data: {
    step: 'edit',
    title: '',
    sentence: '',

    recPhase: 'idle',
    elapsedSec: 0,
    maxSec: Math.floor(SENTENCE_MAX_MS / 1000),
    recordedSec: 0,
    refAudioUrl: '',
    recErrorMsg: '',
    creating: false,

    homeworkId: '',
    classNames: [],
    classIndex: 0,
    endDate: defaultDueDate(),
    publishing: false,
  },

  classIds: [],
  playbackCtx: null,
  lastRecord: null,

  onUnload() {
    if (this.data.recPhase === 'recording') {
      void stopRecord().catch(() => undefined);
    }
    this.playbackCtx?.stop();
    this.playbackCtx?.destroy?.();
    this.playbackCtx = null;
  },

  onTitleInput(e: { detail: { value: string } }) {
    this.setData({ title: e.detail.value });
  },
  onSentenceInput(e: { detail: { value: string } }) {
    this.setData({ sentence: e.detail.value });
  },

  // ---------------- 录音 ----------------
  async onStartRecord() {
    if (this.data.recPhase === 'recording' || isRecording()) return;
    const ok = await this.ensureMicAuth();
    if (!ok) return;
    await this.beginRecord();
  },

  async beginRecord() {
    try {
      this.lastRecord = null;
      this.setData({ recPhase: 'recording', elapsedSec: 0, recErrorMsg: '' });
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
        recPhase: 'error',
        recErrorMsg: err instanceof Error ? err.message : '录音失败',
      });
    }
  },

  onStopRecord() {
    void this.handleManualStop();
  },

  async handleManualStop() {
    if (this.data.recPhase !== 'recording') return;
    this.setData({ recPhase: 'stopping' });
    try {
      const rec = await stopRecord();
      this.onRecorded(rec);
    } catch (err) {
      this.setData({
        recPhase: 'error',
        recErrorMsg: err instanceof Error ? err.message : '录音结束失败',
      });
    }
  },

  /** 录音停止（手动或自动）后统一进入「已录制」 */
  onRecorded(rec: RecordResult) {
    if (this.data.recPhase === 'recorded' || this.data.recPhase === 'uploaded') return;
    this.lastRecord = rec;
    this.setData({
      recPhase: 'recorded',
      recordedSec: Math.round(rec.duration / 1000),
      refAudioUrl: '',
    });
  },

  onPlayback() {
    if (!this.lastRecord) return;
    this.playbackCtx?.destroy?.();
    this.playbackCtx = playbackLocal(this.lastRecord.tempFilePath);
  },

  onReRecord() {
    if (isRecording()) return;
    void this.beginRecord();
  },

  async onUploadAudio() {
    if (!this.lastRecord) return;
    this.setData({ recPhase: 'uploading' });
    try {
      const up = await uploadFile(this.lastRecord.tempFilePath);
      this.setData({ recPhase: 'uploaded', refAudioUrl: up.url });
    } catch (err) {
      this.setData({
        recPhase: 'error',
        recErrorMsg: err instanceof Error ? err.message : '上传失败',
      });
    }
  },

  // ---------------- 创建作业 ----------------
  async onCreate() {
    const title = this.data.title.trim();
    const sentence = this.data.sentence.trim();
    if (!title) {
      wx.showToast({ title: '请填写作业标题', icon: 'none' });
      return;
    }
    if (!sentence) {
      wx.showToast({ title: '请填写长句文字', icon: 'none' });
      return;
    }
    if (this.data.recPhase !== 'uploaded' || !this.data.refAudioUrl) {
      wx.showToast({ title: '请先录制并上传范读', icon: 'none' });
      return;
    }

    this.setData({ creating: true });
    try {
      const hw = await createHomework({
        title,
        type: 'SENTENCE',
        items: [{ text: sentence, refAudioUrl: this.data.refAudioUrl }],
      });
      this.setData({ homeworkId: hw.id, step: 'publish' });
      void this.loadClasses();
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '创建失败',
        icon: 'none',
      });
    } finally {
      this.setData({ creating: false });
    }
  },

  // ---------------- 派发 ----------------
  async loadClasses() {
    try {
      const classes = await listClassesForTeacher();
      this.classIds = classes.map((c) => c.id);
      this.setData({
        classNames: classes.map((c) => c.name),
        classIndex: 0,
      });
    } catch (err) {
      console.warn('[homework-create] load classes failed', err);
    }
  },

  onClassChange(e: { detail: { value: string } }) {
    this.setData({ classIndex: Number(e.detail.value) });
  },

  onEndDateChange(e: { detail: { value: string } }) {
    this.setData({ endDate: e.detail.value });
  },

  async onPublish() {
    const classId = this.classIds[this.data.classIndex];
    if (!classId) {
      wx.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    this.setData({ publishing: true });
    try {
      await publishAssignment({
        homeworkId: this.data.homeworkId,
        classId,
        startAt: new Date().toISOString(),
        endAt: new Date(`${this.data.endDate}T23:59:59`).toISOString(),
      });
      wx.showToast({ title: '已派发', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '派发失败',
        icon: 'none',
      });
    } finally {
      this.setData({ publishing: false });
    }
  },

  onSkipPublish() {
    wx.showToast({ title: '作业已创建，可稍后派发', icon: 'none' });
    setTimeout(() => wx.navigateBack(), 800);
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
