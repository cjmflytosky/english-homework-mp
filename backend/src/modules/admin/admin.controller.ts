import { Controller, ForbiddenException, Get } from '@nestjs/common';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 管理后台「我」相关接口，仅 type=admin 可访问。
 * 阶段 1 只提供 /admin/me，后续派生班级/学生/作业 CRUD。
 */
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    if (user.type !== 'admin') {
      throw new ForbiddenException('仅管理员可访问');
    }
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: user.sub },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        phone: true,
        avatar: true,
      },
    });
    return admin;
  }
}
