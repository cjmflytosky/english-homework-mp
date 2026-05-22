import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemScoreStatus,
  Prisma,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SpeechService } from '../speech/speech.service';
import { UploadItemDto } from './dto/upload-item.dto';

@Injectable()
export class SubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly speech: SpeechService,
  ) {}

  /**
   * 提交某一题录音并触发评分；同一题再次提交会覆盖（重录）。
   * 流程：
   *   1) 校验 assignment + item 属于学生班级
   *   2) upsert Submission（若不存在则 DRAFT）
   *   3) 调 SpeechService 评分
   *   4) upsert SubmissionItem 写入分数
   */
  async uploadAndScoreItem(dto: UploadItemDto, studentId: string) {
    const { assignment, homeworkItem } = await this.assertOwnership(
      dto.assignmentId,
      dto.homeworkItemId,
      studentId,
    );
    if (!homeworkItem) throw new BadRequestException('题目不存在');

    // 触发评分（mock SOE）
    const evalRes = await this.speech.evaluate({
      audioUrl: dto.audioUrl,
      refText: homeworkItem.text,
      type: assignment.homework.type,
    });

    // 用事务保证一致：先确保 Submission 存在，再 upsert 单题
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.submission.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId: dto.assignmentId,
            studentId,
          },
        },
        create: {
          assignmentId: dto.assignmentId,
          studentId,
          status: SubmissionStatus.DRAFT,
        },
        update: {
          // 重新作答后回到 DRAFT，等学生点「整体提交」
          status: SubmissionStatus.DRAFT,
        },
      });

      const item = await tx.submissionItem.upsert({
        where: {
          submissionId_homeworkItemId: {
            submissionId: submission.id,
            homeworkItemId: dto.homeworkItemId,
          },
        },
        create: {
          submissionId: submission.id,
          homeworkItemId: dto.homeworkItemId,
          audioUrl: dto.audioUrl,
          duration: dto.duration,
          status: ItemScoreStatus.DONE,
          score: evalRes.score,
          fluency: evalRes.fluency,
          integrity: evalRes.integrity,
          pronunciation: evalRes.pronunciation,
          rawScoreJson: evalRes.raw as Prisma.InputJsonValue,
        },
        update: {
          audioUrl: dto.audioUrl,
          duration: dto.duration,
          status: ItemScoreStatus.DONE,
          score: evalRes.score,
          fluency: evalRes.fluency,
          integrity: evalRes.integrity,
          pronunciation: evalRes.pronunciation,
          rawScoreJson: evalRes.raw as Prisma.InputJsonValue,
          errorMessage: null,
        },
      });

      return { submissionId: submission.id, item };
    });
  }

  /**
   * 学生整体提交，把所有 SubmissionItem 加权平均计算总分。
   */
  async finalize(assignmentId: string, studentId: string) {
    const { assignment } = await this.assertOwnership(
      assignmentId,
      undefined,
      studentId,
    );

    const submission = await this.prisma.submission.findUnique({
      where: {
        assignmentId_studentId: { assignmentId, studentId },
      },
      include: {
        items: {
          include: { homeworkItem: true },
        },
      },
    });
    if (!submission) {
      throw new BadRequestException('尚未录制任何一题');
    }

    const items = submission.items;
    const homeworkItems = await this.prisma.homeworkItem.findMany({
      where: { homeworkId: assignment.homeworkId },
      select: { id: true, score: true },
    });
    if (items.length < homeworkItems.length) {
      throw new BadRequestException(
        `还有 ${homeworkItems.length - items.length} 题未录制，无法整体提交`,
      );
    }

    // 加权平均（按 homeworkItem.score 权重）
    const weightTotal = homeworkItems.reduce((s, i) => s + (i.score || 0), 0) || items.length;
    const sum = items.reduce((acc, it) => {
      const w = it.homeworkItem.score || 1;
      acc.score += (it.score ?? 0) * w;
      acc.fluency += (it.fluency ?? 0) * w;
      acc.integrity += (it.integrity ?? 0) * w;
      acc.pronunciation += (it.pronunciation ?? 0) * w;
      return acc;
    }, { score: 0, fluency: 0, integrity: 0, pronunciation: 0 });

    const totalScore = round(sum.score / weightTotal);
    const fluency = round(sum.fluency / weightTotal);
    const integrity = round(sum.integrity / weightTotal);
    const pronunciation = round(sum.pronunciation / weightTotal);

    const now = new Date();
    return this.prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.SCORED,
        totalScore,
        fluency,
        integrity,
        pronunciation,
        submittedAt: now,
        scoredAt: now,
      },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * 学生查看自己在某次作业上的提交进度 + 已评分明细。
   * 阶段 5：附带老师点评（若已写过）。
   */
  async getMyByAssignment(assignmentId: string, studentId: string) {
    await this.assertOwnership(assignmentId, undefined, studentId);
    const submission = await this.prisma.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        comment: {
          include: {
            author: { select: { id: true, name: true } },
          },
        },
      },
    });
    return submission; // 允许为 null
  }

  // ================================================================
  // 阶段 5：老师点评
  // ================================================================

  /** 老师写点评（覆盖式：同一 submission 只保留最新一条） */
  async upsertComment(
    submissionId: string,
    authorId: string,
    content: string,
  ) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true },
    });
    if (!sub) throw new NotFoundException('提交不存在');

    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException('点评内容不能为空');

    return this.prisma.teacherComment.upsert({
      where: { submissionId },
      create: { submissionId, authorId, content: trimmed },
      update: { content: trimmed, authorId },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  /** 老师删除点评（可选；后台先不暴露按钮也能用） */
  async deleteComment(submissionId: string) {
    const existing = await this.prisma.teacherComment.findUnique({
      where: { submissionId },
      select: { id: true },
    });
    if (!existing) return { deleted: false };
    await this.prisma.teacherComment.delete({ where: { submissionId } });
    return { deleted: true };
  }

  // ================================================================
  // 阶段 4：教师批改面板（只读） / 班级排名 / 学生历史
  // ================================================================

  /** 教师视角：某次发布作业的提交总览（按总分降序） */
  async listForAdminByAssignment(assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        class: { select: { id: true, name: true } },
        homework: { select: { id: true, title: true, type: true } },
      },
    });
    if (!assignment) throw new NotFoundException('作业不存在');

    const [members, submissions] = await this.prisma.$transaction([
      this.prisma.classMember.findMany({
        where: { classId: assignment.classId },
        include: {
          student: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
              realName: true,
              studentNo: true,
            },
          },
        },
      }),
      this.prisma.submission.findMany({
        where: { assignmentId },
        select: {
          id: true,
          studentId: true,
          status: true,
          totalScore: true,
          fluency: true,
          integrity: true,
          pronunciation: true,
          submittedAt: true,
          scoredAt: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    const subByStudent = new Map(submissions.map((s) => [s.studentId, s]));
    const rows = members.map((m) => {
      const sub = subByStudent.get(m.studentId);
      return {
        student: m.student,
        submissionId: sub?.id ?? null,
        status: sub?.status ?? null,    // null = 未开始
        totalScore: sub?.totalScore ?? null,
        fluency: sub?.fluency ?? null,
        integrity: sub?.integrity ?? null,
        pronunciation: sub?.pronunciation ?? null,
        scoredItemCount: sub?._count.items ?? 0,
        submittedAt: sub?.submittedAt ?? null,
      };
    });

    // 已评分的排前面，按总分降序；其它按学号
    rows.sort((a, b) => {
      const sa = a.totalScore ?? -1;
      const sb = b.totalScore ?? -1;
      if (sa !== sb) return sb - sa;
      return (a.student.studentNo ?? '').localeCompare(b.student.studentNo ?? '');
    });

    return { assignment, rows };
  }

  /** 教师视角：单次提交详情（含每题录音 URL 与老师点评） */
  async getAdminSubmission(submissionId: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            realName: true,
            studentNo: true,
          },
        },
        assignment: {
          include: {
            homework: {
              include: { items: { orderBy: { orderNo: 'asc' } } },
            },
          },
        },
        items: true,
        comment: {
          include: {
            author: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('提交不存在');

    const itemByHwId = new Map(sub.items.map((i) => [i.homeworkItemId, i]));
    const merged = sub.assignment.homework.items.map((hwItem) => ({
      ...hwItem,
      submission: itemByHwId.get(hwItem.id) ?? null,
    }));

    return {
      id: sub.id,
      status: sub.status,
      totalScore: sub.totalScore,
      fluency: sub.fluency,
      integrity: sub.integrity,
      pronunciation: sub.pronunciation,
      submittedAt: sub.submittedAt,
      scoredAt: sub.scoredAt,
      student: sub.student,
      homework: {
        id: sub.assignment.homework.id,
        title: sub.assignment.homework.title,
        type: sub.assignment.homework.type,
        items: merged,
      },
      comment: sub.comment
        ? {
            id: sub.comment.id,
            content: sub.comment.content,
            updatedAt: sub.comment.updatedAt,
            author: sub.comment.author,
          }
        : null,
    };
  }

  /** 教师视角：某次作业的统计指标 */
  async getAssignmentStats(assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, classId: true },
    });
    if (!assignment) throw new NotFoundException('作业不存在');

    const [memberCount, submissions] = await this.prisma.$transaction([
      this.prisma.classMember.count({ where: { classId: assignment.classId } }),
      this.prisma.submission.findMany({
        where: { assignmentId },
        select: { status: true, totalScore: true },
      }),
    ]);

    const submittedCount = submissions.filter(
      (s) => s.status === SubmissionStatus.SUBMITTED || s.status === SubmissionStatus.SCORED,
    ).length;
    const scoredCount = submissions.filter((s) => s.status === SubmissionStatus.SCORED).length;
    const scored = submissions.filter((s) => s.totalScore != null);
    const avgScore =
      scored.length === 0
        ? null
        : round(
            scored.reduce((acc, s) => acc + (s.totalScore ?? 0), 0) / scored.length,
          );

    // 分数段分布（0~59 / 60~69 / 70~79 / 80~89 / 90~100）
    const buckets = [0, 0, 0, 0, 0];
    scored.forEach((s) => {
      const v = s.totalScore ?? 0;
      const idx = v < 60 ? 0 : v < 70 ? 1 : v < 80 ? 2 : v < 90 ? 3 : 4;
      buckets[idx] += 1;
    });

    return {
      memberCount,
      submittedCount,
      scoredCount,
      avgScore,
      buckets, // [0-59, 60-69, 70-79, 80-89, 90-100]
    };
  }

  /** 学生视角：班级排名（同一作业内） */
  async getAssignmentRanking(assignmentId: string, studentId: string) {
    await this.assertOwnership(assignmentId, undefined, studentId);

    const submissions = await this.prisma.submission.findMany({
      where: { assignmentId, status: SubmissionStatus.SCORED, totalScore: { not: null } },
      orderBy: { totalScore: 'desc' },
      include: {
        student: { select: { id: true, nickname: true, avatar: true, realName: true } },
      },
    });

    const rows = submissions.map((s, idx) => ({
      rank: idx + 1,
      studentId: s.studentId,
      nickname: s.student.realName || s.student.nickname || '同学',
      avatar: s.student.avatar,
      totalScore: s.totalScore,
      isMe: s.studentId === studentId,
    }));

    const myRow = rows.find((r) => r.isMe) ?? null;
    return {
      top: rows.slice(0, 20), // 前 20 名
      me: myRow,
      totalScored: rows.length,
    };
  }

  /** 学生视角：我的提交历史（分页） */
  async listMyHistory(studentId: string, page: number, pageSize: number) {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.submission.count({ where: { studentId } }),
      this.prisma.submission.findMany({
        where: { studentId },
        orderBy: [{ scoredAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          totalScore: true,
          submittedAt: true,
          scoredAt: true,
          assignment: {
            select: {
              id: true,
              homework: { select: { id: true, title: true, type: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        status: r.status,
        totalScore: r.totalScore,
        submittedAt: r.submittedAt,
        scoredAt: r.scoredAt,
        assignmentId: r.assignment.id,
        homework: r.assignment.homework,
      })),
      meta: { total, page, pageSize },
    };
  }

  // ---------------------------------------------------------------

  private async assertOwnership(
    assignmentId: string,
    homeworkItemId: string | undefined,
    studentId: string,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { homework: { select: { id: true, type: true } } },
    });
    if (!assignment) throw new NotFoundException('作业不存在');

    const member = await this.prisma.classMember.findUnique({
      where: {
        classId_studentId: { classId: assignment.classId, studentId },
      },
    });
    if (!member) throw new ForbiddenException('当前学生不属于该作业的班级');

    let homeworkItem;
    if (homeworkItemId) {
      homeworkItem = await this.prisma.homeworkItem.findUnique({
        where: { id: homeworkItemId },
      });
      if (!homeworkItem || homeworkItem.homeworkId !== assignment.homeworkId) {
        throw new BadRequestException('题目与作业不匹配');
      }
    }
    return { assignment, homeworkItem };
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
