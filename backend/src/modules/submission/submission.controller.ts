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
import { SubmissionService } from './submission.service';
import { UploadItemDto } from './dto/upload-item.dto';
import { TeacherCommentDto } from './dto/teacher-comment.dto';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

/**
 * 阶段 3：学生提交 + 评分
 * 阶段 4：教师批改面板（只读）、班级排名、学生历史
 *
 * 注意：路由没有统一前缀，因为同时承载 /submissions、/assignments/:id/ranking、
 *       /me/submissions、/admin/* 几类资源，Controller 上的 @Controller() 不加前缀。
 */
@Controller()
export class SubmissionController {
  constructor(private readonly submission: SubmissionService) {}

  // ====================== 学生 ======================

  @Post('submissions/items')
  uploadItem(@Body() dto: UploadItemDto, @CurrentUser() user: JwtPayload) {
    this.assertStudent(user);
    return this.submission.uploadAndScoreItem(dto, user.sub);
  }

  @Post('submissions/:assignmentId/finalize')
  finalize(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertStudent(user);
    return this.submission.finalize(assignmentId, user.sub);
  }

  @Get('submissions/by-assignment/:assignmentId')
  myByAssignment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertStudent(user);
    return this.submission.getMyByAssignment(assignmentId, user.sub);
  }

  /** 阶段 4：班级排名（同次作业内） */
  @Get('assignments/:assignmentId/ranking')
  assignmentRanking(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertStudent(user);
    return this.submission.getAssignmentRanking(assignmentId, user.sub);
  }

  /** 阶段 4：我的提交历史 */
  @Get('me/submissions')
  myHistory(@Query() q: PageQueryDto, @CurrentUser() user: JwtPayload) {
    this.assertStudent(user);
    return this.submission.listMyHistory(user.sub, q.page, q.pageSize);
  }

  // ====================== 管理端 ======================

  /** 阶段 4：教师面板 - 某次作业的全班提交概览 */
  @Get('admin/assignments/:assignmentId/submissions')
  adminListByAssignment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.submission.listForAdminByAssignment(assignmentId);
  }

  /** 阶段 4：教师面板 - 单次提交详情（含每题音频 URL） */
  @Get('admin/submissions/:id')
  adminSubmissionDetail(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.submission.getAdminSubmission(id);
  }

  /** 阶段 4：教师面板 - 某次作业统计 */
  @Get('admin/assignments/:assignmentId/stats')
  adminAssignmentStats(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.submission.getAssignmentStats(assignmentId);
  }

  /** 阶段 5：写老师点评（覆盖式） */
  @Post('admin/submissions/:id/comment')
  upsertComment(
    @Param('id') id: string,
    @Body() dto: TeacherCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.submission.upsertComment(id, user.sub, dto.content);
  }

  /** 阶段 5：删除老师点评 */
  @Delete('admin/submissions/:id/comment')
  deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.assertAdmin(user);
    return this.submission.deleteComment(id);
  }

  // ---------------------------------------------------------

  private assertStudent(user: JwtPayload) {
    if (user.type !== 'student') throw new ForbiddenException('仅学生可访问');
  }
  private assertAdmin(user: JwtPayload) {
    if (user.type !== 'admin') throw new ForbiddenException('仅管理员可访问');
  }
}
