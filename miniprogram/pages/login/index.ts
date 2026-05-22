import { wxLogin } from '../../api/auth';
import { saveLoginState } from '../../utils/auth';

interface LoginData {
  loading: boolean;
  nickname: string;
  avatar: string;
}

Page<LoginData, Record<string, never>>({
  data: {
    loading: false,
    nickname: '',
    avatar: '',
  },

  onChooseAvatar(e: { detail: { avatarUrl: string } }) {
    this.setData({ avatar: e.detail.avatarUrl });
  },

  onNicknameInput(e: { detail: { value: string } }) {
    this.setData({ nickname: e.detail.value });
  },

  async onLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      // 1) 拿微信 code
      const code = await new Promise<string>((resolve, reject) => {
        wx.login({
          success: (res: { code: string }) =>
            res.code ? resolve(res.code) : reject(new Error('未获取到 code')),
          fail: (err: { errMsg: string }) => reject(new Error(err.errMsg)),
        });
      });

      // 2) 调用后端登录
      const { token, student } = await wxLogin(code, {
        nickname: this.data.nickname || undefined,
        avatar: this.data.avatar || undefined,
      });

      // 3) 持久化 + 按角色跳转
      saveLoginState(token, student);
      this.gotoHomeByRole(student?.role);
    } catch (err) {
      // request.ts 已经弹了 toast，这里兜底打一条
      console.warn('[login] failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  async onMockLogin() {
    // 联调用：直接走 mock code（后端 WECHAT_MOCK_LOGIN=true 时生效）
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const code = `mock-${Date.now()}`;
      const { token, student } = await wxLogin(code, {
        nickname: this.data.nickname || '体验同学',
      });
      saveLoginState(token, student);
      this.gotoHomeByRole(student?.role);
    } catch (err) {
      console.warn('[mock-login] failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 根据角色跳转：
   *   TEACHER / ADMIN → 老师首页（Day 4 实现，暂时占位）
   *   STUDENT / undefined → 学生首页
   */
  gotoHomeByRole(role?: string) {
    if (role === 'TEACHER' || role === 'ADMIN') {
      wx.reLaunch({ url: '/pages/teacher-home/index' });
    } else {
      wx.switchTab({ url: '/pages/home/index' });
    }
  },
});
