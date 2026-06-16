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

export type HomeworkType = 'REPEAT' | 'RECITE' | 'WORD_CARD' | 'SENTENCE';

export type AssignmentStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'EXPIRED';

export type StudentRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface Student {
  id: string;
  openId: string;
  nickname?: string;
  avatar?: string;
  realName?: string;
  studentNo?: string;
  phone?: string;
  /** 小程序内角色：决定登录后进入学生 UI 还是老师 UI */
  role: StudentRole;
  enabled: boolean;
  createdAt: string;
}

export interface HomeworkItem {
  id: string;
  orderNo: number;
  text: string;
  translation?: string;
  /** 配图（COS）—— 单词卡片作业用 */
  imageUrl?: string;
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
  /** @deprecated MVP 阶段无评分，字段永远为 null。保留兼容旧数据。 */
  score?: number | null;
  /** @deprecated 同上 */
  fluency?: number | null;
  /** @deprecated 同上 */
  integrity?: number | null;
  /** @deprecated 同上 */
  pronunciation?: number | null;
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
  /** @deprecated MVP 阶段无评分，字段永远为 null */
  totalScore?: number | null;
  /** @deprecated */
  fluency?: number | null;
  /** @deprecated */
  integrity?: number | null;
  /** @deprecated */
  pronunciation?: number | null;
  submittedAt?: string;
  /** @deprecated MVP 阶段无评分 */
  scoredAt?: string | null;
  items: SubmissionItem[];
  /** 阶段 5：老师点评（可能为 null） */
  comment?: TeacherCommentBrief | null;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

// ===================== 历史 =====================

export interface HistoryItem {
  id: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  assignmentId: string;
  homework: { id: string; title: string; type: HomeworkType };
}
