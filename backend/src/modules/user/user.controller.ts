import { Body, Controller, ForbiddenException, Get, Patch } from '@nestjs/common';
import { UserService } from './user.service';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ClassService } from '../class/class.service';

/**
 * 学生端「我」相关接口，仅 type=student 可访问。
 */
@Controller('me')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly classService: ClassService,
  ) {}

  @Get()
  async me(@CurrentUser() user: JwtPayload) {
    this.assertStudent(user);
    return this.userService.findById(user.sub);
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    this.assertStudent(user);
    return this.userService.updateProfile(user.sub, dto);
  }

  /**
   * 阶段 5：我加入的班级列表（只读）。
   * 学生本人不能自助加入班级，须由老师在后台添加。
   */
  @Get('classes')
  async myClasses(@CurrentUser() user: JwtPayload) {
    this.assertStudent(user);
    return this.classService.listMyClasses(user.sub);
  }

  private assertStudent(user: JwtPayload) {
    if (user.type !== 'student') {
      throw new ForbiddenException('仅学生可访问');
    }
  }
}
