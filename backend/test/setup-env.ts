/**
 * 在任何模块加载前注入测试环境变量。
 * @nestjs/config 用 dotenv，不会覆盖已存在的 process.env，所以这里先设的值优先生效，
 * 从而把数据库切到独立的测试库，避免污染本地开发库 xc_homework。
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://root:root@127.0.0.1:3306/xc_homework_test';
process.env.WECHAT_MOCK_LOGIN = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.COS_MOCK = 'true';
process.env.SOE_MOCK = 'true';
