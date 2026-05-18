import { request, requestRaw } from '@/utils/request';

export type HomeworkType = 'REPEAT' | 'RECITE';

export interface HomeworkItem {
  id: string;
  orderNo: number;
  text: string;
  translation?: string;
  refAudioUrl?: string;
  score: number;
}

export interface HomeworkSummary {
  id: string;
  title: string;
  type: HomeworkType;
  totalScore: number;
  createdAt: string;
  itemCount: number;
  assignmentCount: number;
}

export interface HomeworkDetail {
  id: string;
  title: string;
  description?: string;
  type: HomeworkType;
  totalScore: number;
  createdAt: string;
  items: HomeworkItem[];
}

export interface CreateHomeworkPayload {
  title: string;
  description?: string;
  type: HomeworkType;
  totalScore?: number;
  items: Array<{
    text: string;
    translation?: string;
    refAudioUrl?: string;
    score?: number;
  }>;
}

export const listHomeworks = (page = 1, pageSize = 20) =>
  requestRaw<HomeworkSummary[]>({
    url: '/admin/homeworks',
    method: 'GET',
    params: { page, pageSize },
  });

export const createHomework = (payload: CreateHomeworkPayload) =>
  request<HomeworkDetail>({
    url: '/admin/homeworks',
    method: 'POST',
    data: payload,
  });

export const fetchHomework = (id: string) =>
  request<HomeworkDetail>({
    url: `/admin/homeworks/${id}`,
    method: 'GET',
  });

export const deleteHomework = (id: string) =>
  request<{ id: string }>({
    url: `/admin/homeworks/${id}`,
    method: 'DELETE',
  });
