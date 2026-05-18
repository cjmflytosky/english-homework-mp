import { request } from '@/utils/request';

export interface AdminStudentBrief {
  id: string;
  nickname?: string;
  avatar?: string;
  realName?: string;
  studentNo?: string;
}

export interface AdminSubmissionRow {
  student: AdminStudentBrief;
  submissionId: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'SCORED' | null;
  totalScore: number | null;
  fluency: number | null;
  integrity: number | null;
  pronunciation: number | null;
  scoredItemCount: number;
  submittedAt: string | null;
}

export interface AdminAssignmentSubmissions {
  assignment: {
    id: string;
    startAt: string;
    endAt: string;
    class: { id: string; name: string };
    homework: { id: string; title: string; type: 'REPEAT' | 'RECITE' };
  };
  rows: AdminSubmissionRow[];
}

export interface AssignmentStats {
  memberCount: number;
  submittedCount: number;
  scoredCount: number;
  avgScore: number | null;
  /** [0-59, 60-69, 70-79, 80-89, 90-100] */
  buckets: number[];
}

export interface TeacherCommentBrief {
  id: string;
  content: string;
  updatedAt: string;
  author: { id: string; name: string };
}

export interface AdminSubmissionDetail {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'SCORED';
  totalScore: number | null;
  fluency: number | null;
  integrity: number | null;
  pronunciation: number | null;
  submittedAt: string | null;
  scoredAt: string | null;
  student: AdminStudentBrief;
  homework: {
    id: string;
    title: string;
    type: 'REPEAT' | 'RECITE';
    items: Array<{
      id: string;
      orderNo: number;
      text: string;
      translation?: string;
      refAudioUrl?: string;
      score: number;
      submission: null | {
        id: string;
        audioUrl?: string;
        duration?: number;
        score?: number;
        fluency?: number;
        integrity?: number;
        pronunciation?: number;
      };
    }>;
  };
  comment: TeacherCommentBrief | null;
}

export const listAdminSubmissions = (assignmentId: string) =>
  request<AdminAssignmentSubmissions>({
    url: `/admin/assignments/${assignmentId}/submissions`,
  });

export const getAdminAssignmentStats = (assignmentId: string) =>
  request<AssignmentStats>({
    url: `/admin/assignments/${assignmentId}/stats`,
  });

export const getAdminSubmissionDetail = (id: string) =>
  request<AdminSubmissionDetail>({
    url: `/admin/submissions/${id}`,
  });

export const upsertTeacherComment = (id: string, content: string) =>
  request<TeacherCommentBrief>({
    url: `/admin/submissions/${id}/comment`,
    method: 'POST',
    data: { content },
  });

export const deleteTeacherComment = (id: string) =>
  request<{ deleted: boolean }>({
    url: `/admin/submissions/${id}/comment`,
    method: 'DELETE',
  });
