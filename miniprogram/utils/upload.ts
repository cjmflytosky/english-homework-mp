/**
 * 文件上传：调用后端 /storage/upload，返回 url。
 * 使用 wx.uploadFile（multipart/form-data，字段名 file）。
 *
 * 注意：wx.cloud.callContainer 不支持 multipart，因此 cloudrun 模式下，
 * 上传走 wx.uploadFile 到 cloud.publicUploadUrl（云托管的公网域名）。
 */
import { AppConfig } from '../config/index';
import { ApiResponse, UploadResult } from '../api/types';

function uploadBase(): string {
  if (AppConfig.deployMode === 'cloudrun') {
    const u = AppConfig.cloud.publicUploadUrl;
    if (u) return `${u.replace(/\/$/, '')}${AppConfig.cloud.pathPrefix}`;
    // 没填公网域名时回退到 apiBaseUrl，仅供本机调试
    return AppConfig.apiBaseUrl;
  }
  return AppConfig.apiBaseUrl;
}

export function uploadFile(filePath: string): Promise<UploadResult> {
  if (AppConfig.useMock) {
    // mock 模式：不真正上传，返回一个本地路径作为 url
    return Promise.resolve({
      url: `mock-audio://${filePath}`,
      key: filePath,
      size: 0,
    });
  }

  const token =
    (getApp<IAppOption>()?.globalData?.token as string) ||
    (wx.getStorageSync('token') as string);

  const header: Record<string, string> = {};
  if (token) header['Authorization'] = `Bearer ${token}`;
  if (AppConfig.deployMode === 'cloudrun' && AppConfig.cloud.service) {
    header['X-WX-SERVICE'] = AppConfig.cloud.service;
  }

  return new Promise<UploadResult>((resolve, reject) => {
    wx.uploadFile({
      url: `${uploadBase()}/storage/upload`,
      filePath,
      name: 'file',
      header,
      timeout: AppConfig.timeout * 3,
      success: (res: { statusCode: number; data: string }) => {
        if (res.statusCode === 401) {
          reject(new Error('登录已过期'));
          return;
        }
        try {
          const body = JSON.parse(res.data) as ApiResponse<UploadResult>;
          if (!body.success || !body.data) {
            reject(new Error(body.message || '上传失败'));
            return;
          }
          resolve(body.data);
        } catch (e) {
          reject(new Error('上传响应解析失败'));
        }
      },
      fail: (err: { errMsg: string }) => reject(new Error(err.errMsg)),
    });
  });
}
