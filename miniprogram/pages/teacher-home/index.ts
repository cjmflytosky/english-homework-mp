/**
 * 老师 / 管理员首页：我管理的班级 + 待批改作业入口
 */
import {
  listClassesForTeacher,
  listAssignmentsForTeacher,
  TeacherClassRow,
  AdminAssignmentRow,
} from '../../api/teacher';
import {
  isLoggedIn,
  getCurrentStudent,
  clearLoginState,
} from '../../utils/auth';

interface TeacherHomeData {
  nickname: string;
  roleLabel: string;
  isAdmin: boolean;
  loading: boolean;
  classes: TeacherClassRow[];
  assignments: Array<AdminAssignmentRow & { dateRange: string }>;
}

Page<TeacherHomeData, Record<string, never>>({
  data: {
    nickname: '',
    roleLabel: '',
    isAdmin: false,
    loading: false,
    classes: [],
    assignments: [],
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    const student = getCurrentStudent();
    const role = student?.role ?? 'STUDENT';
    // 如果登录态里 role 已经掉到 STUDENT（被人降级），退回学生首页
    if (role === 'STUDENT') {
      wx.reLaunch({ url: '/pages/home/index' });
      return;
    }
    this.setData({
      nickname: student?.realName || student?.nickname || '老师',
      roleLabel: role === 'ADMIN' ? '管理员' : '老师',
      isAdmin: role === 'ADMIN',
    });
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const [classes, assignments] = await Promise.all([
        listClassesForTeacher(),
        listAssignmentsForTeacher(),
      ]);
      const fmt = (s: string) => new Date(s).toLocaleDateString();
      this.setData({
        classes,
        assignments: assignments.map((a) => ({
          ...a,
          dateRange: `${fmt(a.startAt)} ~ ${fmt(a.endAt)}`,
        })),
      });
    } catch (err) {
      console.warn('[teacher-home] load failed', err);
    } finally {
      this.setData({ loading: false });
    }
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
