/**
 * 老师 / 管理员首页。
 *   - 待批改作业：按状态分 Tab（待批改 / 已批完 / 全部），按截止时间升序（临近截止在前），
 *     上拉加载更多、下拉刷新；后端一次性返回每个作业的批改状态。
 *   - 我管理的班级：点进去看班级学生。
 *   - 管理员额外入口：学生管理 / 班级管理。
 */
import {
  listClassesForTeacher,
  listAssignmentsForTeacher,
  TeacherClassRow,
  AdminAssignmentRow,
  AssignmentTab,
  GradingStatus,
} from '../../api/teacher';
import {
  isLoggedIn,
  getCurrentStudent,
  clearLoginState,
} from '../../utils/auth';

const PAGE_SIZE = 20;

const GRADING_LABELS: Record<GradingStatus, string> = {
  PENDING: '待批改',
  DONE: '已批完',
  EMPTY: '无人提交',
};

type AssignmentItem = AdminAssignmentRow & {
  dueLabel: string;
  statusLabel: string;
};

interface TeacherHomeData {
  nickname: string;
  roleLabel: string;
  isAdmin: boolean;
  loading: boolean; // 班级加载
  classes: TeacherClassRow[];
  tab: AssignmentTab;
  assignments: AssignmentItem[];
  assignmentsLoading: boolean;
  assignmentsMore: boolean;
}

Page<TeacherHomeData, { assignmentPage: number }>({
  data: {
    nickname: '',
    roleLabel: '',
    isAdmin: false,
    loading: false,
    classes: [],
    tab: 'pending',
    assignments: [],
    assignmentsLoading: false,
    assignmentsMore: true,
  },

  assignmentPage: 1,

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    const student = getCurrentStudent();
    const role = student?.role ?? 'STUDENT';
    // 登录态里 role 掉回 STUDENT（被降级），退回学生首页
    if (role === 'STUDENT') {
      wx.reLaunch({ url: '/pages/home/index' });
      return;
    }
    this.setData({
      nickname: student?.realName || student?.nickname || '老师',
      roleLabel: role === 'ADMIN' ? '管理员' : '老师',
      isAdmin: role === 'ADMIN',
    });
    void this.loadClasses();
    void this.loadAssignments(true);
  },

  async loadClasses() {
    this.setData({ loading: true });
    try {
      const classes = await listClassesForTeacher();
      this.setData({ classes });
    } catch (err) {
      console.warn('[teacher-home] load classes failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /** reset=true：从第 1 页重载替换；false：加载下一页追加 */
  async loadAssignments(reset: boolean) {
    if (this.data.assignmentsLoading) return;
    if (!reset && !this.data.assignmentsMore) return;
    const page = reset ? 1 : this.assignmentPage + 1;
    this.setData({ assignmentsLoading: true });
    try {
      const rows = await listAssignmentsForTeacher(this.data.tab, page, PAGE_SIZE);
      const fmt = (s: string) => new Date(s).toLocaleDateString();
      const items: AssignmentItem[] = rows.map((a) => ({
        ...a,
        dueLabel: fmt(a.endAt),
        statusLabel: a.gradingStatus ? GRADING_LABELS[a.gradingStatus] : '',
      }));
      this.assignmentPage = page;
      this.setData({
        assignments: reset ? items : this.data.assignments.concat(items),
        assignmentsMore: rows.length === PAGE_SIZE,
      });
    } catch (err) {
      console.warn('[teacher-home] load assignments failed', err);
    } finally {
      this.setData({ assignmentsLoading: false });
    }
  },

  switchTab(e: { currentTarget: { dataset: { tab: AssignmentTab } } }) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab, assignments: [], assignmentsMore: true });
    void this.loadAssignments(true);
  },

  onReachBottom() {
    void this.loadAssignments(false);
  },

  async onPullDownRefresh() {
    await Promise.all([this.loadClasses(), this.loadAssignments(true)]);
    wx.stopPullDownRefresh();
  },

  goAssignment(e: { currentTarget: { dataset: { id: string } } }) {
    wx.navigateTo({
      url: `/pages/teacher-class/index?assignmentId=${e.currentTarget.dataset.id}`,
    });
  },

  goAdminTools() {
    wx.navigateTo({ url: '/pages/admin-tools/index' });
  },

  goClassManage() {
    wx.navigateTo({ url: '/pages/class-manage/index' });
  },

  goClass(e: { currentTarget: { dataset: { id: string; name: string } } }) {
    const { id, name } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/class-students/index?classId=${id}&name=${encodeURIComponent(name)}`,
    });
  },

  onLogout() {
    clearLoginState();
    wx.reLaunch({ url: '/pages/login/index' });
  },
});
