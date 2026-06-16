import { wxLogin } from '../../api/auth';
import { saveLoginState } from '../../utils/auth';
import { uploadFile } from '../../utils/upload';

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
    // 诊断：确认事件是否真的触发。点了头像按钮没反应时，看控制台有没有这条日志：
    //   - 没有日志   → 事件根本没触发（多半是模拟器，去真机调试；或图片没过安全检测被静默拦截）
    //   - 有日志但空 → 微信没回传头像
    const avatarUrl = e?.detail?.avatarUrl;
    console.log('[login] chooseAvatar 事件触发, avatarUrl =', avatarUrl);
    if (!avatarUrl) {
      wx.showToast({ title: '未获取到头像，请重试', icon: 'none' });
      return;
    }
    // 此处拿到的是临时本地路径，仅用于界面预览；登录时再上传 COS 换永久地址。
    this.setData({ avatar: avatarUrl });
  },

  onNicknameInput(e: { detail: { value: string } }) {
    this.setData({ nickname: e.detail.value });
  },

  /**
   * 把头像临时路径上传到 COS，返回永久 URL。
   * - 没选头像：返回 undefined
   * - 已是 http(s) 永久地址（非临时）：原样返回，不重复上传
   * - 上传失败：不阻断登录，返回 undefined（用户可稍后在「我的」里重设）
   * 注：/storage/upload 无需登录态，登录前即可上传。
   */
  async resolveAvatarUrl(): Promise<string | undefined> {
    const local = this.data.avatar;
    if (!local) return undefined;
    // chooseAvatar 的临时路径形如 http://tmp/xxx 或 wxfile://xxx；其余 http(s) 视为已上传地址
    const isTempPath = local.startsWith('wxfile://') || local.includes('://tmp/');
    if (!isTempPath && /^https?:\/\//.test(local)) return local;
    try {
      const { url } = await uploadFile(local);
      return url;
    } catch (err) {
      console.warn('[login] 头像上传失败', err);
      wx.showToast({ title: '头像上传失败，可稍后在「我的」重设', icon: 'none' });
      return undefined;
    }
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

      // 2) 头像上传 COS 换永久地址（chooseAvatar 给的是临时本地路径，直接存库换设备就丢）
      const avatar = await this.resolveAvatarUrl();

      // 3) 调用后端登录
      const { token, student } = await wxLogin(code, {
        nickname: this.data.nickname || undefined,
        avatar,
      });

      // 4) 持久化 + 按角色跳转
      saveLoginState(token, student);
      this.gotoHomeByRole(student?.role);
    } catch (err) {
      // request.ts 已经弹了 toast，这里兜底打一条
      console.warn('[login] failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 联调用：走 mock code（后端 WECHAT_MOCK_LOGIN=true 时生效）。
   * data-code 指定固定账号（mock-teacher / mock-admin，见 prisma/seed.ts）；
   * 不传则用一次性的体验学生账号（每次新建一个 STUDENT）。
   */
  async onMockLogin(e?: { currentTarget?: { dataset?: { code?: string } } }) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const fixed = e?.currentTarget?.dataset?.code;
      const code = fixed || `mock-${Date.now()}`;
      const { token, student } = await wxLogin(code, {
        nickname: this.data.nickname || (fixed ? undefined : '体验同学'),
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
