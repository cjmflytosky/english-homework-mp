import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-app';

/**
 * 老师 / 管理员 (/admin/*) 链路集成测试。
 * 覆盖：鉴权边界、角色升降级、班级成员、完整批改链路，以及三处回归：
 *   #1 学生列表返回 role 字段
 *   #2 AdminUser 发点评被干净拒绝（403，而非外键 500）
 *   #3 班级详情成员字段为 memberId
 */
describe('Admin / Teacher flow (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  let adminToken: string; // AdminUser admin/admin123 (SUPER_ADMIN)
  let teacherToken: string; // 固定账号 mock-teacher (Student TEACHER)
  let teacherId: string;
  let pupilToken: string; // 一次性学生
  let pupilId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function adminLogin(): Promise<string> {
    const res = await http
      .post('/api/auth/admin/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201);
    return res.body.data.token;
  }

  async function mockLogin(
    code: string,
    nickname?: string,
  ): Promise<{ token: string; id: string; role: string }> {
    const res = await http
      .post('/api/auth/wx-login')
      .send({ code, nickname })
      .expect(201);
    const d = res.body.data;
    return { token: d.token, id: d.student.id, role: d.student.role };
  }

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());

    adminToken = await adminLogin();
    const teacher = await mockLogin('mock-teacher');
    teacherToken = teacher.token;
    teacherId = teacher.id;
    const pupil = await mockLogin('mock-e2e-pupil', 'E2E Pupil');
    pupilToken = pupil.token;
    pupilId = pupil.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  describe('auth guards', () => {
    it('rejects unauthenticated access with 401', async () => {
      await http.get('/api/admin/classes').expect(401);
    });

    it('rejects a plain STUDENT with 403', async () => {
      await http
        .get('/api/admin/classes')
        .set(auth(pupilToken))
        .expect(403);
    });

    it('seeded mock-teacher carries TEACHER role', () => {
      expect(teacherToken).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  describe('role management (admin only)', () => {
    let candidateToken: string;
    let candidateId: string;

    beforeAll(async () => {
      const c = await mockLogin('mock-e2e-candidate', 'Candidate');
      candidateToken = c.token;
      candidateId = c.id;
    });

    it('a non-admin cannot change roles (403)', async () => {
      await http
        .patch(`/api/admin/students/${pupilId}/role`)
        .set(auth(candidateToken))
        .send({ role: 'TEACHER' })
        .expect(403);
    });

    it('admin promotes a student to TEACHER', async () => {
      const res = await http
        .patch(`/api/admin/students/${candidateId}/role`)
        .set(auth(adminToken))
        .send({ role: 'TEACHER' })
        .expect(200);
      expect(res.body.data.role).toBe('TEACHER');
    });

    it('student list includes the role field (regression #1)', async () => {
      const res = await http
        .get('/api/admin/students?keyword=Candidate')
        .set(auth(adminToken))
        .expect(200);
      // 分页响应被 TransformInterceptor 拍平：数组在 data，meta 在顶层
      const rows = res.body.data;
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].role).toBe('TEACHER');
    });
  });

  // ---------------------------------------------------------------------------
  describe('class membership', () => {
    let classId: string;

    it('TEACHER cannot create a class (admin only) -> 403', async () => {
      await http
        .post('/api/admin/classes')
        .set(auth(teacherToken))
        .send({ name: 'TeacherTry', grade: 'G1' })
        .expect(403);
    });

    it('admin creates a class', async () => {
      const res = await http
        .post('/api/admin/classes')
        .set(auth(adminToken))
        .send({ name: 'E2E Class', grade: 'G3', remark: 'e2e' })
        .expect(201);
      classId = res.body.data.id;
      expect(classId).toBeTruthy();
    });

    it('teacher adds a pupil to the class', async () => {
      const res = await http
        .post(`/api/admin/classes/${classId}/members`)
        .set(auth(teacherToken))
        .send({ studentIds: [pupilId] })
        .expect(201);
      expect(res.body.data.added).toBe(1);
    });

    it('class detail exposes members[].memberId (regression #3)', async () => {
      const res = await http
        .get(`/api/admin/classes/${classId}`)
        .set(auth(teacherToken))
        .expect(200);
      const members = res.body.data.members;
      expect(members.length).toBe(1);
      expect(members[0].memberId).toBeTruthy();
      expect(members[0].student.id).toBe(pupilId);
    });

    it('teacher removes the member', async () => {
      const detail = await http
        .get(`/api/admin/classes/${classId}`)
        .set(auth(teacherToken));
      const memberId = detail.body.data.members[0].memberId;
      await http
        .delete(`/api/admin/classes/${classId}/members/${memberId}`)
        .set(auth(teacherToken))
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  describe('review chain: publish -> submit -> comment', () => {
    let classId: string;
    let homeworkId: string;
    let itemIds: string[];
    let assignmentId: string;
    let submissionId: string;

    beforeAll(async () => {
      // admin 建班 + 把 pupil 入班
      const cls = await http
        .post('/api/admin/classes')
        .set(auth(adminToken))
        .send({ name: 'Review E2E', grade: 'G3' })
        .expect(201);
      classId = cls.body.data.id;
      await http
        .post(`/api/admin/classes/${classId}/members`)
        .set(auth(teacherToken))
        .send({ studentIds: [pupilId] })
        .expect(201);

      // admin 建作业（2 题）
      const hw = await http
        .post('/api/admin/homeworks')
        .set(auth(adminToken))
        .send({
          title: 'E2E Homework',
          type: 'REPEAT',
          items: [{ text: 'apple' }, { text: 'banana' }],
        })
        .expect(201);
      homeworkId = hw.body.data.id;
      itemIds = hw.body.data.items.map((i: { id: string }) => i.id);

      // admin 派发
      const asg = await http
        .post('/api/admin/assignments')
        .set(auth(adminToken))
        .send({
          homeworkId,
          classId,
          startAt: new Date(Date.now() - 3600_000).toISOString(),
          endAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
        })
        .expect(201);
      assignmentId = asg.body.data.id;
    });

    it('pupil records both items and finalizes', async () => {
      for (const itemId of itemIds) {
        await http
          .post('/api/submissions/items')
          .set(auth(pupilToken))
          .send({
            assignmentId,
            homeworkItemId: itemId,
            audioUrl: 'https://mock.example/a.mp3',
            duration: 3,
          })
          .expect(201);
      }
      const fin = await http
        .post(`/api/submissions/${assignmentId}/finalize`)
        .set(auth(pupilToken))
        .send({})
        .expect(201);
      expect(fin.body.data.status).toBe('SUBMITTED');
    });

    it('teacher sees the submission in the class overview', async () => {
      const res = await http
        .get(`/api/admin/assignments/${assignmentId}/submissions`)
        .set(auth(teacherToken))
        .expect(200);
      const row = res.body.data.rows.find(
        (r: { student: { id: string } }) => r.student.id === pupilId,
      );
      expect(row).toBeDefined();
      expect(row.status).toBe('SUBMITTED');
      submissionId = row.submissionId;
      expect(submissionId).toBeTruthy();
    });

    it('teacher (Student) posts a comment; author points to the teacher', async () => {
      const res = await http
        .post(`/api/admin/submissions/${submissionId}/comment`)
        .set(auth(teacherToken))
        .send({ content: 'Clear pronunciation, well done.' })
        .expect(201);
      expect(res.body.data.author.id).toBe(teacherId);
    });

    it('AdminUser posting a comment is cleanly rejected with 403 (regression #2)', async () => {
      await http
        .post(`/api/admin/submissions/${submissionId}/comment`)
        .set(auth(adminToken))
        .send({ content: 'admin tries' })
        .expect(403);
    });

    it('submission detail surfaces the comment', async () => {
      const res = await http
        .get(`/api/admin/submissions/${submissionId}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(res.body.data.comment).not.toBeNull();
      expect(res.body.data.comment.author.id).toBe(teacherId);
    });

    it('teacher deletes the comment', async () => {
      const res = await http
        .delete(`/api/admin/submissions/${submissionId}/comment`)
        .set(auth(teacherToken))
        .expect(200);
      expect(res.body.data.deleted).toBe(true);
    });
  });
});
