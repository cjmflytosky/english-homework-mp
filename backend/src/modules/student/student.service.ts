import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStudentDto } from './dto/update-student.dto';

interface ListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  classId?: string;
  enabled?: boolean;
}

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListParams) {
    const { page, pageSize, keyword, classId, enabled } = params;

    const where: Prisma.StudentWhereInput = {
      ...(enabled !== undefined ? { enabled } : {}),
      ...(keyword
        ? {
            OR: [
              { realName: { contains: keyword } },
              { nickname: { contains: keyword } },
              { studentNo: { contains: keyword } },
              { phone: { contains: keyword } },
              { openId: { contains: keyword } },
            ],
          }
        : {}),
      ...(classId
        ? { classMembers: { some: { classId } } }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          classMembers: {
            include: {
              class: { select: { id: true, name: true } },
            },
          },
          _count: { select: { submissions: true } },
        },
      }),
    ]);

    const data = rows.map((s) => ({
      id: s.id,
      openId: s.openId,
      nickname: s.nickname,
      avatar: s.avatar,
      realName: s.realName,
      studentNo: s.studentNo,
      phone: s.phone,
      role: s.role,
      enabled: s.enabled,
      submissionCount: s._count.submissions,
      classes: s.classMembers.map((m) => ({
        memberId: m.id,
        id: m.class.id,
        name: m.class.name,
      })),
      createdAt: s.createdAt,
    }));

    return { data, meta: { total, page, pageSize } };
  }

  async detail(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        classMembers: {
          include: {
            class: { select: { id: true, name: true, grade: true } },
          },
        },
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            assignment: {
              include: {
                homework: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('学生不存在');
    return {
      id: student.id,
      openId: student.openId,
      nickname: student.nickname,
      avatar: student.avatar,
      realName: student.realName,
      studentNo: student.studentNo,
      phone: student.phone,
      enabled: student.enabled,
      createdAt: student.createdAt,
      classes: student.classMembers.map((m) => ({
        memberId: m.id,
        joinedAt: m.joinedAt,
        ...m.class,
      })),
      recentSubmissions: student.submissions.map((s) => ({
        id: s.id,
        status: s.status,
        submittedAt: s.submittedAt,
        homework: s.assignment.homework,
      })),
    };
  }

  async update(id: string, dto: UpdateStudentDto) {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('学生不存在');
    return this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.realName !== undefined ? { realName: dto.realName } : {}),
        ...(dto.studentNo !== undefined ? { studentNo: dto.studentNo } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
      select: {
        id: true,
        nickname: true,
        realName: true,
        studentNo: true,
        phone: true,
        enabled: true,
      },
    });
  }

  /**
   * 升降级他人 role（仅 ADMIN 调用，权限校验在 controller）。
   * 升级后，目标用户需要重新登录才能拿到带新 role 的 JWT。
   */
  async updateRole(
    id: string,
    role: 'STUDENT' | 'TEACHER' | 'ADMIN',
  ) {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('学生不存在');
    return this.prisma.student.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        nickname: true,
        realName: true,
        role: true,
      },
    });
  }
}
