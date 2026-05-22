/**
 * 小程序前端配置。
 *
 * 部署模式 deployMode：
 *   - 'mock'      纯本地假数据，不发请求（最快验证 UI / 后端没起时用）
 *   - 'http'      走传统 wx.request 到 apiBaseUrl（本机模拟器或自建 HTTPS 域名）
 *   - 'cloudrun'  走微信云托管 wx.cloud.callContainer，无需配置合法域名，
 *                 由小程序 appId 自动鉴权；apiBaseUrl 字段在该模式下被忽略
 *
 * 切换示例（开发期常用）：
 *   - 本机调试：deployMode='http'，apiBaseUrl='http://localhost:3000/api'
 *     开发者工具：详情→本地设置 勾「不校验合法域名…」
 *   - 真机调试自建后端：deployMode='http'，apiBaseUrl='https://你的备案域名/api'
 *   - 真机调试云托管：deployMode='cloudrun'，填写 cloudEnv + service 名
 */
export type DeployMode = 'mock' | 'http' | 'cloudrun';

export const AppConfig = {
  /** 部署模式：联调真后端切 'http'；上云后切 'cloudrun' */
  deployMode: 'cloudrun' as DeployMode,

  /** http 模式下的接口前缀；cloudrun 模式下仅 uploadFile fallback 时用 */
  apiBaseUrl: 'http://localhost:3000/api',

  /** cloudrun 模式所需配置 */
  cloud: {
    /** 云开发环境 ID（云托管控制台 → 服务详情 → 所属环境） */
    env: 'prod-d0gu5qnfb52e318b3',
    /**
     * 云托管服务名称。callContainer 通过 X-WX-SERVICE 头标识本次调用要打到哪个服务。
     * 当前指向独立 NestJS 后端服务 xc-homework-backend（旧 express-o264 demo 已废弃）。
     */
    service: 'xc-homework-backend',
    /** 服务内部前缀，对应后端 globalPrefix=api */
    pathPrefix: '/api',
    /**
     * 文件上传需用云托管公网 HTTPS 域名（callContainer 不支持 multipart）。
     * 当前服务公网域名（从控制台「服务详情 → 公网访问」复制）：
     */
    publicUploadUrl: 'https://xc-homework-backend-259108-7-1434176431.sh.run.tcloudbase.com',
  },

  /** 请求超时（毫秒） */
  timeout: 10000,

  /** 兼容旧代码：等价于 deployMode === 'mock' */
  get useMock(): boolean {
    return this.deployMode === 'mock';
  },
};
