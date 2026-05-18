import { request } from '@/utils/request';

export interface AdminInfo {
  id: string;
  username: string;
  name: string;
  role: 'SUPER_ADMIN' | 'TEACHER';
  phone?: string;
  avatar?: string;
}

export interface AdminLoginPayload {
  username: string;
  password: string;
}

export interface AdminLoginResult {
  token: string;
  admin: AdminInfo;
}

export const adminLogin = (payload: AdminLoginPayload) =>
  request<AdminLoginResult>({
    url: '/auth/admin/login',
    method: 'POST',
    data: payload,
  });

export const fetchAdminMe = () =>
  request<AdminInfo>({ url: '/admin/me', method: 'GET' });
