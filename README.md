# 星创想 · 英语跟读 / 背诵作业系统

一套面向 K12 英语作业场景的 MVP：老师在后台布置跟读 / 背诵作业，学生在小程序里录音并自动评分，教师查看完成率、分数、录音和老师点评。

## 技术栈

| 端 | 技术 |
|---|---|
| 学生端 | 微信原生小程序 + TypeScript |
| 后端 | NestJS 10 + TypeScript + Prisma 5 + MySQL 8 |
| 管理后台 | Vue 3 + Vite + TypeScript + Element Plus |
| 文件存储 | 腾讯云 COS（MVP 走 mock，目录留 `backend/uploads/`） |
| 语音评测 | 腾讯云 SOE（MVP 走 mock，按分数段返回模拟评分） |
| 部署 | 微信云托管（Dockerfile 已就绪） |

## 目录结构

```
.
├── miniprogram/        学生端小程序（TS 源，wx 开发工具自动编译）
├── backend/            NestJS 后端（Dockerfile + Prisma schema + 模块化）
├── admin/              Vue3 管理后台
├── docs/               架构 / 部署 / 决策文档
├── cloudfunctions/     旧云开发模板（不再使用，保留备份）
└── 开发文档.md         产品 PRD（业务字段定义）
```

## 阶段进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 基础框架 | 三端骨架、统一响应、JWT 鉴权、wx 登录、admin 登录、个人中心 | ✅ |
| 2 作业任务 | Homework / Assignment 模块、学生作业列表与详情、老师发布 | ✅ |
| 3 录音评分 | 录音上传（COS 预留）、SOE 评分（mock）、单题 / 整体分数 | ✅ |
| 4 提交统计 | 学生历史、教师批改面板、班级排名、Dashboard 统计图 | ✅ |
| 5 班级与点评 | 班级 / 学生管理、老师把学生加入班级、教师点评 | ✅ |

详细业务字段以 [`开发文档.md`](./开发文档.md) 为准。

## 快速开始（本地）

```powershell
# 1. 后端
cd backend
cp .env.example .env                 # 改 DATABASE_URL / JWT_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed                       # 创建默认超管 admin / admin123
npm run start:dev                     # http://localhost:3000/api

# 2. 管理后台
cd ../admin
cp .env.example .env.local
npm install
npm run dev                           # http://localhost:5173

# 3. 学生端
#    用微信开发者工具打开仓库根目录，appid 看 project.config.json
#    详情 → 本地设置 → 勾选「不校验合法域名…」
#    miniprogram/config/index.ts:
#      deployMode = 'http'
#      apiBaseUrl = 'http://localhost:3000/api'
```

> 后端默认 `WECHAT_MOCK_LOGIN=true`，小程序登录按钮提交 `mock-xxx` 开头的 code 即可，免去真实微信交互。

## 部署到微信云托管

完整步骤见 [`docs/deploy-cloudrun.md`](./docs/deploy-cloudrun.md)。要点：

1. 微信公众平台 → 开发管理 → 云托管，开通服务并新建 MySQL
2. 新建服务，上传 `backend/` 源码包，端口 `3000`，健康检查 `/api/health`
3. 配置环境变量（至少 `DATABASE_URL` / `JWT_SECRET` / `WECHAT_APPID` / `WECHAT_SECRET` / `WECHAT_MOCK_LOGIN=false`）
4. 构建成功后，控制台 → WebShell 执行 `npx ts-node prisma/seed.ts` 初始化超管
5. 小程序 `miniprogram/config/index.ts`：
   ```ts
   deployMode: 'cloudrun',
   cloud: {
     env: 'prod-xxxxxx',
     service: '<服务名>',
     pathPrefix: '/api',
     publicUploadUrl: 'https://<服务公网域名>',
   }
   ```

## 接口约定

所有后端接口返回统一信封：

```json
{
  "success": true,
  "code": 0,
  "message": "ok",
  "data": { },
  "meta": { "total": 100, "page": 1, "pageSize": 20 }
}
```

- 需要鉴权的接口必须带：`Authorization: Bearer <jwt>`
- 标了 `@Public()` 的接口免鉴权（例如 `/api/health`、`/api/auth/admin-login`、`/api/auth/wx-login`）
- 字段命名遵循 camelCase，时间字段使用 ISO 字符串

## 模块清单（后端）

| 模块 | 职责 |
|---|---|
| `auth` | 学生 wx 登录、管理员账号登录、JWT 签发 |
| `user` | 学生「我」相关：我的资料、我的班级（只读） |
| `admin` | 管理后台「我」相关 |
| `class` | 班级 CRUD、邀请码、批量添加学生 |
| `student` | 学生列表 / 详情 / 启停 |
| `homework` | 作业题库 CRUD（含 items） |
| `assignment` | 作业派发到班级、学生端列表与详情 |
| `submission` | 单题录音 + 评分、整体提交、教师批改面板、点评、排名、历史 |
| `storage` | 文件上传抽象（mock 走本地 `uploads/`） |
| `speech` | 语音评测抽象（mock 走分数段映射） |
| `health` | 健康检查端点 |

## 默认账号

| 角色 | 账号 | 密码 | 备注 |
|---|---|---|---|
| 超管 | `admin` | `admin123` | 跑 `npm run db:seed` 自动创建 |
| 学生 | wx 登录 | — | mock 模式下 `code=mock-xxx` 即可登录 |

## 许可

私有项目，未授权请勿外传。
