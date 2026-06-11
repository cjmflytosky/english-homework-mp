/**
 * 老师端 - 某次作业的全班学生提交列表
 * 进入路径：/pages/teacher-class/index?assignmentId=xxx
 *
 * 显示：
 *   - 作业标题、班级名
 *   - 整体统计：班级人数 / 已提交 / 已点评 / 待点评
 *   - 学生列表：排序「待点评 → 已点评 → 录音中 → 未开始」
 */
import {
  listSubmissionsByAssignment,
  getAssignmentStats,
  ClassSubmissionRow,
  ClassSubmissionsResult,
  SubmissionStatsBrief,
} from '../../api/teacher';

type RowVM = ClassSubmissionRow & {
  statusLabel: string;
  statusClass: string;
  displayName: string;
};

interface ClassPageData {
  loading: boolean;
  title: string;
  className: string;
  typeLabel: string;
  stats: SubmissionStatsBrief | null;
  rows: RowVM[];
}

Page<ClassPageData, { assignmentId: string }>({
  data: {
    loading: false,
    title: '',
    className: '',
    typeLabel: '',
    stats: null,
    rows: [],
  },

  assignmentId: '',

  onLoad(query: Record<string, string | undefined>) {
    const id = query.assignmentId;
    if (!id) {
      wx.showToast({ title: '缺少作业 ID', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.assignmentId = id;
    void this.load();
  },

  onShow() {
    if (this.assignmentId) void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const [submissions, stats] = await Promise.all([
        listSubmissionsByAssignment(this.assignmentId),
        getAssignmentStats(this.assignmentId),
      ]);
      this.applyData(submissions, stats);
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyData(data: ClassSubmissionsResult, stats: SubmissionStatsBrief) {
    const rows: RowVM[] = data.rows.map((r) => {
      let statusLabel: string;
      let statusClass: string;
      if (r.status === 'SUBMITTED' && !r.hasComment) {
        statusLabel = '待点评'; statusClass = 'pending';
      } else if (r.status === 'SUBMITTED' && r.hasComment) {
        statusLabel = '已点评'; statusClass = 'done';
      } else if (r.status === 'DRAFT') {
        statusLabel = `录音中 ${r.recordedItemCount}`;  statusClass = 'draft';
      } else {
        statusLabel = '未开始'; statusClass = 'idle';
      }
      return {
        ...r,
        statusLabel,
        statusClass,
        displayName:
          r.student.realName || r.student.nickname || '同学',
      };
    });

    this.setData({
      title: data.assignment.homework.title,
      className: data.assignment.class.name,
      typeLabel: data.assignment.homework.type === 'REPEAT' ? '跟读' : '背诵',
      stats,
      rows,
    });
  },

  goReview(e: { currentTarget: { dataset: { sid: string } } }) {
    const sid = e.currentTarget.dataset.sid;
    if (!sid) {
      wx.showToast({ title: '该学生还没开始这次作业', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/teacher-review/index?submissionId=${sid}`,
    });
  },
});
