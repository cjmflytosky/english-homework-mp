/**
 * 班级学生名单（入口：teacher-home「我管理的班级」点某个班级）。
 *   - 展示该班级全部学生
 *   - 可把学生移出本班（不删除账号；老师 / 管理员可操作）
 */
import {
  getClassDetail,
  removeMemberFromClass,
  ClassDetail,
} from '../../api/teacher';
import { StudentRole } from '../../api/types';

const ROLE_LABELS: Record<StudentRole, string> = {
  STUDENT: '学生',
  TEACHER: '老师',
  ADMIN: '管理员',
};

type MemberRow = ClassDetail['members'][number] & { roleLabel: string };

interface ClassStudentsData {
  loading: boolean;
  classId: string;
  className: string;
  grade: string;
  inviteCode: string;
  members: MemberRow[];
}

Page<ClassStudentsData, Record<string, never>>({
  data: {
    loading: false,
    classId: '',
    className: '',
    grade: '',
    inviteCode: '',
    members: [],
  },

  onLoad(query: Record<string, string | undefined>) {
    const classId = query.classId ?? '';
    if (!classId) {
      wx.showToast({ title: '缺少班级参数', icon: 'none' });
      return;
    }
    this.setData({
      classId,
      className: query.name ? decodeURIComponent(query.name) : '',
    });
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const detail = await getClassDetail(this.data.classId);
      this.setData({
        className: detail.name,
        grade: detail.grade ?? '',
        inviteCode: detail.inviteCode,
        members: detail.members.map((m) => ({
          ...m,
          roleLabel: ROLE_LABELS[m.student.role],
        })),
      });
      wx.setNavigationBarTitle({ title: detail.name });
    } catch (err) {
      console.warn('[class-students] load failed', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  onRemove(e: {
    currentTarget: { dataset: { memberid: string; name: string } };
  }) {
    const { memberid, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '移出班级',
      content: `把「${name}」移出本班？（不会删除该学生账号）`,
      confirmText: '移出',
      confirmColor: '#ff3d6b',
      success: async (res: { confirm: boolean }) => {
        if (!res.confirm) return;
        try {
          await removeMemberFromClass(this.data.classId, memberid);
          wx.showToast({ title: '已移出', icon: 'success' });
          await this.load();
        } catch (err) {
          console.warn('[class-students] remove failed', err);
        }
      },
    });
  },
});
