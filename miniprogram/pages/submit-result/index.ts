import { Submission } from '../../api/types';
import {
  finalizeSubmission,
  getMySubmission,
} from '../../api/submission';

interface ResultData {
  loading: boolean;
  submission: Submission | null;
  commentUpdatedAt: string;
}

Page<ResultData, Record<string, never>>({
  data: {
    loading: false,
    submission: null,
    commentUpdatedAt: '',
  },

  onLoad(q: Record<string, string | undefined>) {
    const id = q.id;
    if (!id) {
      wx.showToast({ title: '缺少作业 ID', icon: 'none' });
      wx.navigateBack();
      return;
    }
    const action = q.action ?? 'view';
    void this.load(id, action === 'finalize');
  },

  async load(assignmentId: string, doFinalize: boolean) {
    this.setData({ loading: true });
    try {
      const sub = doFinalize
        ? await finalizeSubmission(assignmentId)
        : await getMySubmission(assignmentId);

      if (!sub) {
        this.setData({ submission: null });
        return;
      }
      this.setData({
        submission: sub,
        commentUpdatedAt: sub.comment ? this.fmtDate(sub.comment.updatedAt) : '',
      });
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '提交失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  fmtDate(s: string): string {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  goHome() { wx.switchTab({ url: '/pages/home/index' }); },
  goTasks() { wx.switchTab({ url: '/pages/task-list/index' }); },
});
