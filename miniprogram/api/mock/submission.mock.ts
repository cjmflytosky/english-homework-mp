import { AssignmentRanking, HistoryItem, Submission, SubmissionItem } from '../types';
import { mockAssignmentDetail, mockAssignmentList } from './homework.mock';

/**
 * 内存版提交记录（按 assignmentId 索引），重启小程序即清空。
 * 仅用于 useMock=true 时演示阶段 3 的全流程。
 */
const cache: Record<string, Submission> = {};

function pseudoScore(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return 78 + (Math.abs(h) % 18); // 78~95
}

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
  const score = pseudoScore(payload.audioUrl + payload.homeworkItemId);
  const item: SubmissionItem = {
    id: `it-${payload.homeworkItemId}`,
    homeworkItemId: payload.homeworkItemId,
    audioUrl: payload.audioUrl,
    duration: payload.duration,
    status: 'DONE',
    score,
    fluency: Math.max(60, Math.min(100, score + 1)),
    integrity: Math.max(60, Math.min(100, score - 2)),
    pronunciation: Math.max(60, Math.min(100, score + 2)),
    createdAt: new Date().toISOString(),
  };
  // 覆盖同题
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
  const avg = (k: keyof SubmissionItem) =>
    Math.round(
      (sub.items.reduce((a, i) => a + ((i[k] as number) ?? 0), 0) /
        sub.items.length) *
        10,
    ) / 10;
  sub.status = 'SCORED';
  sub.totalScore = avg('score');
  sub.fluency = avg('fluency');
  sub.integrity = avg('integrity');
  sub.pronunciation = avg('pronunciation');
  sub.submittedAt = new Date().toISOString();
  sub.scoredAt = sub.submittedAt;
  cache[assignmentId] = sub;
  return sub;
}

export function mockGetSubmission(assignmentId: string): Submission | null {
  return cache[assignmentId] ?? null;
}

// ===================== 阶段 4 mock =====================

export function mockRanking(assignmentId: string): AssignmentRanking {
  const me = cache[assignmentId];
  const myScore = me?.totalScore ?? 75;

  const peers = [
    { studentId: 'p1', nickname: '陈小柔',  totalScore: 96 },
    { studentId: 'p2', nickname: '林思源',  totalScore: 92 },
    { studentId: 'p3', nickname: '苏奕辰',  totalScore: 89 },
    { studentId: 'p4', nickname: '韩沐青',  totalScore: 86 },
    { studentId: 'p5', nickname: '周思言',  totalScore: 81 },
    { studentId: 'p6', nickname: '王予乐',  totalScore: 78 },
  ];
  const all = [
    ...peers,
    { studentId: 'mock-self', nickname: '我', totalScore: myScore },
  ];
  all.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

  const top = all.map((p, idx) => ({
    rank: idx + 1,
    studentId: p.studentId,
    nickname: p.nickname,
    avatar: undefined,
    totalScore: p.totalScore,
    isMe: p.studentId === 'mock-self',
  }));
  const meRow = top.find((r) => r.isMe) ?? null;
  return { top, me: meRow, totalScored: top.length };
}

export function mockHistory(): HistoryItem[] {
  const list = mockAssignmentList();
  return list.map((a) => {
    const sub = cache[a.id];
    return {
      id: sub?.id ?? `sub-${a.id}`,
      status: sub?.status ?? 'DRAFT',
      totalScore: sub?.totalScore ?? null,
      submittedAt: sub?.submittedAt ?? null,
      scoredAt: sub?.scoredAt ?? null,
      assignmentId: a.id,
      homework: { id: a.homework.id, title: a.homework.title, type: a.homework.type },
    };
  });
}
