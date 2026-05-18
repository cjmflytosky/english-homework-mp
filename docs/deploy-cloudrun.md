# 微信云托管部署指南

把 NestJS 后端跑到「微信云托管」，小程序通过 `wx.cloud.callContainer` 调用，
不需要 ICP 备案、不需要配置「合法域名」白名单。

---

## 0. 前置条件

- 小程序 AppID：`wx349b23c8e1fb7885`（项目已有）
- 微信公众平台 → **开发管理 → 云托管 → 开通服务**
- 开通时会自动创建一个云开发环境，记下 **环境 ID**（形如 `prod-xxxxxx`）

> 也可以从 https://cloud.weixin.qq.com 直接进入云托管控制台开通。

---

## 1. 准备 MySQL

云托管控制台 → **数据库 → 新建实例 → MySQL 8.x**，选最低配（开发期足够）。
新建完成后记下：

- 内网连接地址 `host`（云托管容器只能通过内网连接，不会走公网）
- 端口 `3306`
- 用户名 / 密码
- 库名（如 `xc_homework`）

拼出连接串：
```
mysql://USER:PASS@HOST:3306/xc_homework?connection_limit=10
```

---

## 2. 创建云托管服务

云托管控制台 → **服务管理 → 新建服务**：

| 项 | 值 |
| --- | --- |
| 服务名 | `xc-homework-backend`（与 `miniprogram/config/index.ts` 中 `cloud.service` 保持一致） |
| 服务地域 | 选离 MySQL 同地域 |
| 流水线模式 | 「上传代码包」最简单，也支持「代码仓库」自动构建 |

---

## 3. 上传代码 / 构建镜像

进入服务详情 → **新建版本**：

### 方式 A：本地源码上传（最快，适合首次）

1. 把 `backend/` 整个目录打包成 zip（**不要包含 node_modules**）
2. 选「上传代码包」→ 上传 zip
3. 构建目录：`/`
4. Dockerfile 路径：`/Dockerfile`（项目已有）
5. 端口：`3000`
6. 提交后云托管会自动构建镜像

### 方式 B：CODING / GitHub 仓库（推荐长期使用）

1. 把代码推到 Git 仓库
2. 服务详情 → 新建版本 → 「代码仓库」→ 授权连接
3. 分支选 `main`，构建目录 `backend`，Dockerfile 路径 `Dockerfile`
4. 后续 push 自动触发构建

---

## 4. 配置环境变量

服务详情 → **版本管理 → 编辑版本 → 环境变量**，至少填：

```
NODE_ENV=production
PORT=3000
APP_GLOBAL_PREFIX=api

DATABASE_URL=mysql://USER:PASS@MYSQL_HOST:3306/xc_homework?connection_limit=10

JWT_SECRET=<32 位以上随机字符串>
JWT_EXPIRES_IN=7d

# 微信登录：云托管内的请求会自带 X-Wx-Openid 头，但当前后端走 jscode2session 模式
WECHAT_APPID=wx349b23c8e1fb7885
WECHAT_SECRET=<在微信公众平台 → 开发 → 开发设置 里复制>
WECHAT_MOCK_LOGIN=false

# 存储 / 评测先保持 mock，等正式接 COS / SOE 再切
COS_MOCK=true
SOE_MOCK=true
```

> 生产环境务必 `WECHAT_MOCK_LOGIN=false`，否则任何人构造 `mock-xxx` code 都能登录。

---

## 5. 健康检查

服务详情 → **版本管理 → 高级设置 → 健康检查路径**：

```
/api/health
```

期望响应 `{ status: 'ok' }`，项目已实现 `GET /api/health`。

---

## 6. 数据库迁移

容器启动命令是：
```
npx prisma migrate deploy && node dist/main.js
```

首次发布会自动跑 `prisma/migrations/` 下所有 SQL。若 migrations 目录里还
没有 `add_teacher_comment` 这一条，请先在**本地**跑一次：

```powershell
cd backend
npx prisma migrate dev --name stage5_teacher_managed_class
git add prisma/migrations/
```

然后重新打包上传。

> 初始超管账号需要手动跑一次种子。两种方式：
> - 在云托管控制台 → 服务详情 → **WebShell** → `npx ts-node prisma/seed.ts`
> - 或在第一次构建时改 Dockerfile 的 CMD 多加一句 `npx ts-node prisma/seed.ts`

---

## 7. 小程序切到 cloudrun

`miniprogram/config/index.ts`：

```ts
export const AppConfig = {
  deployMode: 'cloudrun',              // ← 改这里
  apiBaseUrl: 'http://localhost:3000/api',   // cloudrun 模式下基本不用
  cloud: {
    env: 'prod-xxxxxx',                // ← 你的云开发环境 ID
    service: 'xc-homework-backend',
    pathPrefix: '/api',
    publicUploadUrl: 'https://xc-homework-backend-xxxx.ap-shanghai.run.tcloudbase.com',
    // ↑ 服务详情 → 公网访问 → 自动域名 复制；用于录音上传 multipart
  },
  timeout: 10000,
};
```

> `wx.cloud.callContainer` 走的是云托管内部 RPC 通道，所以**不需要**在
> 小程序后台配置 request 合法域名。但 `wx.uploadFile` 仍走 HTTPS，
> 所以 `publicUploadUrl` 这个域名需要在 **微信公众平台 → 开发设置 →
> 服务器域名 → uploadFile 合法域名** 里加白名单。

---

## 8. 管理后台部署

后台是纯前端 Vue，独立部署即可：

```powershell
cd admin
npm run build           # 产物在 dist/
```

把 `admin/dist/` 上传到任意静态 hosting：腾讯云 COS + CDN / Vercel /
Nginx 都行。`.env` 里设：

```
VITE_API_BASE_URL=https://xc-homework-backend-xxxx.ap-shanghai.run.tcloudbase.com/api
```

> 后台不走 `callContainer`（那是小程序专属 API），必须用云托管的公网域名。

---

## 9. 常见坑

| 现象 | 原因 / 修复 |
| --- | --- |
| 小程序提示「找不到 wx.cloud」 | 基础库 < 2.2.3。**详情 → 本地设置 → 调试基础库** 升级 |
| `callContainer` 报 -501007 | 没在 `app.ts` 里 `wx.cloud.init({ env })` |
| 报 -501005 / 服务不可达 | env 或 service 名拼写错；或服务还在构建中 |
| 容器一直 502 | 健康检查路径错；或 `DATABASE_URL` 错；看「日志中心」 |
| Prisma 报 `Can't reach database` | MySQL 内网地址错；或 MySQL 与服务不同地域 |
| 上传录音失败 | `publicUploadUrl` 未填，或没加到 uploadFile 合法域名白名单 |

---

## 10. 联调验证

```bash
# 服务详情 → 公网访问 拿到公网域名后，直接 curl 测一下
curl https://xc-homework-backend-xxxx.ap-shanghai.run.tcloudbase.com/api/health
# → {"success":true,"code":0,"message":"success","data":{"status":"ok","ts":"..."}}
```

后台 → 班级管理 → 新建班级 → 通；小程序登录 → 个人中心看到空班级，
后台把学生加入班级 → 小程序刷新就有作业了。
