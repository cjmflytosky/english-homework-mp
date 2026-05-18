import { listAssignments } from '../../api/homework';
import { AssignmentSummary } from '../../api/types';
import { isLoggedIn } from '../../utils/auth';

interface TaskListData {
  list: AssignmentSummary[];
  loading: boolean;
}

const STATUS_LABEL: Record<AssignmentSummary['status'], string> = {
  PENDING: '未开始',
  IN_PROGRESS: '进行中',
  SUBMITTED: '已提交',
  EXPIRED: '已过期',
};

Page<TaskListData, Record<string, never>>({
  data: {
    list: [],
    loading: false,
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const list = await listAssignments();
      // 给 wxml 用的派生字段
      const decorated = list.map((a) => ({
        ...a,
        statusLabel: STATUS_LABEL[a.status] ?? a.status,
        typeLabel: a.homework.type === 'REPEAT' ? '跟读' : '背诵',
        endAtLabel: formatTime(a.endAt),
      }));
      this.setData({ list: decorated as unknown as AssignmentSummary[] });
    } catch (err) {
      console.warn('[task-list] load failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  goDetail(e: { currentTarget: { dataset: { id: string } } }) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/task-detail/index?id=${id}` });
  },
});

function formatTime(s: string): string {
  const d = new Date(s);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}
