import { listMyHistory } from '../../api/submission';
import { HistoryItem } from '../../api/types';
import { isLoggedIn } from '../../utils/auth';

interface HistoryData {
  list: Array<HistoryItem & { typeLabel: string; statusLabel: string; whenLabel: string }>;
  loading: boolean;
}

const STATUS_LABEL: Record<HistoryItem['status'], string> = {
  DRAFT: '进行中',
  SUBMITTED: '已提交',
  SCORED: '已评分',
};

Page<HistoryData, Record<string, never>>({
  data: { list: [], loading: false },

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
      const rows = await listMyHistory(1, 50);
      const decorated = rows.map((r) => ({
        ...r,
        typeLabel: r.homework.type === 'REPEAT' ? '跟读' : '背诵',
        statusLabel: STATUS_LABEL[r.status],
        whenLabel: r.scoredAt
          ? new Date(r.scoredAt).toLocaleString()
          : r.submittedAt
            ? new Date(r.submittedAt).toLocaleString()
            : '—',
      }));
      this.setData({ list: decorated });
    } catch (err) {
      console.warn('[history] failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  goResult(e: { currentTarget: { dataset: { id: string } } }) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/submit-result/index?id=${id}` });
  },
});
