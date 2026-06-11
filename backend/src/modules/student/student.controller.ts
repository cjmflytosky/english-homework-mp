import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { StudentService } from './student.service';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentRoleDto } from './dto/update-student-role.dto';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import {
  assertAdmin,
  assertTeacherOrAdmin,
} from '../../common/guards/role-helpers';

class StudentListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  classId?: string;

  /** 'true' | 'false' */
  @IsOptional()
  @IsIn(['true', 'false'])
  enabled?: string;
}

/**
 * 学生管理：
 *   - list/detail/update：老师 + 管理员都能用
 *   - role 升降级（升老师/管理员/降回学生）：仅管理员
 */
@Controller('admin/students')
export class StudentController {
  constructor(private readonly student: StudentService) {}

  @Get()
  list(@Query() q: StudentListQueryDto, @CurrentUser() user: JwtPayload) {
    assertTeacherOrAdmin(user);
    return this.student.list({
      page: q.page,
      pageSize: q.pageSize,
      keyword: q.keyword,
      classId: q.classId || undefined,
      enabled:
        q.enabled === 'true' ? true : q.enabled === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    assertTeacherOrAdmin(user);
    return this.student.detail(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.student.update(id, dto);
  }

  /**
   * 升降级他人 role。仅 ADMIN 可调；防止自己把自己降级。
   * 升级生效：被升级者下次登录拿到带新 role 的 JWT；老 JWT 仍是旧 role 直到过期。
   */
  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateStudentRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    assertAdmin(user);
    if (user.type === 'student' && user.sub === id) {
      throw new BadRequestException(
        '不能修改自己的角色，请让其它管理员操作',
      );
    }
    return this.student.updateRole(id, dto.role);
  }
}
