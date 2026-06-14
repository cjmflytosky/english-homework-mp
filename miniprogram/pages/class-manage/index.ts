/**
 * 班级管理（仅 ADMIN）：新建 / 编辑 / 删除班级。
 * 入口：teacher-home 管理员卡片「班级管理」。
 *
 * 后端接口：
 *   GET    /admin/classes        列表
 *   POST   /admin/classes        新建
 *   PATCH  /admin/classes/:id    修改
 *   DELETE /admin/classes/:id    删除（默认班 / 有学生或作业的班不可删）
 */
import {
  listClassesForTeacher,
  createClass,
  updateClass,
  deleteClass,
  TeacherClassRow,
} from '../../api/teacher';
import { getCurrentStudent } from '../../utils/auth';

interface ClassManageData {
  loading: boolean;
  classes: TeacherClassRow[];
  showForm: boolean;
  editingId: string;
  formTitle: string;
  form: { name: string; grade: string; remark: string };
  submitting: boolean;
}

Page<ClassManageData, Record<string, never>>({
  data: {
    loading: false,
    classes: [],
    showForm: false,
    editingId: '',
    formTitle: '',
    form: { name: '', grade: '', remark: '' },
    submitting: false,
  },

  onShow() {
    // 自我保护：非管理员不应进来
    if (getCurrentStudent()?.role !== 'ADMIN') {
      wx.showToast({ title: '仅管理员可访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const classes = await listClassesForTeacher();
      this.setData({ classes });
    } catch (err) {
      console.warn('[class-manage] load failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  openCreate() {
    this.setData({
      showForm: true,
      editingId: '',
      formTitle: '新建班级',
      form: { name: '', grade: '', remark: '' },
    });
  },

  openEdit(e: { currentTarget: { dataset: { id: string } } }) {
    const cls = this.data.classes.find(
      (c) => c.id === e.currentTarget.dataset.id,
    );
    if (!cls) return;
    this.setData({
      showForm: true,
      editingId: cls.id,
      formTitle: '编辑班级',
      form: { name: cls.name, grade: cls.grade ?? '', remark: cls.remark ?? '' },
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  /** 阻止点表单内部时穿透到遮罩关闭 */
  noop() {},

  onNameInput(e: { detail: { value: string } }) {
    this.setData({ form: { ...this.data.form, name: e.detail.value } });
  },
  onGradeInput(e: { detail: { value: string } }) {
    this.setData({ form: { ...this.data.form, grade: e.detail.value } });
  },
  onRemarkInput(e: { detail: { value: string } }) {
    this.setData({ form: { ...this.data.form, remark: e.detail.value } });
  },

  async submitForm() {
    if (this.data.submitting) return;
    const name = this.data.form.name.trim();
    if (!name) {
      wx.showToast({ title: '请填写班级名称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    const payload = {
      name,
      grade: this.data.form.grade.trim() || undefined,
      remark: this.data.form.remark.trim() || undefined,
    };
    try {
      if (this.data.editingId) {
        await updateClass(this.data.editingId, payload);
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        await createClass(payload);
        wx.showToast({ title: '已创建', icon: 'success' });
      }
      this.setData({ showForm: false });
      await this.load();
    } catch (err) {
      // request.ts 已统一弹 toast
      console.warn('[class-manage] submit failed', err);
    } finally {
      this.setData({ submitting: false });
    }
  },

  onDelete(e: { currentTarget: { dataset: { id: string; name: string } } }) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除班级',
      content: `确定删除「${name}」？班级内有学生或作业时不可删除。`,
      confirmText: '删除',
      confirmColor: '#ff3d6b',
      success: async (res: { confirm: boolean }) => {
        if (!res.confirm) return;
        try {
          await deleteClass(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.load();
        } catch (err) {
          console.warn('[class-manage] delete failed', err);
        }
      },
    });
  },
});
