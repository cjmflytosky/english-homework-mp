import {
  Body,
  Controller,
  Delete,
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
import {
  assertAdmin,
  assertTeacherOrAdmin,
} from '../../common/guards/role-helpers';

/**
 * 班级管理：
 *   - list/detail/addMembers/removeMember：老师 + 管理员都能用
 *   - create/update/rotateInviteCode：仅管理员
 *
 * MVP：学校规模小，老师能看所有班级。规模大了再做「按 ownerId 过滤」。
 */
@Controller('admin/classes')
export class ClassController {
  constructor(private readonly cls: ClassService) {}

  @Get()
  list(@Query() q: PageQueryDto, @CurrentUser() user: JwtPayload) {
    assertTeacherOrAdmin(user);
    return this.cls.list({ page: q.page, pageSize: q.pageSize, keyword: q.keyword });
  }

  @Post()
  create(@Body() dto: CreateClassDto, @CurrentUser() user: JwtPayload) {
    assertAdmin(user);
    return this.cls.create(dto, user.sub);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    assertTeacherOrAdmin(user);
    return this.cls.detail(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() user: JwtPayload,
  ) {
    assertAdmin(user);
    return this.cls.update(id, dto);
  }

  @Post(':id/invite-code/rotate')
  rotate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    assertAdmin(user);
    return this.cls.rotateInviteCode(id);
  }

  /** 把学生加入班级（老师 / 管理员都能做） */
  @Post(':id/members')
  addMembers(
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.cls.addMembers(id, dto.studentIds);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.cls.removeMember(id, memberId);
  }
}
