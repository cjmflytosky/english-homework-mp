import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

const DEFAULT_INVITE_CODE = 'DEFAULT';

@Injectable()
export class ClassService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // 老师端
  // ------------------------------------------------------------------

  async create(dto: CreateClassDto, ownerId: string) {
    const inviteCode = await this.generateInviteCode();
    return this.prisma.class.create({
      data: {
        name: dto.name,
        grade: dto.grade,
        remark: dto.remark,
        inviteCode,
        ownerId,
      },
      select: this.classSelect(),
    });
  }

  async list(params: { page: number; pageSize: number; keyword?: string }) {
    const { page, pageSize, keyword } = params;
    const where = keyword
      ? {
          OR: [
            { name: { contains: keyword } },
            { inviteCode: { contains: keyword } },
            { grade: { contains: keyword } },
          ],
        }
      : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.class.count({ where }),
      this.prisma.class.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, name: true, username: true } },
          _count: { select: { members: true, assignments: true } },
        },
      }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      grade: r.grade,
      inviteCode: r.inviteCode,
      remark: r.remark,
      enabled: r.enabled,
      ownerId: r.ownerId,
      owner: r.owner,
      memberCount: r._count.members,
      assignmentCount: r._count.assignments,
      createdAt: r.createdAt,
    }));
    return { data, meta: { total, page, pageSize } };
  }

  async detail(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, username: true } },
        members: {
          orderBy: { joinedAt: 'asc' },
          include: {
            student: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
                realName: true,
                studentNo: true,
                phone: true,
                enabled: true,
                createdAt: true,
              },
            },
          },
        },
        _count: { select: { assignments: true } },
      },
    });
    if (!cls) throw new NotFoundException('班级不存在');
    return {
      id: cls.id,
      name: cls.name,
      grade: cls.grade,
      inviteCode: cls.inviteCode,
      remark: cls.remark,
      enabled: cls.enabled,
      owner: cls.owner,
      assignmentCount: cls._count.assignments,
      createdAt: cls.createdAt,
      members: cls.members.map((m) => ({
        memberId: m.id,
        joinedAt: m.joinedAt,
        seatNo: m.seatNo,
        student: m.student,
      })),
    };
  }

  async update(id: string, dto: UpdateClassDto) {
    await this.ensureExists(id);
    return this.prisma.class.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
        ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
      select: this.classSelect(),
    });
  }

  async rotateInviteCode(id: string) {
    const cls = await this.ensureExists(id);
    if (cls.inviteCode === DEFAULT_INVITE_CODE) {
      throw new BadRequestException('默认班级的邀请码不允许轮换');
    }
    const inviteCode = await this.generateInviteCode();
    return this.prisma.class.update({
      where: { id },
      data: { inviteCode },
      select: this.classSelect(),
    });
  }

  async removeMember(classId: string, memberId: string) {
    const member = await this.prisma.classMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.classId !== classId) {
      throw new NotFoundException('成员不存在');
    }
    await this.prisma.classMember.delete({ where: { id: memberId } });
    return { id: memberId };
  }

  /**
   * 阶段 5（修正）：老师在后台把若干已注册学生加入班级。
   * 已在班级中的学生跳过，不报错。
   */
  async addMembers(classId: string, studentIds: string[]) {
    const cls = await this.ensureExists(classId);

    const valid = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, enabled: true },
      select: { id: true },
    });
    const validIds = new Set(valid.map((s) => s.id));
    const missing = studentIds.filter((id) => !validIds.has(id));
    if (missing.length > 0 && validIds.size === 0) {
      throw new NotFoundException('所选学生不存在或已停用');
    }

    const existing = await this.prisma.classMember.findMany({
      where: { classId: cls.id, studentId: { in: [...validIds] } },
      select: { studentId: true },
    });
    const alreadyIn = new Set(existing.map((m) => m.studentId));
    const toAdd = [...validIds].filter((id) => !alreadyIn.has(id));

    if (toAdd.length > 0) {
      await this.prisma.classMember.createMany({
        data: toAdd.map((studentId) => ({ classId: cls.id, studentId })),
        skipDuplicates: true,
      });
    }

    return {
      added: toAdd.length,
      skipped: alreadyIn.size,
      missing: missing.length,
    };
  }

  // ------------------------------------------------------------------
  // 学生端（只读）
  // ------------------------------------------------------------------

  async listMyClasses(studentId: string) {
    const rows = await this.prisma.classMember.findMany({
      where: { studentId },
      orderBy: { joinedAt: 'asc' },
      include: {
        class: {
          include: {
            owner: { select: { id: true, name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      joinedAt: r.joinedAt,
      class: {
        id: r.class.id,
        name: r.class.name,
        grade: r.class.grade,
        inviteCode: r.class.inviteCode,
        enabled: r.class.enabled,
        owner: r.class.owner,
      },
    }));
  }

  // ------------------------------------------------------------------
  // 私有
  // ------------------------------------------------------------------

  private classSelect() {
    return {
      id: true,
      name: true,
      grade: true,
      inviteCode: true,
      remark: true,
      enabled: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private async ensureExists(id: string) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('班级不存在');
    return cls;
  }

  /** 6 位大写字母+数字邀请码，最多尝试 5 次避免冲突 */
  private async generateInviteCode(): Promise<string> {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let code = '';
      for (let i = 0; i < 6; i += 1) {
        code += charset[Math.floor(Math.random() * charset.length)];
      }
      const existing = await this.prisma.class.findUnique({
        where: { inviteCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new ConflictException('邀请码生成冲突，请重试');
  }
}
