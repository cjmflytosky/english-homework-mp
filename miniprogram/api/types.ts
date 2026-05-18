/**
 * 与后端共享的接口契约。字段、命名必须与 NestJS 保持一致。
 */

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  meta?: { total: number; page: number; pageSize: number };
}

export type HomeworkType = 'REPEAT' | 'RECITE';

export type AssignmentStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EXPIRED';

export interface Student {
  id: string;
  openId: string;
  nickname?: string;
  avatar?: string;
  realName?: string;
  studentNo?: string;
  phone?: string;
  enabled: boolean;
  createdAt: string;
}

export interface HomeworkItem {
  id: string;
  orderNo: number;
  text: string;
  translation?: string;
  refAudioUrl?: string;
  score: number;
}

export interface Homework {
  id: string;
  title: string;
  description?: string;
  type: HomeworkType;
  totalScore: number;
  items?: HomeworkItem[];
}

export interface AssignmentSummary {
  id: string;
  startAt: string;
  endAt: string;
  remark?: string;
  status: AssignmentStatus;
  homework: {
    id: string;
    title: string;
    type: HomeworkType;
    totalScore: number;
    itemCount: number;
  };
}

export interface AssignmentDetail {
  id: string;
  startAt: string;
  endAt: string;
  remark?: string;
  status: AssignmentStatus;
  homework: Homework & { items: HomeworkItem[] };
}

export interface LoginResult {
  token: string;
  student: Student;
}

// ===================== 阶段 3：提交 / 评分 =====================

export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'SCORED';
export type ItemScoreStatus = 'PENDING' | 'SCORING' | 'DONE' | 'FAILED';

export interface SubmissionItem {
  id: string;
  homeworkItemId: string;
  audioUrl?: string;
  duration?: number;
  status: ItemScoreStatus;
  score?: number;
  fluency?: number;
  integrity?: number;
  pronunciation?: number;
  createdAt: string;
}

export interface TeacherCommentBrief {
  id: string;
  content: string;
  updatedAt: string;
  author: { id: string; name: string };
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  totalScore?: number;
  fluency?: number;
  integrity?: number;
  pronunciation?: number;
  submittedAt?: string;
  scoredAt?: string;
  items: SubmissionItem[];
  /** 阶段 5：老师点评（可能为 null） */
  comment?: TeacherCommentBrief | null;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

// ===================== 阶段 4：排名 / 历史 =====================

export interface RankingRow {
  rank: number;
  studentId: string;
  nickname: string;
  avatar?: string;
  totalScore: number | null;
  isMe: boolean;
}

export interface AssignmentRanking {
  top: RankingRow[];
  me: RankingRow | null;
  totalScored: number;
}

export interface HistoryItem {
  id: string;
  status: SubmissionStatus;
  totalScore: number | null;
  submittedAt: string | null;
  scoredAt: string | null;
  assignmentId: string;
  homework: { id: string; title: string; type: HomeworkType };
}
