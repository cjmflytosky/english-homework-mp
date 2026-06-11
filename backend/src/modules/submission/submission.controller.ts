import {
  Body,
  Controller,
  Delete,
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
import {
  assertStudent,
  assertTeacherOrAdmin,
  assertStudentTeacherOrAdmin,
} from '../../common/guards/role-helpers';

/**
 * 学生：作业提交 + 历史
 * 教师 / 管理员：批改面板、点评、统计
 *
 * Controller 上无前缀，因为同时承载 /submissions、/me/submissions、/admin/* 几类资源。
 */
@Controller()
export class SubmissionController {
  constructor(private readonly submission: SubmissionService) {}

  // ====================== 学生 ======================

  @Post('submissions/items')
  uploadItem(@Body() dto: UploadItemDto, @CurrentUser() user: JwtPayload) {
    assertStudent(user);
    return this.submission.uploadAndScoreItem(dto, user.sub);
  }

  @Post('submissions/:assignmentId/finalize')
  finalize(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    assertStudent(user);
    return this.submission.finalize(assignmentId, user.sub);
  }

  @Get('submissions/by-assignment/:assignmentId')
  myByAssignment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    assertStudent(user);
    return this.submission.getMyByAssignment(assignmentId, user.sub);
  }

  @Get('me/submissions')
  myHistory(@Query() q: PageQueryDto, @CurrentUser() user: JwtPayload) {
    assertStudent(user);
    return this.submission.listMyHistory(user.sub, q.page, q.pageSize);
  }

  // ====================== 教师 / 管理员 ======================

  /** 某次作业的全班提交概览 */
  @Get('admin/assignments/:assignmentId/submissions')
  adminListByAssignment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.submission.listForAdminByAssignment(assignmentId);
  }

  /** 单次提交详情（含每题音频 URL） */
  @Get('admin/submissions/:id')
  adminSubmissionDetail(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.submission.getAdminSubmission(id);
  }

  /** 某次作业的统计（提交数 / 已点评数） */
  @Get('admin/assignments/:assignmentId/stats')
  adminAssignmentStats(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.submission.getAssignmentStats(assignmentId);
  }

  /** 写老师点评（覆盖式） */
  @Post('admin/submissions/:id/comment')
  upsertComment(
    @Param('id') id: string,
    @Body() dto: TeacherCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // 点评作者会落库到 TeacherComment.author（→ student 表），
    // 必须是「学生身份」的老师 / 管理员；AdminUser 没有 student 记录，放行会外键报错。
    assertStudentTeacherOrAdmin(user);
    return this.submission.upsertComment(id, user.sub, dto.content);
  }

  /** 删除老师点评 */
  @Delete('admin/submissions/:id/comment')
  deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    assertTeacherOrAdmin(user);
    return this.submission.deleteComment(id);
  }
}
