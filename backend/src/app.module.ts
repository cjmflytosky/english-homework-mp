import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import configuration from './config/configuration';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AdminModule } from './modules/admin/admin.module';
import { HomeworkModule } from './modules/homework/homework.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { StorageModule } from './modules/storage/storage.module';
import { SpeechModule } from './modules/speech/speech.module';
import { SubmissionModule } from './modules/submission/submission.module';
import { ClassModule } from './modules/class/class.module';
import { StudentModule } from './modules/student/student.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    // 阶段 3：本地 mock COS 时把 uploads 暴露成静态资源
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false, fallthrough: true },
    }),
    PrismaModule,
    StorageModule,
    SpeechModule,
    AuthModule,
    ClassModule,
    StudentModule,
    UserModule,
    AdminModule,
    HomeworkModule,
    AssignmentModule,
    SubmissionModule,
    HealthModule,
  ],
  providers: [
    // 全局 JWT 守卫，标注 @Public() 的接口除外
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
