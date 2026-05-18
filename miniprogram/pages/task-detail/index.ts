import { getAssignmentDetail } from '../../api/homework';
import { AssignmentDetail } from '../../api/types';

interface TaskDetailData {
  detail: (AssignmentDetail & { typeLabel: string; endAtLabel: string }) | null;
  loading: boolean;
}

Page<TaskDetailData, Record<string, never>>({
  data: { detail: null, loading: false },

  onLoad(query: Record<string, string | undefined>) {
    const id = query.id;
    if (!id) {
      wx.showToast({ title: '缺少作业 ID', icon: 'none' });
      wx.navigateBack();
      return;
    }
    void this.load(id);
  },

  async load(id: string) {
    this.setData({ loading: true });
    try {
      const d = await getAssignmentDetail(id);
      const decorated = {
        ...d,
        typeLabel: d.homework.type === 'REPEAT' ? '跟读' : '背诵',
        endAtLabel: new Date(d.endAt).toLocaleString(),
      };
      this.setData({ detail: decorated });
      wx.setNavigationBarTitle({ title: d.homework.title });
    } catch (err) {
      console.warn('[task-detail] load failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  goItem(e: { currentTarget: { dataset: { idx: number } } }) {
    if (!this.data.detail) return;
    const { idx } = e.currentTarget.dataset;
    // 把整个详情通过页面级缓存传给子页（避免再发一次请求）
    const items = this.data.detail.homework.items;
    wx.setStorageSync('current_task_items', items);
    wx.setStorageSync('current_task_meta', {
      assignmentId: this.data.detail.id,
      homeworkTitle: this.data.detail.homework.title,
      type: this.data.detail.homework.type,
    });
    wx.navigateTo({ url: `/pages/task-content/index?idx=${idx}` });
  },
});
