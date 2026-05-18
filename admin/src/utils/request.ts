/**
 * 管理后台统一请求封装，自动注入 JWT 并解构 ApiResponse。
 */
import axios, { AxiosError, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/store/auth';
import router from '@/router';

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  meta?: { total: number; page: number; pageSize: number };
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
  timeout: 10000,
});

http.interceptors.request.use((cfg) => {
  const auth = useAuthStore();
  if (auth.token) {
    cfg.headers.set('Authorization', `Bearer ${auth.token}`);
  }
  return cfg;
});

http.interceptors.response.use(
  (res: AxiosResponse<ApiResponse<unknown>>) => res,
  (err: AxiosError<ApiResponse<unknown>>) => {
    if (err.response?.status === 401) {
      const auth = useAuthStore();
      auth.logout();
      void router.push('/login');
    }
    const msg =
      err.response?.data?.message ?? err.message ?? '请求失败';
    ElMessage.error(msg);
    return Promise.reject(err);
  },
);

export async function request<T>(
  config: Parameters<typeof http.request>[0],
): Promise<T> {
  const { data } = await http.request<ApiResponse<T>>(config);
  if (!data.success) {
    ElMessage.error(data.message);
    throw new Error(data.message);
  }
  return data.data as T;
}

/** 拿到原始 ApiResponse，便于分页 meta */
export async function requestRaw<T>(
  config: Parameters<typeof http.request>[0],
): Promise<ApiResponse<T>> {
  const { data } = await http.request<ApiResponse<T>>(config);
  if (!data.success) {
    ElMessage.error(data.message);
    throw new Error(data.message);
  }
  return data;
}

export default http;
