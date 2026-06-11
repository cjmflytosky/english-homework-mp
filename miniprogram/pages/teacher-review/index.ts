/**
 * 老师端 - 单个学生提交批改
 *   - 顶部：学生信息 + 作业标题
 *   - 每题：英文原文 / 翻译 / 学生录音播放
 *   - 底部：点评输入框 + 提交
 */
import {
  getSubmissionDetail,
  upsertTeacherComment,
  AdminSubmissionDetail,
} from '../../api/teacher';

type ItemVM = AdminSubmissionDetail['homework']['items'][number] & {
  isPlaying: boolean;
};

interface ReviewData {
  loading: boolean;
  submission: AdminSubmissionDetail | null;
  items: ItemVM[];
  commentInput: string;
  submitting: boolean;
  displayName: string;
  authorName: string;
  commentTimeLabel: string;
}

Page<ReviewData, { submissionId: string; audioCtx: WechatMiniprogram.InnerAudioContext | null; currentItemId: string | null }>({
  data: {
    loading: false,
    submission: null,
    items: [],
    commentInput: '',
    submitting: false,
    displayName: '',
    authorName: '',
    commentTimeLabel: '',
  },

  submissionId: '',
  audioCtx: null,
  currentItemId: null,

  onLoad(query: Record<string, string | undefined>) {
    const id = query.submissionId;
    if (!id) {
      wx.showToast({ title: '缺少 ID', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.submissionId = id;
    void this.load();
  },

  onUnload() {
    this.audioCtx?.stop();
    this.audioCtx?.destroy?.();
    this.audioCtx = null;
  },

  async load() {
    this.setData({ loading: true });
    try {
      const detail = await getSubmissionDetail(this.submissionId);
      const items: ItemVM[] = detail.homework.items.map((it) => ({
        ...it,
        isPlaying: false,
      }));
      this.setData({
        submission: detail,
        items,
        commentInput: detail.comment?.content ?? '',
        displayName:
          detail.student.realName || detail.student.nickname || '同学',
        authorName: detail.comment
          ? detail.comment.author.realName ||
            detail.comment.author.nickname ||
            '老师'
          : '',
        commentTimeLabel: detail.comment
          ? this.fmtDate(detail.comment.updatedAt)
          : '',
      });
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  onPlay(e: { currentTarget: { dataset: { id: string; url: string } } }) {
    const { id, url } = e.currentTarget.dataset;
    if (!url) {
      wx.showToast({ title: '该题没有录音', icon: 'none' });
      return;
    }
    if (this.audioCtx && this.currentItemId === id) {
      this.audioCtx.stop();
      this.markPlaying(id, false);
      this.currentItemId = null;
      return;
    }
    if (this.audioCtx) {
      this.audioCtx.stop();
      if (this.currentItemId) this.markPlaying(this.currentItemId, false);
    }
    if (!this.audioCtx) this.audioCtx = wx.createInnerAudioContext();
    this.audioCtx.src = url;
    this.audioCtx.onEnded(() => {
      this.markPlaying(id, false);
      this.currentItemId = null;
    });
    this.audioCtx.onError((err: { errMsg: string }) => {
      wx.showToast({ title: '播放失败：' + err.errMsg, icon: 'none' });
      this.markPlaying(id, false);
      this.currentItemId = null;
    });
    this.audioCtx.play();
    this.markPlaying(id, true);
    this.currentItemId = id;
  },

  markPlaying(itemId: string, isPlaying: boolean) {
    const items = this.data.items.map((it: ItemVM) =>
      it.id === itemId ? { ...it, isPlaying } : it,
    );
    this.setData({ items });
  },

  onCommentInput(e: { detail: { value: string } }) {
    this.setData({ commentInput: e.detail.value });
  },

  async onSubmitComment() {
    const content = this.data.commentInput.trim();
    if (!content) {
      wx.showToast({ title: '请输入点评内容', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await upsertTeacherComment(this.submissionId, content);
      wx.showToast({ title: '点评已保存', icon: 'success' });
      void this.load();
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '提交失败',
        icon: 'none',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  fmtDate(s: string): string {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
});
