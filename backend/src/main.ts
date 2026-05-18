import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });
  const config = app.get(ConfigService);

  const prefix = config.get<string>('globalPrefix') ?? 'api';
  app.setGlobalPrefix(prefix);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 全局校验：自动转换 DTO 类型、剔除多余字段、缺字段直接 400
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 统一响应格式
  app.useGlobalInterceptors(new TransformInterceptor());
  // 统一异常响应
  app.useGlobalFilters(new HttpExceptionFilter());
  // Reflector 主要供其它装饰器使用，这里只是 keep ref 防止 tree-shaking
  app.get(Reflector);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  Logger.log(
    `🚀 后端服务已启动：http://localhost:${port}/${prefix}`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
