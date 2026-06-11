/**
 * Jest 全局准备（整轮只跑一次）：
 *   1. 把 Prisma schema 推到独立测试库（不存在则自动创建）
 *   2. 跑 seed 写入 admin 账号 / 默认班级 / 固定 mock 账号
 * 全部针对 DATABASE_URL=测试库，开发库 xc_homework 不受影响。
 */
import { execSync } from 'child_process';
import { join } from 'path';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://root:root@127.0.0.1:3306/xc_homework_test';

export default async function globalSetup(): Promise<void> {
  const cwd = join(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: TEST_DB_URL };
  // eslint-disable-next-line no-console
  console.log(`\n[e2e] preparing test database: ${TEST_DB_URL}`);
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd,
    env,
    stdio: 'inherit',
  });
  execSync('npx ts-node prisma/seed.ts', { cwd, env, stdio: 'inherit' });
}
