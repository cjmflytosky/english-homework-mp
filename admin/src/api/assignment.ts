import { request, requestRaw } from '@/utils/request';
import type { HomeworkType } from './homework';

export interface AssignmentRow {
  id: string;
  startAt: string;
  endAt: string;
  remark?: string;
  createdAt: string;
  homework: { id: string; title: string; type: HomeworkType };
  class: { id: string; name: string };
}

export interface PublishPayload {
  homeworkId: string;
  startAt: string;
  endAt: string;
  classId?: string;
  remark?: string;
}

export const publishAssignment = (payload: PublishPayload) =>
  request<AssignmentRow>({
    url: '/admin/assignments',
    method: 'POST',
    data: payload,
  });

export const listAssignments = (page = 1, pageSize = 20) =>
  requestRaw<AssignmentRow[]>({
    url: '/admin/assignments',
    method: 'GET',
    params: { page, pageSize },
  });
