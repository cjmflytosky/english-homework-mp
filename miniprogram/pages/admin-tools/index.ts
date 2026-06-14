/**
 * 学生管理（入口：teacher-home「学生管理」卡片）。
 *   - 默认展示全部学生，按加入时间倒序（最新在前），每页 20 条，上拉加载更多
 *   - 搜索（昵称 / 真实姓名 / 学号）
 *   - 改 role 升降级（仅 ADMIN，后端 assertAdmin 兜底）
 *   - 把学生加入班级
 *
 * 历史文件夹名 admin-tools 沿用，避免改动路由；对外标题为「学生管理」。
 */
import {
  searchStudents,
  updateStudentRole,
  addStudentsToClass,
  listClassesForTeacher,
  ClassStudentRow,
  TeacherClassRow,
} from '../../api/teacher';
import { getCurrentStudent } from '../../utils/auth';
import { StudentRole } from '../../api/types';

const PAGE_SIZE = 20;

const ROLE_LABELS: Record<StudentRole, string> = {
  STUDENT: '学生',
  TEACHER: '老师',
  ADMIN: '管理员',
};

const ROLE_OPTIONS: StudentRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];

type StudentRow = ClassStudentRow & { roleLabel: string };

interface StudentManageData {
  keyword: string;
  students: StudentRow[];
  classes: TeacherClassRow[];
  loading: boolean; // 首屏 / 刷新
  loadingMore: boolean; // 上拉加载下一页
  hasMore: boolean;
}

Page<StudentManageData, { selfId: string; page: number }>({
  data: {
    keyword: '',
    students: [],
    classes: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
  },

  selfId: '',
  page: 1,

  onLoad() {
    this.selfId = getCurrentStudent()?.id ?? '';
    void this.loadClasses();
    void this.refresh();
  },

  async loadClasses() {
    try {
      const classes = await listClassesForTeacher();
      this.setData({ classes });
    } catch (err) {
      console.warn('[student-manage] load classes failed', err);
    }
  },

  onKeywordInput(e: { detail: { value: string } }) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    void this.refresh();
  },

  /** 从第 1 页重新加载（首屏 / 搜索） */
  async refresh() {
    this.page = 1;
    this.setData({ loading: true });
    try {
      const list = await this.fetchPage(1);
      this.setData({ students: list, hasMore: list.length === PAGE_SIZE });
    } catch (err) {
      console.warn('[student-manage] refresh failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  async onReachBottom() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true });
    try {
      const next = this.page + 1;
      const list = await this.fetchPage(next);
      this.page = next;
      this.setData({
        students: this.data.students.concat(list),
        hasMore: list.length === PAGE_SIZE,
      });
    } catch (err) {
      console.warn('[student-manage] load more failed', err);
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  async fetchPage(page: number): Promise<StudentRow[]> {
    const kw = this.data.keyword.trim();
    const list = await searchStudents(kw, page, PAGE_SIZE);
    return list.map((s) => ({ ...s, roleLabel: ROLE_LABELS[s.role] }));
  },

  onChangeRole(e: { currentTarget: { dataset: { id: string } } }) {
    const studentId = e.currentTarget.dataset.id;
    if (studentId === this.selfId) {
      wx.showToast({ title: '不能修改自己的角色', icon: 'none' });
      return;
    }
    const student = this.data.students.find((s) => s.id === studentId);
    if (!student) return;

    wx.showActionSheet({
      itemList: ROLE_OPTIONS.map(
        (r) => `${ROLE_LABELS[r]}（当前：${student.roleLabel}）`,
      ),
      success: async (res: { tapIndex: number }) => {
        const newRole = ROLE_OPTIONS[res.tapIndex];
        if (newRole === student.role) return;
        try {
          await updateStudentRole(studentId, newRole);
          wx.showToast({ title: `已设为${ROLE_LABELS[newRole]}`, icon: 'success' });
          await this.refresh();
        } catch (err) {
          wx.showToast({
            title: err instanceof Error ? err.message : '修改失败',
            icon: 'none',
          });
        }
      },
    });
  },

  onAddToClass(e: { currentTarget: { dataset: { id: string } } }) {
    const studentId = e.currentTarget.dataset.id;
    if (this.data.classes.length === 0) {
      wx.showToast({ title: '没有可用班级', icon: 'none' });
      return;
    }
    wx.showActionSheet({
      itemList: this.data.classes.map((c) => `加入 ${c.name}`),
      success: async (res: { tapIndex: number }) => {
        const cls = this.data.classes[res.tapIndex];
        try {
          await addStudentsToClass(cls.id, [studentId]);
          wx.showToast({ title: `已加入 ${cls.name}`, icon: 'success' });
        } catch (err) {
          wx.showToast({
            title: err instanceof Error ? err.message : '添加失败',
            icon: 'none',
          });
        }
      },
    });
  },
});
