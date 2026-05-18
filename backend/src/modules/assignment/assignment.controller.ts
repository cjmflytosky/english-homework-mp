import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { PublishAssignmentDto } from './dto/publish-assignment.dto';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

@Controller()
export class AssignmentController {
  constructor(private readonly assignment: AssignmentService) {}

  // ---------------- 老师端 ----------------

  @Post('admin/assignments')
  publish(
    @Body() dto: PublishAssignmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.type !== 'admin') throw new ForbiddenException('仅管理员可访问');
    return this.assignment.publish(dto, user.sub);
  }

  @Get('admin/assignments')
  listAdmin(@Query() q: PageQueryDto, @CurrentUser() user: JwtPayload) {
    if (user.type !== 'admin') throw new ForbiddenException('仅管理员可访问');
    return this.assignment.listForAdmin({ page: q.page, pageSize: q.pageSize });
  }

  // ---------------- 学生端 ----------------

  @Get('assignments')
  listMine(@CurrentUser() user: JwtPayload) {
    if (user.type !== 'student') throw new ForbiddenException('仅学生可访问');
    return this.assignment.listForStudent(user.sub);
  }

  @Get('assignments/:id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (user.type !== 'student') throw new ForbiddenException('仅学生可访问');
    return this.assignment.getForStudent(id, user.sub);
  }
}
