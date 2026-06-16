/**
 * 从 backend/data/curriculum.yaml 同步整学期作业到数据库。
 *
 * 设计原则：
 *   - 完全 idempotent：可重复运行，不会重复创建数据
 *   - YAML 是单一可信源：删除 YAML 里某条 homework，下次同步会清理库里对应数据
 *   - 容器启动时由 docker-entrypoint.sh 调用（先于 NestJS 启动）
 *
 * 不在范围内（未来再做）：
 *   - 老师可以「关闭/激活」某个作业（status 字段）
 *   - 分班级的发布时间差异
 */
import { PrismaClient, HomeworkType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// ------------------------- 类型定义 -------------------------

interface CurriculumAdminDef {
  openId: string;
  role: 'ADMIN' | 'TEACHER';
  name?: string;
}

interface CurriculumClassDef {
  code: string;
  name: string;
  grade?: string;
}

interface CurriculumItemDef {
  text: string;
  translation?: string;
  /** 配图 URL（COS）—— 单词卡片作业用 */
  imageUrl?: string;
  refAudioUrl?: string;
}

interface CurriculumHomeworkDef {
  code: string;
  title: string;
  type: 'REPEAT' | 'RECITE' | 'WORD_CARD' | 'SENTENCE';
  description?: string;
  releaseAt: string;
  dueAt: string;
  classes?: string[];   // 班级 code 列表，空/未填 = 所有班级
  items: CurriculumItemDef[];
}

interface CurriculumFile {
  semester?: string;
  admins?: CurriculumAdminDef[];
  classes: CurriculumClassDef[];
  homeworks: CurriculumHomeworkDef[];
}

// ------------------------- 主流程 -------------------------

const SYSTEM_ADMIN_USERNAME = 'system';
const YAML_PATH = path.resolve(process.cwd(), 'data', 'curriculum.yaml');

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    if (!fs.existsSync(YAML_PATH)) {
      console.log(`[sync-curriculum] ${YAML_PATH} 不存在，跳过同步`);
      return;
    }

    const raw = fs.readFileSync(YAML_PATH, 'utf-8');
    const data = yaml.load(raw) as CurriculumFile;
    if (!data || !Array.isArray(data.classes) || !Array.isArray(data.homeworks)) {
      throw new Error('curriculum.yaml 格式不正确：缺少 classes 或 homeworks');
    }

    console.log(
      `[sync-curriculum] 学期 ${data.semester ?? '未命名'} | ` +
      `${data.classes.length} 个班 / ${data.homeworks.length} 个作业`,
    );

    const systemAdmin = await ensureSystemAdmin(prisma);
    const classByCode = await syncClasses(prisma, data.classes, systemAdmin.id);
    await syncHomeworks(prisma, data.homeworks, systemAdmin.id, classByCode);
    await cleanupRemoved(prisma, data.homeworks);
    await syncAdmins(prisma, data.admins ?? []);

    console.log('[sync-curriculum] 完成');
  } finally {
    await prisma.$disconnect();
  }
}

// ------------------------- 系统账号 -------------------------

async function ensureSystemAdmin(prisma: PrismaClient) {
  // 用于 createdBy 关联；不暴露登录入口
  return prisma.adminUser.upsert({
    where: { username: SYSTEM_ADMIN_USERNAME },
    create: {
      username: SYSTEM_ADMIN_USERNAME,
      password: '!disabled',  // 不能用来登录
      name: '系统',
      role: 'SUPER_ADMIN',
      enabled: false,
    },
    update: {},
  });
}

// ------------------------- 班级 -------------------------

async function syncClasses(
  prisma: PrismaClient,
  defs: CurriculumClassDef[],
  ownerId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const def of defs) {
    // 用 inviteCode 字段当业务码（学生加入班级时也用这个）
    const cls = await prisma.class.upsert({
      where: { inviteCode: def.code },
      create: {
        inviteCode: def.code,
        name: def.name,
        grade: def.grade,
        ownerId,
      },
      update: {
        name: def.name,
        grade: def.grade,
      },
    });
    map.set(def.code, cls.id);
    console.log(`[sync-curriculum]   ✓ 班级 ${def.code} → ${cls.id}`);
  }
  return map;
}

// ------------------------- 作业 -------------------------

async function syncHomeworks(
  prisma: PrismaClient,
  defs: CurriculumHomeworkDef[],
  creatorId: string,
  classByCode: Map<string, string>,
) {
  for (const def of defs) {
    const hw = await upsertHomework(prisma, def, creatorId);
    await upsertHomeworkItems(prisma, hw.id, def.items);
    await upsertAssignments(prisma, hw.id, def, creatorId, classByCode);
    console.log(`[sync-curriculum]   ✓ 作业 ${def.code}（${def.items.length} 题）`);
  }
}

