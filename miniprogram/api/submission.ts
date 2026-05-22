import { request } from '../utils/request';
import { AppConfig } from '../config/index';
import {
  HistoryItem,
  Submission,
  SubmissionItem,
} from './types';
import {
  mockUploadItem,
  mockFinalize,
  mockGetSubmission,
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

export function listMyHistory(
  page = 1,
  pageSize = 20,
): Promise<HistoryItem[]> {
  if (AppConfig.useMock) return Promise.resolve(mockHistory());
  return request<HistoryItem[]>({
    url: '/me/submissions',
    data: { page, pageSize },
  });
}
