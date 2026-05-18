import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

/**
 * 健康检查端点。微信云托管 / 任何反向代理都用这条来判断容器是否存活。
 *  - GET /api/health   公开，不走 JWT
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  ok() {
    return { status: 'ok', ts: new Date().toISOString() };
  }
}
