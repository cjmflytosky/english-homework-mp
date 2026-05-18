import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';
import { AssignmentStatus } from '@prisma/client';

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

  async listForAdmin(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.assignment.count(),
      this.prisma.assignment.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          homework: { select: { id: true, title: true, type: true } },
          class: { select: { id: true, name: true } },
        },
      }),
    ]);
    return { data: rows, meta: { total, page, pageSize } };
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
