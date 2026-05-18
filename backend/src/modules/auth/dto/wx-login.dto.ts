import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * 学生端微信登录。
 * - code：wx.login() 返回的临时 code。开启 mock 模式时 code 以 mock- 开头即可。
 */
export class WxLoginDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
