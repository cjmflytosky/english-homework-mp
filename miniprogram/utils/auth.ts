/**
 * 登录态相关工具。
 */
import { Student } from '../api/types';

const TOKEN_KEY = 'token';
const STUDENT_KEY = 'student';

export function saveLoginState(token: string, student: Student): void {
  wx.setStorageSync(TOKEN_KEY, token);
  wx.setStorageSync(STUDENT_KEY, student);
  const app = getApp<IAppOption>();
  if (app) {
    app.globalData.token = token;
    app.globalData.student = student;
  }
}

export function loadLoginState(): { token: string; student: Student | null } {
  const token = (wx.getStorageSync(TOKEN_KEY) as string) || '';
  const student = (wx.getStorageSync(STUDENT_KEY) as Student) || null;
  return { token, student };
}

export function clearLoginState(): void {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(STUDENT_KEY);
  const app = getApp<IAppOption>();
  if (app) {
    app.globalData.token = '';
    app.globalData.student = null;
  }
}

export function isLoggedIn(): boolean {
  return !!loadLoginState().token;
}
