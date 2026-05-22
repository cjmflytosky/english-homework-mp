import { HistoryItem, Submission, SubmissionItem } from '../types';
import { mockAssignmentDetail, mockAssignmentList } from './homework.mock';

/**
 * 内存版提交记录（按 assignmentId 索引），重启小程序即清空。
 * 仅用于 useMock=true 时演示 MVP 流程。
 * MVP 阶段无评分，所有 score/fluency/integrity/pronunciation 字段保持 undefined。
 */
const cache: Record<string, Submission> = {};

function buildSubmission(assignmentId: string): Submission {
  return (
    cache[assignmentId] || {
      id: `sub-${assignmentId}`,
      assignmentId,
      studentId: 'mock-self',
      status: 'DRAFT',
      items: [],
    } as Submission
  );
}

export function mockUploadItem(payload: {
  assignmentId: string;
  homeworkItemId: string;
  audioUrl: string;
  duration?: number;
}): { submissionId: string; item: SubmissionItem } {
  const sub = buildSubmission(payload.assignmentId);
  const item: SubmissionItem = {
    id: `it-${payload.homeworkItemId}`,
    homeworkItemId: payload.homeworkItemId,
    audioUrl: payload.audioUrl,
    duration: payload.duration,
    status: 'DONE',
    createdAt: new Date().toISOString(),
  };
  sub.items = [
    ...sub.items.filter((i) => i.homeworkItemId !== payload.homeworkItemId),
    item,
  ];
  sub.status = 'DRAFT';
  cache[payload.assignmentId] = sub;
  return { submissionId: sub.id, item };
}

export function mockFinalize(assignmentId: string): Submission {
  const sub = buildSubmission(assignmentId);
  const detail = mockAssignmentDetail(assignmentId);
  if (!detail) throw new Error('mock 模式：未找到作业');
  if (sub.items.length < detail.homework.items.length) {
    throw new Error(
      `还有 ${detail.homework.items.length - sub.items.length} 题未录制`,
    );
  }
  sub.status = 'SUBMITTED';
  sub.submittedAt = new Date().toISOString();
  cache[assignmentId] = sub;
  return sub;
}

export function mockGetSubmission(assignmentId: string): Submission | null {
  return cache[assignmentId] ?? null;
}

export function mockHistory(): HistoryItem[] {
  const list = mockAssignmentList();
  return list.map((a) => {
    const sub = cache[a.id];
    return {
      id: sub?.id ?? `sub-${a.id}`,
      status: sub?.status ?? 'DRAFT',
      submittedAt: sub?.submittedAt ?? null,
      assignmentId: a.id,
      homework: { id: a.homework.id, title: a.homework.title, type: a.homework.type },
    };
  });
}
