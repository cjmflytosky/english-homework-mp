import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';

@Injectable()
export class HomeworkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建作业 + 任务（一次性写入）。
   * 任务的 orderNo 按数组下标自增；如果未指定 score，则按 totalScore 平均分摊。
   */
  async create(dto: CreateHomeworkDto, createdById: string) {
    const totalScore = dto.totalScore ?? 100;
    const avg = Math.floor(totalScore / dto.items.length);

    return this.prisma.homework.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        totalScore,
        createdById,
        items: {
          create: dto.items.map((it, idx) => ({
            orderNo: idx + 1,
            text: it.text,
            translation: it.translation,
            refAudioUrl: it.refAudioUrl,
            score: it.score ?? avg,
          })),
        },
      },
      include: { items: { orderBy: { orderNo: 'asc' } } },
    });
  }

  async list(params: { page: number; pageSize: number; createdById: string }) {
    const { page, pageSize, createdById } = params;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.homework.count({ where: { createdById } }),
      this.prisma.homework.findMany({
        where: { createdById },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          type: true,
          totalScore: true,
          createdAt: true,
          _count: { select: { items: true, assignments: true } },
        },
      }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        totalScore: r.totalScore,
        createdAt: r.createdAt,
        itemCount: r._count.items,
        assignmentCount: r._count.assignments,
      })),
      meta: { total, page, pageSize },
    };
  }

  async findById(id: string) {
    const hw = await this.prisma.homework.findUnique({
      where: { id },
      include: { items: { orderBy: { orderNo: 'asc' } } },
    });
    if (!hw) throw new NotFoundException('作业不存在');
    return hw;
  }

  async remove(id: string, createdById: string) {
    const hw = await this.prisma.homework.findUnique({ where: { id } });
    if (!hw) throw new NotFoundException('作业不存在');
    if (hw.createdById !== createdById) {
      throw new NotFoundException('作业不存在'); // 简单防越权
    }
    await this.prisma.homework.delete({ where: { id } });
    return { id };
  }
}
