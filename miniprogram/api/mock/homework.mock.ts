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

// 单词卡片（配图打包在分包 pkgWordCard 内，用小程序本地路径）
const items3: HomeworkItem[] = [
  { id: 'item-3-1', orderNo: 1, text: '第七单元 · 1', imageUrl: '/pkgWordCard/images/unit7/57.jpg', score: 17 },
  { id: 'item-3-2', orderNo: 2, text: '第七单元 · 2', imageUrl: '/pkgWordCard/images/unit7/58.jpg', score: 17 },
  { id: 'item-3-3', orderNo: 3, text: '第七单元 · 3', imageUrl: '/pkgWordCard/images/unit7/59.jpg', score: 17 },
  { id: 'item-3-4', orderNo: 4, text: '第七单元 · 4', imageUrl: '/pkgWordCard/images/unit7/60.jpg', score: 17 },
  { id: 'item-3-5', orderNo: 5, text: '第七单元 · 5', imageUrl: '/pkgWordCard/images/unit7/61.jpg', score: 16 },
  { id: 'item-3-6', orderNo: 6, text: '第七单元 · 6', imageUrl: '/pkgWordCard/images/unit7/62.jpg', score: 16 },
];

// 长句作业（refAudioUrl 联调时填真实地址；留空则学生端提示未上传范读）
const items4: HomeworkItem[] = [
  {
    id: 'item-4-1',
    orderNo: 1,
    text: 'My family has four members and we love each other very much.',
    translation: '我家有四口人，我们彼此非常相爱。',
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
  {
    id: 'a3',
    startAt: new Date(NOW - 86400_000).toISOString(),
    endAt: new Date(NOW + 5 * 86400_000).toISOString(),
    status: 'IN_PROGRESS',
    homework: {
      id: 'hw3',
      title: 'Unit 1 单词卡片',
      type: 'WORD_CARD',
      totalScore: 100,
      itemCount: items3.length,
    },
  },
  {
    id: 'a4',
    startAt: new Date(NOW - 86400_000).toISOString(),
    endAt: new Date(NOW + 5 * 86400_000).toISOString(),
    status: 'IN_PROGRESS',
    homework: {
      id: 'hw4',
      title: '长句跟读 · My Family',
      type: 'SENTENCE',
      totalScore: 100,
      itemCount: items4.length,
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
  a3: {
    id: 'a3',
    startAt: summaries[2].startAt,
    endAt: summaries[2].endAt,
    status: 'IN_PROGRESS',
    homework: {
      id: 'hw3',
      title: 'Unit 1 单词卡片',
      description: '看图听范读，点击卡片跟读：范读 → 嘟 → 自动录音。',
      type: 'WORD_CARD',
      totalScore: 100,
      items: items3,
    },
  },
  a4: {
    id: 'a4',
    startAt: summaries[3].startAt,
    endAt: summaries[3].endAt,
    status: 'IN_PROGRESS',
    homework: {
      id: 'hw4',
      title: '长句跟读 · My Family',
      description: '听老师范读后跟读整句。',
      type: 'SENTENCE',
      totalScore: 100,
      items: items4,
    },
  },
};

export function mockAssignmentList(): AssignmentSummary[] {
  return summaries;
}

export function mockAssignmentDetail(id: string): AssignmentDetail | null {
  return details[id] ?? null;
}
