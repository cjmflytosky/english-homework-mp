/**
 * 集中收敛环境变量。所有业务代码通过 ConfigService 读取，禁止直接 process.env。
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  globalPrefix: process.env.APP_GLOBAL_PREFIX ?? 'api',

  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-please-change',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  wechat: {
    appid: process.env.WECHAT_APPID ?? '',
    secret: process.env.WECHAT_SECRET ?? '',
    mockLogin: (process.env.WECHAT_MOCK_LOGIN ?? 'true') === 'true',
  },

  cos: {
    secretId: process.env.COS_SECRET_ID ?? '',
    secretKey: process.env.COS_SECRET_KEY ?? '',
    region: process.env.COS_REGION ?? 'ap-guangzhou',
    bucket: process.env.COS_BUCKET ?? '',
    mock: (process.env.COS_MOCK ?? 'true') === 'true',
  },

  soe: {
    secretId: process.env.SOE_SECRET_ID ?? '',
    secretKey: process.env.SOE_SECRET_KEY ?? '',
    region: process.env.SOE_REGION ?? 'ap-guangzhou',
    appId: process.env.SOE_APP_ID ?? '',
    mock: (process.env.SOE_MOCK ?? 'true') === 'true',
  },
});
