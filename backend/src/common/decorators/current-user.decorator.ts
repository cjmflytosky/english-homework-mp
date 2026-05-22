/**
 * @CurrentUser() 从 request.user 中取出当前登录主体。
 * JwtStrategy.validate() 的返回值会被挂到 request.user 上。
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;            // 主体 id
  type: 'student' | 'admin';
  /** AdminUser 的角色（SUPER_ADMIN/TEACHER），仅当 type=admin 时存在 */
  role?: string;
  /** Student 的小程序内角色（STUDENT/TEACHER/ADMIN），仅当 type=student 时存在 */
  studentRole?: 'STUDENT' | 'TEACHER' | 'ADMIN';
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return data ? request.user?.[data] : request.user;
  },
);
