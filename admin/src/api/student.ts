import { request, requestRaw } from '@/utils/request';

export interface StudentRow {
  id: string;
  openId: string;
  nickname?: string | null;
  avatar?: string | null;
  realName?: string | null;
  studentNo?: string | null;
  phone?: string | null;
  enabled: boolean;
  submissionCount: number;
  classes: { memberId: string; id: string; name: string }[];
  createdAt: string;
}

export interface StudentDetail {
  id: string;
  openId: string;
  nickname?: string | null;
  avatar?: string | null;
  realName?: string | null;
  studentNo?: string | null;
  phone?: string | null;
  enabled: boolean;
  createdAt: string;
  classes: { memberId: string; id: string; name: string; grade?: string | null; joinedAt: string }[];
  recentSubmissions: {
    id: string;
    status: string;
    totalScore: number | null;
    submittedAt: string | null;
    scoredAt: string | null;
    homework: { id: string; title: string };
  }[];
}

export interface UpdateStudentPayload {
  realName?: string;
  studentNo?: string;
  phone?: string;
  enabled?: boolean;
}

export interface ListStudentParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  classId?: string;
  enabled?: 'true' | 'false';
}

export const listStudents = (params: ListStudentParams) =>
  requestRaw<StudentRow[]>({
    url: '/admin/students',
    method: 'GET',
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      ...(params.keyword ? { keyword: params.keyword } : {}),
      ...(params.classId ? { classId: params.classId } : {}),
      ...(params.enabled ? { enabled: params.enabled } : {}),
    },
  });

export const getStudent = (id: string) =>
  request<StudentDetail>({ url: `/admin/students/${id}`, method: 'GET' });

export const updateStudent = (id: string, payload: UpdateStudentPayload) =>
  request<StudentRow>({
    url: `/admin/students/${id}`,
    method: 'PATCH',
    data: payload,
  });
