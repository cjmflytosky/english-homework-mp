/**
 * 初始化种子数据：
 *   - 超管账号 admin / admin123
 *   - 默认班级（inviteCode=DEFAULT），学生登录时自动加入；老师发布作业默认派发到此班级
 * 运行：npm run db:seed
 */
import { PrismaClient, AdminRole, StudentRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * 联调用固定账号：登录页 mock 登录传 code='mock-<x>' → 后端换出 openId='mock-openid-<x>'。
 * 这里按这些固定 openId 预置好角色，避免每次 mock 登录都新建一个 STUDENT 再手动升级。
 */
const MOCK_ACCOUNTS: Array<{ openId: string; nickname: string; role: StudentRole }> = [
  { openId: 'mock-openid-teacher', nickname: '测试老师', role: StudentRole.TEACHER },
  { openId: 'mock-openid-admin', nickname: '测试管理员', role: StudentRole.ADMIN },
];

async function main() {
  const username = 'admin';
  const plainPassword = 'admin123';

  let admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin) {
    const password = await bcrypt.hash(plainPassword, 10);
    admin = await prisma.adminUser.create({
      data: {
        username,
        password,
        name: '超级管理员',
        role: AdminRole.SUPER_ADMIN,
      },
    });
    console.log(`[seed] 已创建超管账号：${username} / ${plainPassword}`);
  } else {
    console.log(`[seed] 超管账号 ${username} 已存在`);
  }

  const defaultClass = await prisma.class.findUnique({
    where: { inviteCode: 'DEFAULT' },
  });
  if (!defaultClass) {
    await prisma.class.create({
      data: {
        name: '默认班级',
        grade: '全体',
        inviteCode: 'DEFAULT',
        ownerId: admin.id,
        remark: '系统默认班级；阶段 2 所有学生自动加入，所有作业默认派发到这里。',
      },
    });
    console.log('[seed] 已创建默认班级 (inviteCode=DEFAULT)');
  } else {
    console.log('[seed] 默认班级已存在');
  }

  // 联调固定账号（mock 登录用）
  for (const acc of MOCK_ACCOUNTS) {
    const s = await prisma.student.upsert({
      where: { openId: acc.openId },
      create: { openId: acc.openId, nickname: acc.nickname, role: acc.role },
      update: { role: acc.role },
    });
    console.log(`[seed] 固定账号 ${acc.nickname} (${acc.role}) → 登录 code=mock-${acc.openId.replace('mock-openid-', '')}; id=${s.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
