import {
  AssignmentDetail,
  AssignmentSummary,
  HomeworkItem,
} from '../types';

const NOW = Date.now();

const items1: HomeworkItem[] = [
  {
    id: 'item-1-1',
    orderNo: 1,
    text: 'Hello, my name is Tom. Nice to meet you.',
    translation: '你好，我叫汤姆，很高兴认识你。',
    score: 33,
  },
  {
    id: 'item-1-2',
    orderNo: 2,
    text: 'I am a student. I am in Grade Three.',
    translation: '我是一名学生，我在三年级。',
    score: 33,
  },
  {
    id: 'item-1-3',
    orderNo: 3,
    text: 'How are you today? I am fine, thank you.',
    translation: '今天你好吗？我很好，谢谢。',
    score: 34,
  },
];

const items2: HomeworkItem[] = [
  {
    id: 'item-2-1',
    orderNo: 1,
    text:
      'My family has four members: my father, my mother, my sister and me. We love each other very much.',
    translation: '我的家有四口人：爸爸、妈妈、姐姐和我。我们非常相爱。',
    score: 100,
  },
];

const summaries: AssignmentSummary[] = [
  {
    id: 'a1',
    startAt: new Date(NOW - 86400_000).toISOString(),
    endAt: new Date(NOW + 86400_000).toISOString(),
    status: 'IN_PROGRESS',
    homework: {
      id: 'hw1',
      title: 'Unit 1 Greetings 跟读',
      type: 'REPEAT',
      totalScore: 100,
      itemCount: items1.length,
    },
  },
  {
    id: 'a2',
    startAt: new Date(NOW - 2 * 86400_000).toISOString(),
    endAt: new Date(NOW + 3 * 86400_000).toISOString(),
    status: 'IN_PROGRESS',
    homework: {
      id: 'hw2',
      title: 'Unit 2 The Family 背诵',
      type: 'RECITE',
      totalScore: 100,
      itemCount: items2.length,
    },
  },
];

const details: Record<string, AssignmentDetail> = {
  a1: {
    id: 'a1',
    startAt: summaries[0].startAt,
    endAt: summaries[0].endAt,
    status: 'IN_PROGRESS',
    homework: {
      id: 'hw1',
      title: 'Unit 1 Greetings 跟读',
      description: '听音频后逐句跟读，注意发音与语调。',
      type: 'REPEAT',
      totalScore: 100,
      items: items1,
    },
  },
  a2: {
    id: 'a2',
    startAt: summaries[1].startAt,
    endAt: summaries[1].endAt,
    status: 'IN_PROGRESS',
    homework: {
      id: 'hw2',
      title: 'Unit 2 The Family 背诵',
      description: '熟读后背诵下文。',
      type: 'RECITE',
      totalScore: 100,
      items: items2,
    },
  },
};

export function mockAssignmentList(): AssignmentSummary[] {
  return summaries;
}

export function mockAssignmentDetail(id: string): AssignmentDetail | null {
  return details[id] ?? null;
}
