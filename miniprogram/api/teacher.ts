/**
 * 老师 / 管理员小程序内调用的接口（所有走后端 /admin/* 路径）。
 *
 * 鉴权方式：JWT 里携带 studentRole=TEACHER 或 ADMIN，后端 role-helpers 判断。
 */
import { request } from '../utils/request';
import { StudentRole } from './types';

// ---------------------- 班级 ----------------------

export interface TeacherClassRow {
  id: string;
  name: string;
  grade: string | null;
  inviteCode: string;
  remark: string | null;
  enabled: boolean;
  /** 班级人数（如果后端返回） */
  memberCount?: number;
}

export function listClassesForTeacher(
  page = 1,
  pageSize = 50,
): Promise<TeacherClassRow[]> {
  return request<TeacherClassRow[]>({
    url: '/admin/classes',
    data: { page, pageSize },
  });
}

// ---------------------- 班级学生 ----------------------

export interface ClassStudentRow {
  id: string;
  nickname: string | null;
  avatar: string | null;
  realName: string | null;
  studentNo: string | null;
  role: StudentRole;
}

export interface ClassDetail {
  id: string;
  name: string;
  grade: string | null;
  inviteCode: string;
  remark: string | null;
  members: Array<{
    memberId: string;
    joinedAt: string;
    seatNo: string | null;
    student: ClassStudentRow;
  }>;
}

export function getClassDetail(classId: string): Promise<ClassDetail> {
  return request<ClassDetail>({ url: `/admin/classes/${classId}` });
}

// ---------------------- 作业批改 ----------------------

export interface AdminAssignmentRow {
  id: string;
  startAt: string;
  endAt: string;
  class: { id: string; name: string };
  homework: { id: string; title: string; type: 'REPEAT' | 'RECITE' };
}

export function listAssignmentsForTeacher(
  page = 1,
  pageSize = 50,
): Promise<AdminAssignmentRow[]> {
  return request<AdminAssignmentRow[]>({
    url: '/admin/assignments',
    data: { page, pageSize },
  });
}

export interface SubmissionStatsBrief {
  memberCount: number;
  submittedCount: number;
  commentedCount: number;
  pendingCount: number;
}

export function getAssignmentStats(
  assignmentId: string,
): Promise<SubmissionStatsBrief> {
  return request<SubmissionStatsBrief>({
    url: `/admin/assignments/${assignmentId}/stats`,
  });
}

export interface ClassSubmissionRow {
  student: ClassStudentRow;
  submissionId: string | null;
  status: 'DRAFT' | 'SUBMITTED' | null;
  recordedItemCount: number;
  submittedAt: string | null;
  hasComment: boolean;
  commentedAt: string | null;
}

export interface ClassSubmissionsResult {
  assignment: {
    id: string;
    class: { id: string; name: string };
    homework: { id: string; title: string; type: 'REPEAT' | 'RECITE' };
  };
  rows: ClassSubmissionRow[];
}

export function listSubmissionsByAssignment(
  assignmentId: string,
): Promise<ClassSubmissionsResult> {
  return request<ClassSubmissionsResult>({
    url: `/admin/assignments/${assignmentId}/submissions`,
  });
}

export interface AdminSubmissionDetail {
  id: string;
  status: 'DRAFT' | 'SUBMITTED';
  submittedAt: string | null;
  student: {
    id: string;
    nickname: string | null;
    avatar: string | null;
    realName: string | null;
    studentNo: string | null;
  };
  homework: {
    id: string;
    title: string;
    type: 'REPEAT' | 'RECITE';
    items: Array<{
      id: string;
      orderNo: number;
      text: string;
      translation: string | null;
      submission: {
        id: string;
        audioUrl: string | null;
        duration: number | null;
      } | null;
    }>;
  };
  comment: {
    id: string;
    content: string;
    updatedAt: string;
    author: { id: string; nickname: string | null; realName: string | null };
  } | null;
}

export function getSubmissionDetail(
  submissionId: string,
): Promise<AdminSubmissionDetail> {
  return request<AdminSubmissionDetail>({
    url: `/admin/submissions/${submissionId}`,
  });
}

// ---------------------- 点评 ----------------------

export function upsertTeacherComment(
  submissionId: string,
  content: string,
): Promise<unknown> {
  return request({
    url: `/admin/submissions/${submissionId}/comment`,
    method: 'POST',
    data: { content },
  });
}

// ---------------------- 管理员功能 ----------------------

/** 升降级他人 role（仅 ADMIN 可调） */
export function updateStudentRole(
  studentId: string,
  role: StudentRole,
): Promise<unknown> {
  return request({
    url: `/admin/students/${studentId}/role`,
    method: 'PATCH',
    data: { role },
  });
}

/** 把学生加入班级（按 student.id 列表） */
export function addStudentsToClass(
  classId: string,
  studentIds: string[],
): Promise<unknown> {
  return request({
    url: `/admin/classes/${classId}/members`,
    method: 'POST',
    data: { studentIds },
  });
}

/** 把学生踢出班级（按 ClassMember.id） */
export function removeMemberFromClass(
  classId: string,
  memberId: string,
): Promise<unknown> {
  return request({
    url: `/admin/classes/${classId}/members/${memberId}`,
    method: 'DELETE',
  });
}

/** 搜学生（按关键词，给「加学生入班」选用） */
export function searchStudents(
  keyword: string,
  page = 1,
  pageSize = 20,
): Promise<ClassStudentRow[]> {
  return request<ClassStudentRow[]>({
    url: '/admin/students',
    data: { keyword, page, pageSize },
  });
}
