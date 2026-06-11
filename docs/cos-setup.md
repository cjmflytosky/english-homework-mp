# 录音云端存储（腾讯云 COS）配置指引

学生录音通过「小程序 → 后端 `/storage/upload` → 腾讯云 COS」服务端代传，存为**公有读永久 URL**，写入数据库 `Submission.audioUrl`。
本指引带你从零开通 COS 并把它接上线上环境。全程约 15 分钟。

> 代码已实现完毕（`backend/src/modules/storage/storage.service.ts`），你只需要准备 COS 资源并填环境变量。

---

## 1. 开通 COS 并创建存储桶

1. 登录腾讯云控制台 → 进入 **对象存储 COS**：https://console.cloud.tencent.com/cos
2. 首次使用点「开通」（免费，按量计费，录音量很小，月成本几乎可忽略）。
3. 点 **创建存储桶**，关键设置：
   - **所属地域**：选 **广州（ap-guangzhou）**（和云托管同地域，内网更快、更便宜）。
     若你云托管在别的地域，这里跟着改，并同步改环境变量 `COS_REGION`。
   - **访问权限**：选 **公有读私有写（public-read）**。
     > 这是本方案的前提：录音 URL 永久可直接播放，老师端、学生端无需鉴权即可访问。
   - 名称随意，如 `xc-homework`。创建后真实桶名会带上 APPID，形如 `xc-homework-1250000000`，**记下这个完整桶名**。

---

## 2. 取访问密钥（建议用子账号，最小权限）

最省事但**不推荐**：直接用主账号密钥（https://console.cloud.tencent.com/cam/capi）。
**推荐**：建一个只能操作这个桶的子账号，泄露风险可控。

子账号做法（CAM）：
1. 访问管理 CAM → 用户 → 新建用户 → 自定义创建 → 勾选「编程访问」。
2. 策略：搜索并关联 `QcloudCOSDataFullControl`（或自定义只授权该桶的读写）。
3. 创建完成，**记下 SecretId 和 SecretKey**（SecretKey 只显示一次）。

---

## 3. 填到微信云托管环境变量

进入 [微信云托管控制台](https://cloud.weixin.qq.com/) → 你的服务 `xc-homework-backend` → **服务设置 / 版本环境变量**，新增/确认以下 4 项：

| 变量名 | 值 |
|--------|-----|
| `COS_MOCK` | `false` |
| `COS_REGION` | `ap-guangzhou`（与桶地域一致） |
| `COS_BUCKET` | 第 1 步记下的完整桶名，如 `xc-homework-1250000000` |
| `COS_SECRET_ID` | 第 2 步的 SecretId |
| `COS_SECRET_KEY` | 第 2 步的 SecretKey |

> `container.config.json` 里已把 `COS_MOCK` 设为 `false` 并留了占位提示，
> 但 **SecretId/SecretKey 属敏感信息，只填在控制台，不要写进代码仓库**。
> 改完环境变量后需 **重新部署** 一个版本才生效。

---

## 4. ⚠️ 把 COS 域名加入小程序合法域名（否则真机放不出录音）

录音播放是用 `wx` 直接访问 COS 的 `https://...myqcloud.com/...`。微信要求这个域名在白名单里：

微信公众平台 → 小程序 → **开发管理 → 开发设置 → 服务器域名**：
- 在 **downloadFile 合法域名** 添加：`https://<你的桶名>.cos.<地域>.myqcloud.com`
  例：`https://xc-homework-1250000000.cos.ap-guangzhou.myqcloud.com`

> 这一步最容易漏。DevTools 里勾「不校验合法域名」能放，但**真机/线上必须配**，否则学生录音上传成功却播不出来。

---

## 5. 验证

1. 重新部署后端版本。
2. 小程序里完成一次录音作业提交。
3. 检查：
   - COS 控制台 → 该桶 → 文件列表，应出现 `audios/YYYYMMDD/xxxx.mp3`。
   - 数据库 `Submission.audioUrl` 是 `https://...myqcloud.com/audios/...` 形式。
   - 老师端 / 真机点击播放能正常出声。
4. 如上传报错，看云托管日志里 `[cos] upload failed ...`：
   - `AccessDenied` → 密钥无权限，或桶名/地域填错。
   - 桶不存在 → `COS_BUCKET` 要用带 APPID 的完整名。

---

## 本地联调说明

本地开发默认 `COS_MOCK=true`（写到 `backend/uploads/`，仅本机能访问），无需 COS 密钥。
要在本地测真实 COS，把 `backend/.env` 的 `COS_MOCK=false` 并填上 4 个 COS_* 变量即可。

## 成本与清理（可选）

录音文件只增不减。若要控制成本，可在 COS 桶配置 **生命周期规则**，对 `audios/` 前缀设定 N 天后转低频存储或删除。
