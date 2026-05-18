import { AssignmentRanking, Submission } from '../../api/types';
import {
  finalizeSubmission,
  getMySubmission,
  getAssignmentRanking,
} from '../../api/submission';

interface ResultData {
  loading: boolean;
  submission: Submission | null;
  scoreLabel: string;
  remark: string;
  ranking: AssignmentRanking | null;
  commentUpdatedAt: string;
}

Page<ResultData, Record<string, never>>({
  data: {
    loading: false,
    submission: null,
    scoreLabel: '',
    remark: '',
    ranking: null,
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
        scoreLabel: this.labelOf(sub.totalScore),
        remark: this.remarkOf(sub.totalScore),
        commentUpdatedAt: sub.comment
          ? this.fmtDate(sub.comment.updatedAt)
          : '',
      });

      // 阶段 4：拉一下班级排名
      if (sub.status === 'SCORED') {
        try {
          const r = await getAssignmentRanking(assignmentId);
          this.setData({ ranking: r });
        } catch (err) {
          console.warn('[result] ranking failed', err);
        }
      }
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '提交失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  labelOf(score?: number): string {
    if (score == null) return '-';
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  },
  remarkOf(score?: number): string {
    if (score == null) return '';
    if (score >= 90) return '太棒了！发音、流利度都很优秀。';
    if (score >= 80) return '不错！继续保持，注意个别发音细节。';
    if (score >= 70) return '良好。多练几次你会更稳。';
    return '继续加油，多听范读，对照练习。';
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
