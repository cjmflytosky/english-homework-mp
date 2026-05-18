/**
 * 全局异常过滤器：把所有抛出的异常转换为统一响应格式。
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let code = -1;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        message =
          (Array.isArray(r.message) ? r.message.join('; ') : (r.message as string)) ??
          message;
        code = (r.code as number) ?? status;
      }
      code = code === -1 ? status : code;
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = exception.message;
    } else {
      this.logger.error('Unknown exception', JSON.stringify(exception));
    }

    response.status(status).json({
      success: false,
      code,
      message,
      data: null,
    });
  }
}
