/**
 * 星创想作业系统 - 小程序入口
 */
import { AppConfig } from './config/index';
import { loadLoginState } from './utils/auth';

App<IAppOption>({
  globalData: {
    apiBaseUrl: AppConfig.apiBaseUrl,
    useMock: AppConfig.useMock,
    token: '',
    student: null,
  },

  onLaunch() {
    // cloudrun 模式必须先 init 一次 wx.cloud，否则 callContainer 报错
    if (AppConfig.deployMode === 'cloudrun') {
      const cloud = (wx as unknown as { cloud?: { init?: (opts: { env: string; traceUser?: boolean }) => void } }).cloud;
      if (cloud && typeof cloud.init === 'function') {
        cloud.init({ env: AppConfig.cloud.env, traceUser: true });
      } else {
        console.warn('[app] wx.cloud 不可用，请确认基础库版本 ≥ 2.2.3');
      }
    }

    // 启动时从本地存储恢复登录态
    const { token, student } = loadLoginState();
    this.globalData.token = token;
    this.globalData.student = student;
  },

  async refreshLoginState() {
    const { token, student } = loadLoginState();
    this.globalData.token = token;
    this.globalData.student = student;
  },
});
