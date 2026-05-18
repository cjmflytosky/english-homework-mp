import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { StudentService } from './student.service';
import { UpdateStudentDto } from './dto/update-student.dto';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

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
 * 阶段 5：学生管理（管理后台）。
 */
@Controller('admin/students')
export class StudentController {
  constructor(private readonly student: StudentService) {}

  @Get()
  list(@Query() q: StudentListQueryDto, @CurrentUser() user: JwtPayload) {
    this.assertAdmin(user);
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
    this.assertAdmin(user);
    return this.student.detail(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.student.update(id, dto);
  }

  private assertAdmin(user: JwtPayload) {
    if (user.type !== 'admin') throw new ForbiddenException('仅管理员可访问');
  }
}
