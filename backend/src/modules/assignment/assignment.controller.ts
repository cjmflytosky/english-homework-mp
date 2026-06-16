import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { AssignmentService } from './assignment.service';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import {
  assertStudent,
  assertTeacherOrAdmin,
} from '../../common/guards/role-helpers';

class AdminAssignmentListQueryDto extends PageQueryDto {
  /** 批改状态过滤：pending 待批改 / done 已批完 / all 全部 */
  @IsOptional()
  @IsIn(['pending', 'done', 'all'])
  status?: 'pending' | 'done' | 'all';
}

@Controller()
export class AssignmentController {
  constructor(private readonly assignment: AssignmentService) {}

  // ---------------- 老师 / 管理员 ----------------

  /** 老师 / 管理员把作业派发到班级 */
  @Post('admin/assignments')
  publish(
    @Body() dto: PublishAssignmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.assignment.publish(dto, user.sub);
  }

  @Get('admin/assignments')
  listAdmin(
    @Query() q: AdminAssignmentListQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.assignment.listForAdmin({
      page: q.page,
      pageSize: q.pageSize,
      status: q.status,
    });
  }

  // ---------------- 学生 ----------------

  @Get('assignments')
  listMine(@CurrentUser() user: JwtPayload) {
    assertStudent(user);
    return this.assignment.listForStudent(user.sub);
  }

  @Get('assignments/:id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    assertStudent(user);
    return this.assignment.getForStudent(id, user.sub);
  }
}
