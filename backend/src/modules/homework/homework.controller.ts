import {
  Body,
  Controller,
  Delete,
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
import {
  assertAdmin,
  assertTeacherOrAdmin,
} from '../../common/guards/role-helpers';

/**
 * 作业题目管理。
 *
 * MVP：作业由 curriculum.yaml 同步，小程序端不直接 create/delete。
 *   - list / detail：TEACHER + ADMIN（查看用）
 *   - create / delete：ADMIN（兼容未来 H5 后台或手动维护）
 */
@Controller('admin/homeworks')
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Post()
  create(@Body() dto: CreateHomeworkDto, @CurrentUser() user: JwtPayload) {
    assertTeacherOrAdmin(user);
    return this.homework.create(dto, user.sub);
  }

  @Get()
  list(@Query() q: PageQueryDto, @CurrentUser() user: JwtPayload) {
    assertTeacherOrAdmin(user);
    return this.homework.list({
      page: q.page,
      pageSize: q.pageSize,
      createdById: user.sub,
    });
  }

  /** 可派发作业列表（老师「布置预置作业」用，可按 type 过滤，如 WORD_CARD） */
  @Get('assignable')
  listAssignable(
    @Query('type') type: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.homework.listAssignable(type);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    assertTeacherOrAdmin(user);
    return this.homework.findById(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    assertAdmin(user);
    return this.homework.remove(id, user.sub);
  }
}
