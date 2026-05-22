/**
 * 老师/管理员首页占位（Day 1）
 *
 * Day 4 实现：
 *   - 我管理的班级列表
 *   - 待点评学生数
 *   - 进入「班级 → 学生 → 录音 → 点评」流程
 *   - 管理员额外入口：升级/降级他人 role、加学生入班
 */
import { isLoggedIn, getCurrentStudent, clearLoginState } from '../../utils/auth';

interface TeacherHomeData {
  nickname: string;
  role: string;
}

Page<TeacherHomeData, Record<string, never>>({
  data: { nickname: '', role: '' },

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    const student = getCurrentStudent();
    this.setData({
      nickname: student?.realName || student?.nickname || '老师',
      role: student?.role === 'ADMIN' ? '管理员' : '老师',
    });
  },

  onLogout() {
    clearLoginState();
    wx.reLaunch({ url: '/pages/login/index' });
  },
});
