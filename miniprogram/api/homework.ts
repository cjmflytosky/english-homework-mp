import { request } from '../utils/request';
import { AppConfig } from '../config/index';
import { AssignmentSummary, AssignmentDetail } from './types';
import {
  mockAssignmentList,
  mockAssignmentDetail,
} from './mock/homework.mock';

/** 学生端：我的作业列表 */
export function listAssignments(): Promise<AssignmentSummary[]> {
  if (AppConfig.useMock) return Promise.resolve(mockAssignmentList());
  return request<AssignmentSummary[]>({ url: '/assignments' });
}

/** 学生端：作业详情（含 homework + items） */
export function getAssignmentDetail(id: string): Promise<AssignmentDetail> {
  if (AppConfig.useMock) {
    const d = mockAssignmentDetail(id);
    return d
      ? Promise.resolve(d)
      : Promise.reject(new Error('未找到作业'));
  }
  return request<AssignmentDetail>({ url: `/assignments/${id}` });
}
