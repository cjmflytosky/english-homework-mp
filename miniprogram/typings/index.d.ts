/// <reference path="./wx/index.d.ts" />

/**
 * 全局 App 实例数据类型。
 */
interface IGlobalData {
  /** 后端 base url */
  apiBaseUrl: string;
  /** 是否使用前端 mock 数据 */
  useMock: boolean;
  /** JWT */
  token: string;
  /** 当前学生信息 */
  student: import('../api/types').Student | null;
}

interface IAppOption {
  globalData: IGlobalData;
  /** 应用启动时刷新登录态 */
  refreshLoginState(): Promise<void>;
}
