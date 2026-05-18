import { request, requestRaw } from '@/utils/request';

export interface ClassMember {
  id: string;
  joinedAt: string;
  seatNo?: string | null;
  student: {
    id: string;
    nickname?: string | null;
    avatar?: string | null;
    realName?: string | null;
    studentNo?: string | null;
    phone?: string | null;
    enabled: boolean;
    createdAt: string;
  };
}

export interface ClassRow {
  id: string;
  name: string;
  grade?: string | null;
  inviteCode: string;
  remark?: string | null;
  enabled: boolean;
  ownerId: string;
  owner?: { id: string; name: string; username: string };
  memberCount: number;
  assignmentCount: number;
  createdAt: string;
}

export interface ClassDetail {
  id: string;
  name: string;
  grade?: string | null;
  inviteCode: string;
  remark?: string | null;
  enabled: boolean;
  owner?: { id: string; name: string; username: string };
  assignmentCount: number;
  createdAt: string;
  members: ClassMember[];
}

export interface CreateClassPayload {
  name: string;
  grade?: string;
  remark?: string;
}

export interface UpdateClassPayload {
  name?: string;
  grade?: string;
  remark?: string;
  enabled?: boolean;
}

export const listClasses = (page = 1, pageSize = 20, keyword?: string) =>
  requestRaw<ClassRow[]>({
    url: '/admin/classes',
    method: 'GET',
    params: { page, pageSize, keyword },
  });

export const createClass = (payload: CreateClassPayload) =>
  request<ClassRow>({ url: '/admin/classes', method: 'POST', data: payload });

export const getClass = (id: string) =>
  request<ClassDetail>({ url: `/admin/classes/${id}`, method: 'GET' });

export const updateClass = (id: string, payload: UpdateClassPayload) =>
  request<ClassRow>({
    url: `/admin/classes/${id}`,
    method: 'PATCH',
    data: payload,
  });

export const rotateInviteCode = (id: string) =>
  request<ClassRow>({
    url: `/admin/classes/${id}/invite-code/rotate`,
    method: 'POST',
  });

export const removeMember = (classId: string, memberId: string) =>
  request<{ id: string }>({
    url: `/admin/classes/${classId}/members/${memberId}`,
    method: 'DELETE',
  });

export const addMembers = (classId: string, studentIds: string[]) =>
  request<{ added: number; skipped: number; missing: number }>({
    url: `/admin/classes/${classId}/members`,
    method: 'POST',
    data: { studentIds },
  });
