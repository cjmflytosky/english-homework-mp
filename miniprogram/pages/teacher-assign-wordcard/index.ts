/**
 * 老师端：布置单词跟读。
 * 单词卡片内容是预置的，老师只需「选一个单元 + 选班级 + 截止日期 → 派发」。
 */
import {
  listAssignableHomeworks,
  publishAssignment,
  listClassesForTeacher,
  AssignableHomeworkRow,
} from '../../api/teacher';

const DEFAULT_DUE_DAYS = 7;

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_DUE_DAYS);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

interface AssignData {
  loading: boolean;
  homeworks: AssignableHomeworkRow[];
  selectedId: string;
  classNames: string[];
  classIndex: number;
  endDate: string;
  publishing: boolean;
}

Page<AssignData, { classIds: string[] }>({
  data: {
    loading: false,
    homeworks: [],
    selectedId: '',
    classNames: [],
    classIndex: 0,
    endDate: defaultDueDate(),
    publishing: false,
  },

  classIds: [],

  onLoad() {
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const [homeworks, classes] = await Promise.all([
        listAssignableHomeworks('WORD_CARD'),
        listClassesForTeacher(),
      ]);
      this.classIds = classes.map((c) => c.id);
      this.setData({
        homeworks,
        classNames: classes.map((c) => c.name),
        classIndex: 0,
      });
    } catch (err) {
      console.warn('[assign-wordcard] load failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  onSelect(e: { currentTarget: { dataset: { id: string } } }) {
    this.setData({ selectedId: e.currentTarget.dataset.id });
  },

  onClassChange(e: { detail: { value: string } }) {
    this.setData({ classIndex: Number(e.detail.value) });
  },

  onEndDateChange(e: { detail: { value: string } }) {
    this.setData({ endDate: e.detail.value });
  },

  async onPublish() {
    if (!this.data.selectedId) {
      wx.showToast({ title: '请先选择作业', icon: 'none' });
      return;
    }
    const classId = this.classIds[this.data.classIndex];
    if (!classId) {
      wx.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    this.setData({ publishing: true });
    try {
      await publishAssignment({
        homeworkId: this.data.selectedId,
        classId,
        startAt: new Date().toISOString(),
        endAt: new Date(`${this.data.endDate}T23:59:59`).toISOString(),
      });
      wx.showToast({ title: '已派发', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '派发失败',
        icon: 'none',
      });
    } finally {
      this.setData({ publishing: false });
    }
  },
});
