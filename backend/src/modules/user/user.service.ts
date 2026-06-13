import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        openId: true,
        nickname: true,
        avatar: true,
        realName: true,
        studentNo: true,
        phone: true,
        role: true,
        enabled: true,
        createdAt: true,
      },
    });
    if (!student) {
      throw new NotFoundException('用户不存在');
    }
    return student;
  }

  async updateProfile(
    id: string,
    data: { nickname?: string; avatar?: string; realName?: string; phone?: string },
  ) {
    return this.prisma.student.update({
      where: { id },
      data,
      select: {
        id: true,
        nickname: true,
        avatar: true,
        realName: true,
        phone: true,
      },
    });
  }
}
