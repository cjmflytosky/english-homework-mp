import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? 'dev-secret',
    });
  }

  /**
   * 校验签发 token 中携带的主体是否仍然有效。
   * 返回值会挂到 request.user 上。
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.type === 'student') {
      const student = await this.prisma.student.findUnique({
        where: { id: payload.sub },
      });
      if (!student || !student.enabled) {
        throw new UnauthorizedException('账号不可用');
      }
    } else if (payload.type === 'admin') {
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
      });
      if (!admin || !admin.enabled) {
        throw new UnauthorizedException('账号不可用');
      }
    } else {
      throw new UnauthorizedException('不合法的 token');
    }
    return payload;
  }
}
