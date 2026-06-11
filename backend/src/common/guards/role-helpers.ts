/**
 * 角色判定工具，所有 controller 共用。
 *
 * 项目里有两种登录主体：
 *   - AdminUser 表（账号密码登录，JwtPayload.type='admin'）：H5 后台未上线，目前几乎不用
 *   - Student 表（微信登录，JwtPayload.type='student'）：MVP 主流路径
 *
 * 在小程序内「老师 / 管理员」实际上是 role=TEACHER/ADMIN 的 Student。
 * 所以鉴权要同时认两种来源。
 */
import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../decorators/current-user.decorator';

/** 学生（普通用户） */
export function assertStudent(user: JwtPayload): void {
  if (user.type !== 'student') {
    throw new ForbiddenException('仅学生可访问');
  }
}

/**
 * 老师及以上：
 *   - AdminUser（任何角色，H5 后台兼容）
 *   - Student.role = TEACHER 或 ADMIN
 */
export function assertTeacherOrAdmin(user: JwtPayload): void {
  if (user.type === 'admin') return;
  if (
    user.type === 'student' &&
    (user.studentRole === 'TEACHER' || user.studentRole === 'ADMIN')
  ) {
    return;
  }
  throw new ForbiddenException('仅老师 / 管理员可访问');
}

/**
 * 仅「学生身份」的老师 / 管理员（type=student 且 role=TEACHER|ADMIN）。
 *
 * 用于「点评」这类需要把操作者落库为 TeacherComment.author（→ student 表）的写操作：
 * AdminUser 没有对应的 student 记录，若放行会触发外键错误，所以这里必须排除。
 */
export function assertStudentTeacherOrAdmin(user: JwtPayload): void {
  if (
    user.type === 'student' &&
    (user.studentRole === 'TEACHER' || user.studentRole === 'ADMIN')
  ) {
    return;
  }
  throw new ForbiddenException('请用老师身份（小程序）操作');
}

/**
 * 仅管理员（小程序顶级权限，能升降级 role / 加学生入班）：
 *   - AdminUser.role = SUPER_ADMIN
 *   - Student.role = ADMIN
 */
export function assertAdmin(user: JwtPayload): void {
  if (user.type === 'admin' && user.role === 'SUPER_ADMIN') return;
  if (user.type === 'student' && user.studentRole === 'ADMIN') return;
  throw new ForbiddenException('仅管理员可访问');
}
