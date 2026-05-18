import { isLoggedIn } from '../../utils/auth';
import { fetchMe } from '../../api/auth';
import { Student } from '../../api/types';

interface HomeData {
  student: Student | null;
  todayDate: string;
}

Page<HomeData, Record<string, never>>({
  data: {
    student: null,
    todayDate: '',
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    this.setData({ todayDate: this.formatToday() });
    void this.loadProfile();
  },

  async loadProfile() {
    try {
      const me = await fetchMe();
      this.setData({ student: me });
    } catch (err) {
      // request 已统一弹 toast；不再展开
      console.warn('[home] fetchMe failed', err);
    }
  },

  goTasks() {
    wx.switchTab({ url: '/pages/task-list/index' });
  },

  formatToday(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  },
});
