import { request } from '../utils/request';
import { AppConfig } from '../config/index';
import {
  AssignmentRanking,
  HistoryItem,
  Submission,
  SubmissionItem,
} from './types';
import {
  mockUploadItem,
  mockFinalize,
  mockGetSubmission,
  mockRanking,
  mockHistory,
} from './mock/submission.mock';

export interface UploadItemPayload {
  assignmentId: string;
  homeworkItemId: string;
  audioUrl: string;
  duration?: number;
}

export interface UploadItemResult {
  submissionId: string;
  item: SubmissionItem;
}

export function uploadSubmissionItem(
  payload: UploadItemPayload,
): Promise<UploadItemResult> {
  if (AppConfig.useMock) return Promise.resolve(mockUploadItem(payload));
  return request<UploadItemResult>({
    url: '/submissions/items',
    method: 'POST',
    data: payload,
  });
}

export function finalizeSubmission(assignmentId: string): Promise<Submission> {
  if (AppConfig.useMock) return Promise.resolve(mockFinalize(assignmentId));
  return request<Submission>({
    url: `/submissions/${assignmentId}/finalize`,
    method: 'POST',
  });
}

export function getMySubmission(
  assignmentId: string,
): Promise<Submission | null> {
  if (AppConfig.useMock) return Promise.resolve(mockGetSubmission(assignmentId));
  return request<Submission | null>({
    url: `/submissions/by-assignment/${assignmentId}`,
  });
}

// ===================== 阶段 4 =====================

export function getAssignmentRanking(
  assignmentId: string,
): Promise<AssignmentRanking> {
  if (AppConfig.useMock) return Promise.resolve(mockRanking(assignmentId));
  return request<AssignmentRanking>({
    url: `/assignments/${assignmentId}/ranking`,
  });
}

export function listMyHistory(
  page = 1,
  pageSize = 20,
): Promise<HistoryItem[]> {
  if (AppConfig.useMock) return Promise.resolve(mockHistory());
  // 注意：后端用 meta 表示分页，request 默认只取 data
  return request<HistoryItem[]>({
    url: '/me/submissions',
    data: { page, pageSize },
  });
}
