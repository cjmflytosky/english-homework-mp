/**
 * 统一请求封装：
 *   - deployMode='http'      → wx.request 走 apiBaseUrl
 *   - deployMode='cloudrun'  → wx.cloud.callContainer 直达云托管服务
 *   - deployMode='mock'      → 不走这里，由各 api/*.ts 内部短路
 *
 * 两种模式都会：
 *   - 自动注入 Authorization: Bearer <token>
 *   - 自动解构 { success, code, message, data } 包络
 *   - 401 自动清登录态并跳回登录页
 */
import { AppConfig } from '../config/index';
import { ApiResponse } from '../api/types';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: Record<string, unknown>;
  /** 是否需要登录态；默认 true */
  auth?: boolean;
}

interface WxRequestSuccess<T> {
  statusCode: number;
  data: ApiResponse<T>;
}

function getToken(): string {
  const app = getApp<IAppOption>();
  if (app && app.globalData?.token) return app.globalData.token;
  return (wx.getStorageSync('token') as string) || '';
}

function buildHeader(needAuth: boolean): Record<string, string> {
  const header: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (AppConfig.deployMode === 'cloudrun' && AppConfig.cloud.service) {
    header['X-WX-SERVICE'] = AppConfig.cloud.service;
  }
  if (needAuth) {
    const token = getToken();
    if (token) header['Authorization'] = `Bearer ${token}`;
  }
  return header;
}

function handle401(): void {
  wx.removeStorageSync('token');
  const app = getApp<IAppOption>();
  if (app) app.globalData.token = '';
  wx.reLaunch({ url: '/pages/login/index' });
}

function unwrap<T>(body: ApiResponse<T> | undefined, statusCode: number): T {
  if (!body || body.success === false) {
    const msg = body?.message ?? `请求失败 (${statusCode})`;
    wx.showToast({ title: msg, icon: 'none' });
    throw new Error(msg);
  }
  return body.data as T;
}

/** wx.cloud.callContainer 在当前类型声明中不存在，自定义最小签名 */
interface CloudCallContainerArgs {
  config?: { env: string };
  path: string;
  method?: string;
  header?: Record<string, string>;
  data?: unknown;
  timeout?: number;
  success?: (res: { statusCode: number; data: unknown }) => void;
  fail?: (err: { errMsg: string }) => void;
}
interface WxCloudShim {
  callContainer?: (args: CloudCallContainerArgs) => void;
  init?: (opts: { env: string; traceUser?: boolean }) => void;
}

/**
 * cloudrun: 通过 wx.cloud.callContainer 调到云托管。
 * 注意：env 与 service 在 config 里配置；path 需要带上 pathPrefix（默认 /api）。
 */
function callViaCloud<T>(opts: RequestOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cloud = (wx as unknown as { cloud?: WxCloudShim }).cloud;
    if (!cloud || typeof cloud.callContainer !== 'function') {
      const msg = '当前基础库不支持云托管 callContainer，请升级开发者工具或基础库';
      wx.showToast({ title: msg, icon: 'none' });
      reject(new Error(msg));
      return;
    }
    cloud.callContainer({
      config: { env: AppConfig.cloud.env },
      path: `${AppConfig.cloud.pathPrefix}${opts.url}`,
      method: opts.method ?? 'GET',
      header: buildHeader(opts.auth !== false),
      data: opts.data,
      timeout: AppConfig.timeout,
      success: (res) => {
        if (res.statusCode === 401) {
          handle401();
          reject(new Error('未登录或登录已过期'));
          return;
        }
        try {
          resolve(unwrap(res.data as ApiResponse<T>, res.statusCode));
        } catch (err) {
          reject(err);
        }
      },
      fail: (err) => {
        wx.showToast({ title: err.errMsg || '云托管调用失败', icon: 'none' });
        reject(new Error(err.errMsg));
      },
    });
  });
}

/** http: 传统 wx.request */
function callViaHttp<T>(opts: RequestOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: `${AppConfig.apiBaseUrl}${opts.url}`,
      method: opts.method ?? 'GET',
      data: opts.data,
      header: buildHeader(opts.auth !== false),
      timeout: AppConfig.timeout,
      success: (res: WxRequestSuccess<T>) => {
        if (res.statusCode === 401) {
          handle401();
          reject(new Error('未登录或登录已过期'));
          return;
        }
        try {
          resolve(unwrap(res.data, res.statusCode));
        } catch (err) {
          reject(err);
        }
      },
      fail: (err: { errMsg: string }) => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(new Error(err.errMsg));
      },
    });
  });
}

export function request<T>(opts: RequestOptions): Promise<T> {
  if (AppConfig.deployMode === 'cloudrun') return callViaCloud<T>(opts);
  return callViaHttp<T>(opts);
}
