import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

/**
 * 老师端 / 管理端作业管理。
 * 所有接口都需要管理员 JWT。
 */
@Controller('admin/homeworks')
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Post()
  create(@Body() dto: CreateHomeworkDto, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
    return this.homework.create(dto, user.sub);
  }

  @Get()
  list(@Query() q: PageQueryDto, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
    return this.homework.list({
      page: q.page,
      pageSize: q.pageSize,
      createdById: user.sub,
    });
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
    return this.homework.findById(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
    return this.homework.remove(id, user.sub);
  }

  private assertAdmin(user: JwtPayload) {
    if (user.type !== 'admin') throw new ForbiddenException('仅管理员可访问');
  }
}
