/**
 * @CurrentUser() 从 request.user 中取出当前登录主体。
 * JwtStrategy.validate() 的返回值会被挂到 request.user 上。
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;            // 主体 id
  type: 'student' | 'admin';
  role?: string;          // 仅 admin 有
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return data ? request.user?.[data] : request.user;
  },
);
