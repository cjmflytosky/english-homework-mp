import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemScoreStatus,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadItemDto } from './dto/upload-item.dto';

@Injectable()
export class SubmissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 提交某一题录音；同一题再次提交会覆盖（重录）。
   *
   * MVP 阶段不做自动评分（SOE 已下线），仅持久化录音 URL。
   * 老师在小程序内通过 TeacherComment 给文字点评。
   */
  async uploadAndScoreItem(dto: UploadItemDto, studentId: string) {
    const { homeworkItem } = await this.assertOwnership(
      dto.assignmentId,
      dto.homeworkItemId,
      studentId,
    );
    if (!homeworkItem) throw new BadRequestException('题目不存在');

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
          // 不评分，直接标 DONE 表示「录音已收」
          status: ItemScoreStatus.DONE,
        },
        update: {
          audioUrl: dto.audioUrl,
          duration: dto.duration,
          status: ItemScoreStatus.DONE,
          errorMessage: null,
        },
      });

      return { submissionId: submission.id, item };
    });
  }

  /**
   * 学生整体提交：检查所有题录满 → 标记为 SUBMITTED → 等老师点评。
   *
   * MVP 阶段不再计算总分（SOE 已下线），状态不会进入 SCORED；
   * 「老师写完点评」≠「状态变更」，二者解耦。
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
      include: { items: true },
    });
    if (!submission) {
      throw new BadRequestException('尚未录制任何一题');
    }

    const totalItems = await this.prisma.homeworkItem.count({
      where: { homeworkId: assignment.homeworkId },
    });
    if (submission.items.length < totalItems) {
      throw new BadRequestException(
        `还有 ${totalItems - submission.items.length} 题未录制，无法整体提交`,
      );
    }

    return this.prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.SUBMITTED,
        submittedAt: new Date(),
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
          submittedAt: true,
          comment: { select: { id: true, updatedAt: true } },
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
        status: sub?.status ?? null,        // null = 未开始
        recordedItemCount: sub?._count.items ?? 0,
        submittedAt: sub?.submittedAt ?? null,
        hasComment: !!sub?.comment,         // 是否已点评
        commentedAt: sub?.comment?.updatedAt ?? null,
      };
    });

    // 排序：已提交未点评的排前面 → 已点评 → 未提交；同档内按学号
    rows.sort((a, b) => {
      const priority = (r: typeof a) =>
        r.status === 'SUBMITTED' && !r.hasComment ? 0 :
        r.status === 'SUBMITTED' && r.hasComment ? 1 :
        r.status === 'DRAFT' ? 2 : 3;
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;
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
      submittedAt: sub.submittedAt,
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

  /**
   * 教师视角：某次作业的提交情况统计。
   * MVP 阶段不含分数维度（SOE 已下线）。
   */
  async getAssignmentStats(assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, classId: true },
    });
    if (!assignment) throw new NotFoundException('作业不存在');

    const [memberCount, submissions, commentedCount] = await this.prisma.$transaction([
      this.prisma.classMember.count({ where: { classId: assignment.classId } }),
      this.prisma.submission.findMany({
        where: { assignmentId },
        select: { status: true },
      }),
      this.prisma.teacherComment.count({
        where: { submission: { assignmentId } },
      }),
    ]);

    const submittedCount = submissions.filter(
      (s) => s.status === SubmissionStatus.SUBMITTED,
    ).length;

    return {
      memberCount,        // 班级人数
      submittedCount,     // 已提交人数
      commentedCount,     // 已点评人数
      pendingCount: submittedCount - commentedCount, // 待点评
    };
  }

  /** 学生视角：我的提交历史（分页） */
  async listMyHistory(studentId: string, page: number, pageSize: number) {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.submission.count({ where: { studentId } }),
      this.prisma.submission.findMany({
        where: { studentId },
        orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          submittedAt: true,
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
        submittedAt: r.submittedAt,
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
