import { clearLoginState, isLoggedIn, loadLoginState } from '../../utils/auth';
import { listMyClasses, type JoinedClass } from '../../api/me';
import { Student } from '../../api/types';

interface ProfileData {
  student: Student | null;
  classes: JoinedClass[];
  classesLoading: boolean;
}

Page<ProfileData, Record<string, never>>({
  data: { student: null, classes: [], classesLoading: false },

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    this.setData({ student: loadLoginState().student });
    void this.loadClasses();
  },

  async loadClasses() {
    this.setData({ classesLoading: true });
    try {
      const classes = await listMyClasses();
      this.setData({ classes });
    } catch (err) {
      console.warn('[profile] load classes failed', err);
    } finally {
      this.setData({ classesLoading: false });
    }
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/index' });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确认要退出当前账号吗？',
      success: (res: { confirm: boolean }) => {
        if (res.confirm) {
          clearLoginState();
          wx.reLaunch({ url: '/pages/login/index' });
        }
      },
    });
  },
});
