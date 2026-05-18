import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClassService } from './class.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AddMembersDto } from './dto/add-members.dto';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

/**
 * 阶段 5：班级管理。
 * - /admin/classes  老师后台 CRUD
 */
@Controller('admin/classes')
export class ClassController {
  constructor(private readonly cls: ClassService) {}

  @Get()
  list(@Query() q: PageQueryDto, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
    return this.cls.list({ page: q.page, pageSize: q.pageSize, keyword: q.keyword });
  }

  @Post()
  create(@Body() dto: CreateClassDto, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
    return this.cls.create(dto, user.sub);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
    return this.cls.detail(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.cls.update(id, dto);
  }

  @Post(':id/invite-code/rotate')
  rotate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
    return this.cls.rotateInviteCode(id);
  }

  /** 阶段 5（修正）：老师后台批量添加学生到班级 */
  @Post(':id/members')
  addMembers(
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.cls.addMembers(id, dto.studentIds);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.cls.removeMember(id, memberId);
  }

  private assertAdmin(user: JwtPayload) {
    if (user.type !== 'admin') throw new ForbiddenException('仅管理员可访问');
  }
}
