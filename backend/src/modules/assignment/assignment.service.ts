import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';

// 学生端作业展示状态 —— 后端按当前时间动态推导，不存数据库
export enum AssignmentStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  EXPIRED = 'EXPIRED',
}

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // 老师端：发布 / 列表
  // ------------------------------------------------------------------

  async publish(dto: PublishAssignmentDto, createdById: string) {
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('时间格式不合法');
    }
    if (end <= start) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    const homework = await this.prisma.homework.findUnique({
      where: { id: dto.homeworkId },
      select: { id: true },
    });
    if (!homework) throw new NotFoundException('作业不存在');

    const classId = dto.classId ?? (await this.getDefaultClassIdOrThrow());

    try {
      return await this.prisma.assignment.create({
        data: {
          homeworkId: dto.homeworkId,
          classId,
          createdById,
          startAt: start,
          endAt: end,
          remark: dto.remark,
        },
        include: {
          homework: { select: { id: true, title: true, type: true } },
          class: { select: { id: true, name: true } },
        },
      });
    } catch (e: unknown) {
      if (typeof e === 'object' && e && (e as { code?: string }).code === 'P2002') {
        throw new ConflictException('该作业已派发到此班级');
      }
      throw e;
    }
  }

  /**
   * 老师端作业列表。
   *   - 按截止时间升序（临近截止在前）
   *   - 批量统计每个作业的提交/点评情况，派生批改状态：
   *       PENDING 待批改（有已提交但未点评）/ DONE 已批完 / EMPTY 无人提交
   *   - status 过滤：'pending' | 'done' | 'all'(默认)
   *   - 统计一次性算出（groupBy），不做 N+1
   *
   * 规模保护：作业总量按 MAX_SCAN 上限扫描（MVP 足够；超过再做下推到 SQL）。
   */
  async listForAdmin(params: {
    page: number;
    pageSize: number;
    status?: 'pending' | 'done' | 'all';
  }) {
    const { page, pageSize, status = 'all' } = params;
    const MAX_SCAN = 500;

    const rows = await this.prisma.assignment.findMany({
      orderBy: { endAt: 'asc' },
      take: MAX_SCAN,
      include: {
        homework: { select: { id: true, title: true, type: true } },
        class: { select: { id: true, name: true } },
      },
    });
    const ids = rows.map((r) => r.id);

    const [submittedRows, commentRows] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where: { assignmentId: { in: ids }, status: SubmissionStatus.SUBMITTED },
        select: { assignmentId: true },
      }),
      this.prisma.teacherComment.findMany({
        where: { submission: { assignmentId: { in: ids } } },
        select: { submission: { select: { assignmentId: true } } },
      }),
    ]);

    const submittedMap = new Map<string, number>();
    submittedRows.forEach((s) =>
      submittedMap.set(s.assignmentId, (submittedMap.get(s.assignmentId) ?? 0) + 1),
    );
    const commentedMap = new Map<string, number>();
    commentRows.forEach((c) => {
      const aid = c.submission.assignmentId;
      commentedMap.set(aid, (commentedMap.get(aid) ?? 0) + 1);
    });

    const enriched = rows.map((r) => {
      const submitted = submittedMap.get(r.id) ?? 0;
      const commented = commentedMap.get(r.id) ?? 0;
      const pending = submitted - commented;
      const gradingStatus =
        pending > 0 ? 'PENDING' : submitted > 0 ? 'DONE' : 'EMPTY';
      return {
        id: r.id,
        startAt: r.startAt,
        endAt: r.endAt,
        remark: r.remark,
        gradingStatus,
        homework: r.homework,
        class: r.class,
      };
    });

    const filtered =
      status === 'pending'
        ? enriched.filter((a) => a.gradingStatus === 'PENDING')
        : status === 'done'
          ? enriched.filter((a) => a.gradingStatus === 'DONE')
          : enriched;

    const total = filtered.length;
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { data, meta: { total, page, pageSize } };
  }

  // ------------------------------------------------------------------
  // 学生端：列表 / 详情
  // ------------------------------------------------------------------

  async listForStudent(studentId: string) {
    const classIds = await this.getStudentClassIds(studentId);
    if (classIds.length === 0) return [];

    const now = new Date();
    const rows = await this.prisma.assignment.findMany({
      where: { classId: { in: classIds } },
      orderBy: { endAt: 'asc' },
      include: {
        homework: {
          select: {
            id: true,
            title: true,
            type: true,
            totalScore: true,
            _count: { select: { items: true } },
          },
        },
      },
    });

    return rows.map((a) => ({
      id: a.id,
      startAt: a.startAt,
      endAt: a.endAt,
      remark: a.remark,
      status: this.deriveStatus(a.startAt, a.endAt, now),
      homework: {
        id: a.homework.id,
        title: a.homework.title,
        type: a.homework.type,
        totalScore: a.homework.totalScore,
        itemCount: a.homework._count.items,
      },
    }));
  }

  async getForStudent(assignmentId: string, studentId: string) {
    const classIds = await this.getStudentClassIds(studentId);
    const a = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        homework: { include: { items: { orderBy: { orderNo: 'asc' } } } },
      },
    });
    if (!a || !classIds.includes(a.classId)) {
      throw new NotFoundException('作业不存在或无权限');
    }
    return {
      id: a.id,
      startAt: a.startAt,
      endAt: a.endAt,
      remark: a.remark,
      status: this.deriveStatus(a.startAt, a.endAt, new Date()),
      homework: a.homework,
    };
  }

  // ------------------------------------------------------------------
  // 私有
  // ------------------------------------------------------------------

  private deriveStatus(startAt: Date, endAt: Date, now: Date): AssignmentStatus {
    if (now < startAt) return AssignmentStatus.PENDING;
    if (now > endAt) return AssignmentStatus.EXPIRED;
    return AssignmentStatus.IN_PROGRESS;
  }

  private async getStudentClassIds(studentId: string): Promise<string[]> {
    const members = await this.prisma.classMember.findMany({
      where: { studentId },
      select: { classId: true },
    });
    return members.map((m) => m.classId);
  }

  private async getDefaultClassIdOrThrow(): Promise<string> {
    const c = await this.prisma.class.findUnique({
      where: { inviteCode: 'DEFAULT' },
      select: { id: true },
    });
    if (!c) {
      throw new BadRequestException(
        '默认班级未初始化，请先在后端执行 npm run db:seed',
      );
    }
    return c.id;
  }
}