async function upsertHomework(
  prisma: PrismaClient,
  def: CurriculumHomeworkDef,
  creatorId: string,
) {
  return prisma.homework.upsert({
    where: { code: def.code },
    create: {
      code: def.code,
      title: def.title,
      description: def.description,
      type: def.type as HomeworkType,
      createdById: creatorId,
    },
    update: {
      title: def.title,
      description: def.description,
      type: def.type as HomeworkType,
    },
  });
}

async function upsertHomeworkItems(
  prisma: PrismaClient,
  homeworkId: string,
  items: CurriculumItemDef[],
) {
  // 1) upsert 现有题（按 orderNo）
  for (let i = 0; i < items.length; i++) {
    const orderNo = i + 1;
    const it = items[i];
    await prisma.homeworkItem.upsert({
      where: {
        homeworkId_orderNo: { homeworkId, orderNo },
      },
      create: {
        homeworkId,
        orderNo,
        text: it.text,
        translation: it.translation,
        imageUrl: it.imageUrl,
        refAudioUrl: it.refAudioUrl,
      },
      update: {
        text: it.text,
        translation: it.translation,
        imageUrl: it.imageUrl,
        refAudioUrl: it.refAudioUrl,
      },
    });
  }
  // 2) 清理多余题（题数变少时）
  await prisma.homeworkItem.deleteMany({
    where: {
      homeworkId,
      orderNo: { gt: items.length },
    },
  });
}

async function upsertAssignments(
  prisma: PrismaClient,
  homeworkId: string,
  def: CurriculumHomeworkDef,
  creatorId: string,
  classByCode: Map<string, string>,
) {
  const targetClassIds =
    !def.classes || def.classes.length === 0
      ? Array.from(classByCode.values())
      : def.classes.map((code) => {
          const id = classByCode.get(code);
          if (!id) throw new Error(`作业 ${def.code} 引用了未定义的班级 ${code}`);
          return id;
        });

  const startAt = new Date(def.releaseAt.replace(' ', 'T'));
  const endAt = new Date(def.dueAt.replace(' ', 'T'));
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error(
      `作业 ${def.code} 时间格式错误：releaseAt=${def.releaseAt}, dueAt=${def.dueAt}`,
    );
  }

  // upsert 到每个目标班
  for (const classId of targetClassIds) {
    await prisma.assignment.upsert({
      where: { homeworkId_classId: { homeworkId, classId } },
      create: { homeworkId, classId, createdById: creatorId, startAt, endAt },
      update: { startAt, endAt },
    });
  }

  // 清理：本次未列出的班级对应 Assignment（说明作业不再发给该班）
  await prisma.assignment.deleteMany({
    where: {
      homeworkId,
      classId: { notIn: targetClassIds },
    },
  });
}

// ------------------------- 管理员升级 -------------------------

async function syncAdmins(
  prisma: PrismaClient,
  defs: CurriculumAdminDef[],
) {
  if (defs.length === 0) {
    console.log('[sync-curriculum]   ⚠️  curriculum.yaml 里没有配置任何 admin');
    console.log('[sync-curriculum]      首次部署后请按文件顶部说明添加你自己的 openId');
    return;
  }

  for (const def of defs) {
    const student = await prisma.student.findUnique({
      where: { openId: def.openId },
    });
    if (!student) {
      console.log(
        `[sync-curriculum]   ⚠️  openId ${def.openId} 对应的学生未登录过，` +
          `本次跳过；让该用户先登录一次小程序后再重新部署`,
      );
      continue;
    }
    await prisma.student.update({
      where: { id: student.id },
      data: {
        role: def.role,
        ...(def.name ? { realName: def.name } : {}),
      },
    });
    console.log(
      `[sync-curriculum]   ✓ ${def.name ?? student.nickname ?? def.openId.slice(0, 8)} → ${def.role}`,
    );
  }
}

// ------------------------- 清理 -------------------------

async function cleanupRemoved(
  prisma: PrismaClient,
  defs: CurriculumHomeworkDef[],
) {
  const validCodes = defs.map((d) => d.code);
  const removed = await prisma.homework.findMany({
    where: { code: { not: null, notIn: validCodes } },
    select: { code: true },
  });
  if (removed.length === 0) return;

  console.log(
    `[sync-curriculum] 清理 ${removed.length} 个已下线的作业：` +
      removed.map((r) => r.code).join(', '),
  );
  await prisma.homework.deleteMany({
    where: { code: { not: null, notIn: validCodes } },
  });
}

// ------------------------- 入口 -------------------------

main().catch((err) => {
  console.error('[sync-curriculum] 失败：', err);
  process.exit(1);
});
