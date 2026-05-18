/**
 * 统一响应包装。
 * 所有 Controller 返回的对象都会被包成：
 *   { success, code, message, data, meta? }
 *
 * 若 Controller 直接返回 { data, meta } 这种结构，meta 会被透传用于分页。
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  meta?: { total: number; page: number; pageSize: number };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload: unknown) => {
        // 支持 controller 返回 { data, meta } 形态
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in (payload as Record<string, unknown>) &&
          'meta' in (payload as Record<string, unknown>)
        ) {
          const { data, meta } = payload as {
            data: T;
            meta: ApiResponse<T>['meta'];
          };
          return {
            success: true,
            code: 0,
            message: 'ok',
            data,
            meta,
          };
        }
        return {
          success: true,
          code: 0,
          message: 'ok',
          data: payload as T,
        };
      }),
    );
  }
}
