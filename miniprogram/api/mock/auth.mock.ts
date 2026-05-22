import { LoginResult, Student } from '../types';

/**
 * useMock=true 时使用的假数据。
 * 持久化到本地 storage，模拟跨页面/重启保留登录态。
 */
export function fakeLogin(profile?: { nickname?: string; avatar?: string }): LoginResult {
  const id = `mock-${Date.now()}`;
  const student: Student = {
    id,
    openId: `mock-openid-${id}`,
    nickname: profile?.nickname || '体验同学',
    avatar: profile?.avatar,
    realName: undefined,
    studentNo: undefined,
    phone: undefined,
    role: 'STUDENT',
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  return { token: `mock-token-${id}`, student };
}
