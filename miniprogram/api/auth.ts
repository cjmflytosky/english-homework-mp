import { request } from '../utils/request';
import { AppConfig } from '../config/index';
import { LoginResult, Student } from './types';
import { fakeLogin } from './mock/auth.mock';
import { loadLoginState } from '../utils/auth';

/**
 * 微信登录：传 code 给后端换 JWT。
 * - useMock=true：直接返回本地伪造数据，不发请求
 * - useMock=false：调用 /auth/wx-login（后端 WECHAT_MOCK_LOGIN=true 时 code 可传 mock-xxx）
 */
export function wxLogin(
  code: string,
  profile?: { nickname?: string; avatar?: string },
): Promise<LoginResult> {
  if (AppConfig.useMock) {
    return Promise.resolve(fakeLogin(profile));
  }
  return request<LoginResult>({
    url: '/auth/wx-login',
    method: 'POST',
    data: { code, ...(profile ?? {}) },
    auth: false,
  });
}

export function fetchMe(): Promise<Student> {
  if (AppConfig.useMock) {
    const { student } = loadLoginState();
    if (student) return Promise.resolve(student);
    return Promise.reject(new Error('mock 模式下未登录'));
  }
  return request<Student>({ url: '/me' });
}
