import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WxLoginDto } from './dto/wx-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('wx-login')
  wxLogin(@Body() dto: WxLoginDto) {
    return this.auth.wxLogin(dto);
  }

  @Public()
  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto);
  }
}
