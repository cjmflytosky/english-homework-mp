import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { WxLoginDto } from './dto/wx-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

interface WxSession {
  openid: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 学生端微信登录。
   * - mock 模式：code 以 mock- 开头时，openId 直接使用 code 字符串方便联调
   * - 真实模式：调用微信 jscode2session 拿 openId
   */
  async wxLogin(dto: WxLoginDto): Promise<{ token: string; student: unknown }> {
    const openId = await this.resolveOpenId(dto.code);

    const student = await this.prisma.student.upsert({
      where: { openId },
      create: {
        openId,
        nickname: dto.nickname,
        avatar: dto.avatar,
      },
      update: {
        // 用户授权资料若有更新，覆盖一下
        ...(dto.nickname ? { nickname: dto.nickname } : {}),
        ...(dto.avatar ? { avatar: dto.avatar } : {}),
      },
    });

    // 阶段 5 起：登录不自动加班级，必须由老师在后台显式加入
    const token = this.signToken({ sub: student.id, type: 'student' });
    return { token, student };
  }

  /**
   * 管理后台账号登录。
   */
  async adminLogin(
    dto: AdminLoginDto,
  ): Promise<{ token: string; admin: { id: string; username: string; name: string; role: string } }> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { username: dto.username },
    });
    if (!admin || !admin.enabled) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const matched = await bcrypt.compare(dto.password, admin.password);
    if (!matched) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const token = this.signToken({
      sub: admin.id,
      type: 'admin',
      role: admin.role,
    });
    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private async resolveOpenId(code: string): Promise<string> {
    const mockOn = this.config.get<boolean>('wechat.mockLogin');
    if (mockOn && code.startsWith('mock-')) {
      return `mock-openid-${code.slice(5)}`;
    }
    const appid = this.config.get<string>('wechat.appid');
    const secret = this.config.get<string>('wechat.secret');
    if (!appid || !secret) {
      throw new BadRequestException(
        '未配置微信 appid/secret，无法换取 openid（可启用 WECHAT_MOCK_LOGIN）',
      );
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(
      code,
    )}&grant_type=authorization_code`;

    const { data } = await axios.get<WxSession>(url, { timeout: 5000 });
    if (!data.openid) {
      throw new UnauthorizedException(
        `微信登录失败：${data.errmsg ?? 'unknown'}（${data.errcode ?? '-'}）`,
      );
    }
    return data.openid;
  }

  private signToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }
}
