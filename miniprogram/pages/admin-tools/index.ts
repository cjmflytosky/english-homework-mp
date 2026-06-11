/**
 * 管理员工具页（仅 ADMIN 可见）：
 *   - 搜索学生（按昵称/真名/学号关键词）
 *   - 修改学生 role（升降级）
 *   - 把学生加入班级
 *
 * 入口：teacher-home 顶部的「管理员工具」卡片
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

interface AdminToolsData {
  keyword: string;
  searching: boolean;
  students: Array<ClassStudentRow & { roleLabel: string }>;
  classes: TeacherClassRow[];
  /** 给"加入班级"选 picker 用 */
  classNames: string[];
}

const ROLE_LABELS: Record<StudentRole, string> = {
  STUDENT: '学生',
  TEACHER: '老师',
  ADMIN: '管理员',
};

const ROLE_OPTIONS: StudentRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];

Page<AdminToolsData, { selfId: string }>({
  data: {
    keyword: '',
    searching: false,
    students: [],
    classes: [],
    classNames: [],
  },

  selfId: '',

  onLoad() {
    this.selfId = getCurrentStudent()?.id ?? '';
    void this.loadClasses();
  },

  async loadClasses() {
    try {
      const classes = await listClassesForTeacher();
      this.setData({
        classes,
        classNames: classes.map((c) => c.name),
      });
    } catch (err) {
      console.warn('[admin-tools] load classes failed', err);
    }
  },

  onKeywordInput(e: { detail: { value: string } }) {
    this.setData({ keyword: e.detail.value });
  },

  async onSearch() {
    const kw = this.data.keyword.trim();
    if (!kw) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    this.setData({ searching: true });
    try {
      const list = await searchStudents(kw);
      this.setData({
        students: list.map((s) => ({ ...s, roleLabel: ROLE_LABELS[s.role] })),
      });
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '搜索失败',
        icon: 'none',
      });
    } finally {
      this.setData({ searching: false });
    }
  },

  onChangeRole(e: { currentTarget: { dataset: { id: string } } }) {
    const studentId = e.currentTarget.dataset.id;
    if (studentId === this.selfId) {
      wx.showToast({ title: '不能修改自己的角色', icon: 'none' });
      return;
    }
    const student = this.data.students.find((s: ClassStudentRow & { roleLabel: string }) => s.id === studentId);
    if (!student) return;

    wx.showActionSheet({
      itemList: ROLE_OPTIONS.map((r) => `${ROLE_LABELS[r]}（当前：${student.roleLabel}）`),
      success: async (res: { tapIndex: number }) => {
        const newRole = ROLE_OPTIONS[res.tapIndex];
        if (newRole === student.role) return;
        try {
          await updateStudentRole(studentId, newRole);
          wx.showToast({ title: `已设为${ROLE_LABELS[newRole]}`, icon: 'success' });
          // 刷新搜索结果
          await this.onSearch();
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
      itemList: this.data.classes.map((c: TeacherClassRow) => `加入 ${c.name}`),
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
