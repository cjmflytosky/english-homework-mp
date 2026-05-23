# 幼儿课程作业（PICTURE_WORDS）设计稿

- **日期**：2026-05-23
- **作者**：cjmflytosky + Claude
- **关联**：MVP 范围扩展 — 在现有跟读 / 背诵作业系统上增加幼儿课程能力
- **状态**：设计已确认 → 待生成实施计划

---

## 1. 背景与目标

### 1.1 委托人需求

作业系统拆分为两条课程线：

- **少儿课程（KIDS）**：沿用现有 `REPEAT` / `RECITE` 类型，**逻辑完全不变**。
- **幼儿课程（TODDLER）**：新增类型 `PICTURE_WORDS`：
  - 作业形式 = 一张图片 + 若干物件（每个物件旁有白色对话框装的单词）
  - 学生点击白色单词 → 系统播放该单词朗读音 → 3 秒倒计时 → 嘟提示音 → 自动开始录音 → 学生跟读 → 点「完成」上传

参考素材：`homework/test1.jpg`（教材"Unit 5 - My House"扫描页，6 个单词：bath / cupboard / bed / sofa / table / armchair）。

### 1.2 设计目标

| 目标 | 怎么衡量 |
|---|---|
| 在现有 schema 上**做加法**，不动既有字段 | Homework / HomeworkItem 既有字段 0 改动 |
| 新增后端端点**尽量少** | 总计 5 个新端点（详见 §4） |
| KIDS 端零回归 | role + stage 双重路由，KIDS 学生看不到 PICTURE_WORDS |
| COS 未接入时也能整链路跑通 | 沿用 `cos.mock=true` 写本地磁盘 |

### 1.3 非目标（YAGNI）

- COS 真接入 — 等委托人开通后再切，当前 `cos.mock` 持续
- 云端 TTS API — 全部使用预录 mp3
- 老师录音回执 / 范读
- H5 后台
- 单作业多张图
- 自动图片旋转 / 裁切
- SOE 评分 — 已下线

---

## 2. 架构总览

```
┌───────────────────────────┐                  ┌──────────────────────────┐
│   curriculum.yaml         │                  │   管理员（小程序）       │
│   - 课程结构 + 单词 + 坐标 │                  │   admin-tools/资源管理   │
└─────────────┬─────────────┘                  │   上传图 + N 个 mp3      │
              │ sync-curriculum                └─────────────┬────────────┘
              │ (保留 DB 已上传的 URL)                       │
              ▼                                              ▼
                                              ┌──────────────────────────┐
                                              │   StorageService         │
                                              │   cos.mock=true          │
                                              │   → backend/uploads/     │
                                              └─────────────┬────────────┘
              ┌─────────────────────────────────────────────┘
              ▼
  ┌────────────────────────────────────────────────────────────┐
  │   MySQL（Prisma）                                          │
  │   - Class(stage)       - Homework(type, imageUrl)          │
  │   - HomeworkItem(text, hotspot, refAudioUrl)               │
  │   - Submission / SubmissionItem                            │
  │   - ItemReview(rating)                                     │
  └─────────────────────────┬──────────────────────────────────┘
                            │
       ┌────────────────────┼────────────────────────┐
       ▼                    ▼                        ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ TODDLER 学生 │  │ 老师 / 管理员    │  │ KIDS 学生        │
│ picture-task │  │ teacher-review-  │  │ task-content     │
│ (新页)       │  │ picture (新页)   │  │ (现有, 不动)     │
└──────────────┘  └──────────────────┘  └──────────────────┘
```

四条关键不变量：

1. **类型分流** — `Homework.type ∈ {REPEAT, RECITE, PICTURE_WORDS}`，前两者一行代码不动。
2. **课程分层** — `Student.stage` + `Class.stage` 决定学生在哪个端、看哪类作业。
3. **资源解耦** — YAML 是结构 + 热区坐标的可信源；图 / 音的二进制内容由管理员单独上传后写回 DB。
4. **存储抽象** — `StorageService.uploadBuffer()` 已有接口；今天 mock 本地，未来切 COS 只动 `storage.service.ts` 一个文件。

---

## 3. 数据模型扩展

### 3.1 新增 enum

```prisma
enum CourseStage {
  TODDLER
  KIDS
}

enum HomeworkType {
  REPEAT
  RECITE
  PICTURE_WORDS   // 新增
}

enum ItemRating {
  GOOD     // ✓ 棒
  OK       // ⚠ 加油
  RETRY    // ⨯ 重练
}
```

### 3.2 现有表加字段

```prisma
model Student {
  // ... 现有字段不动
  stage  CourseStage  @default(KIDS)
}

model Class {
  // ... 现有字段不动
  stage  CourseStage  @default(KIDS)
}

model Homework {
  // ... 现有字段不动
  type       HomeworkType
  imageUrl   String?    @map("image_url")    // 仅 PICTURE_WORDS 使用
}

model HomeworkItem {
  // ... 现有字段不动
  // refAudioUrl 沿用现有字段:
  //   - REPEAT/RECITE 时 = 范读音频
  //   - PICTURE_WORDS 时 = 单词朗读音
  // 复用而非新增字段, 保持 schema 干净
  hotspot       Json?   // {x, y, w, h} ∈ [0,1], 仅 PICTURE_WORDS
}

model SubmissionItem {
  // ... 现有字段不动
  review  ItemReview?   // 反向关系
}
```

### 3.3 新表

```prisma
model ItemReview {
  id               String     @id @default(cuid())
  submissionItemId String     @unique @map("submission_item_id")
  authorId         String     @map("author_id")  // = Student.id (老师)
  rating           ItemRating
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  submissionItem   SubmissionItem @relation(fields: [submissionItemId], references: [id], onDelete: Cascade)
  author           Student        @relation("ItemReviewAuthor", fields: [authorId], references: [id])

  @@map("item_review")
}
```

`Student` 加反向关系：

```prisma
model Student {
  // ...
  itemReviewsAuthored ItemReview[] @relation("ItemReviewAuthor")
}
```

### 3.4 默认值与迁移

- `Student.stage` 和 `Class.stage` 默认 `KIDS` → 旧数据零迁移、零回归。
- `Homework.imageUrl` / `HomeworkItem.hotspot` 都是 nullable → 旧 REPEAT/RECITE 数据不受影响。
- `HomeworkItem.refAudioUrl` 已存在，含义在新类型下扩展（管理员上传单词朗读音）。

---

## 4. API 改动总览

| 类别 | 端点 | 状态 |
|---|---|---|
| 学生端 | `GET /assignments`（按 stage 过滤） | 扩展过滤 |
| 学生端 | `GET /assignments/:id`（含 imageUrl/hotspot/refAudioUrl） | 扩展 response |
| 学生端 | `POST /storage/upload` | 现有，不改 |
| 学生端 | `POST /submissions/items` | 现有，不改 |
| 学生端 | `POST /submissions/:assignmentId/finalize` | 现有，不改 |
| 学生端 | `GET /submissions/by-assignment/:assignmentId` | 现有，response 扩展（含 review） |
| 老师端 | `GET /admin/submissions/:id`（含 review + image + hotspot） | 扩展 response |
| 老师端 | `PUT /admin/submission-items/:itemId/review` | **新增** |
| 老师端 | `DELETE /admin/submission-items/:itemId/review` | **新增** |
| 老师端 | `POST /admin/submissions/:id/comment` | 现有，不改 |
| 管理员 | `GET /admin/picture-homeworks?missingOnly=true` | **新增** |
| 管理员 | `PUT /admin/homework/:id/image` | **新增** |
| 管理员 | `PUT /admin/homework-item/:id/ref-audio` | **新增** |

**新增端点合计：5 个**（2 个评级 + 3 个资源管理）

---

## 5. 学生端交互

### 5.1 页面路由

```
登录成功（pages/login）
  ├─ role=STUDENT, stage=KIDS    → pages/home（现有）
  ├─ role=STUDENT, stage=TODDLER → pages/home（同页, 但作业列表仅 PICTURE_WORDS）
  └─ role=TEACHER/ADMIN          → pages/teacher-home（现有）

作业列表点开:
  if (homework.type === 'PICTURE_WORDS')
    → pages/picture-task?assignmentId=xxx   ← 新页
  else
    → pages/task-detail / task-content     ← 现有
```

### 5.2 新页 `pages/picture-task`

布局：

- 顶部：返回 + 作业标题
- 主体：整张 `imageUrl` 渲染 100% 宽，按 `hotspot` 绝对定位渲染 N 个热区
- 每个热区：状态徽标（⚪未录 / ⏱倒计时 / 🔴录音中 / ⏳上传中 / ✓已录）
- 底部：进度（"2 / 6"）+ 「提交全部」按钮

### 5.3 单热区状态机

```
IDLE
  ──tap──> PROMPT_PLAYING  （播 item.refAudioUrl）
              │ 播完
              ▼
           COUNTDOWN_3 → COUNTDOWN_2 → COUNTDOWN_1
              │ 到 0
              ▼
           BEEP          （播 miniprogram/assets/beep.mp3）
              │ 完
              ▼
           RECORDING     （wx.startRecord, ≤10s 自动停）
              │ tap「完成」 或 超时
              ▼
           UPLOADING     （/storage/upload → 拿到 audioUrl）
              │ 成功
              ▼
           ITEM_SAVING   （POST /submissions/items）
              │ 成功
              ▼
           DONE ✓
              │ tap → 弹「试听 / 重录」
              │ 重录
              ▼
           回到 IDLE
```

错误路径（任意阶段网络失败）：回到 IDLE，热区显示"!"小提示让学生重做。

### 5.4 关键约束

- **嘟声**：本地资源 `miniprogram/assets/beep.mp3`，约 100ms，不走网络。
- **录音上限**：10 秒；超时按「完成」处理。
- **互斥**：`RECORDING` 状态下其它热区**全部禁用**（防误触幼儿）。
- **断点续做**：`onShow` 重新拉 `GET /submissions/by-assignment/:id`，已录的词标 ✓。
- **提交按钮**：仅当**所有** items 都有对应 `SubmissionItem.audioUrl` 时高亮。
- **提交后**：跳 `pages/submit-result`（现有，不展示分数）。

### 5.5 学生看老师反馈

作业被点评后，学生再进入：

- 每个热区角标显示评级：✓棒 / ⚠加油 / ⨯重练 / `—`未评
- 顶部或底部显示老师总评文字
- **RETRY 的词允许重录并重新提交**（MVP 仅展示，不强制；策略后续细化）

---

## 6. 老师端批改

### 6.1 入口

`teacher-class`（现有，全班学生提交列表）点击某个学生：

```ts
if (assignment.homework.type === 'PICTURE_WORDS')
  → pages/teacher-review-picture?submissionId=xxx   ← 新页
else
  → pages/teacher-review?submissionId=xxx           ← 现有
```

### 6.2 新页 `pages/teacher-review-picture`

布局：

- 顶部：返回 + "学生姓名 · 作业标题"
- 主体：整张图 + 每个热区上叠"▶ 播放 + 当前评级角标"
- 选中态：点击热区下方显示"评价：[ ✓ 棒 ] [ ⚠ 加油 ] [ ⨯ 重练 ]"
- 底部：总评 textarea（沿用 `TeacherComment.content`）+ 「保存点评」

### 6.3 交互流

- 点热区 ▶ → 播该词的学生录音（`submissionItem.audioUrl`）
- 点 ✓/⚠/⨯ → 立即调 `PUT /admin/submission-items/:itemId/review`，UI 即时反馈
- 误点 → 再次点同一个评级 = 取消（调 DELETE）
- 总评 → 点「保存点评」→ 调现有 `POST /admin/submissions/:id/comment`

### 6.4 权限

复用 `assertTeacherOrAdmin`（已有 helper）。`ItemReview.authorId` 写当前老师的 `Student.id`。

---

## 7. 管理员上传 + sync 脚本 + 本地工具

### 7.1 小程序 `pages/admin-assets`（新页）

入口：`pages/admin-tools` 顶部加一个「📁 作业资源管理」入口。

布局：

- 顶部筛选：stage（幼儿 / 少儿）/ 缺图 / 缺音
- 列表：每个 PICTURE_WORDS 作业
  - 「上传图片」按钮（已传则显示缩略图 + 「替换」）
  - 子列表：每个 item 的「上传音频」按钮（已传则显示 ▶ + 「替换」）

API：

- `GET /admin/picture-homeworks?missingOnly=true` → 列表 + 资源完整度
- `PUT /admin/homework/:id/image` body `{url}` → 写回 imageUrl
- `PUT /admin/homework-item/:id/ref-audio` body `{url}` → 写回 refAudioUrl
- 上传二进制走现有 `POST /storage/upload`（不改）

权限：全部 `assertAdmin`。

### 7.2 sync-curriculum 改造

现有脚本会 upsert homework / item，**会覆盖所有字段**。改造后：

```ts
// YAML 拥有的字段:
//   {code, title, description, type, items[orderNo, text, translation, hotspot]}
// 管理员上传的字段（保护不被擦）:
//   {imageUrl (Homework), refAudioUrl (HomeworkItem)}

// upsert 策略:
//   homework.update 不写 imageUrl
//   item.update     不写 refAudioUrl
//   item.update     写 hotspot（YAML 是热区可信源）

// 边界条件:
//   - YAML 删掉一个 item → 删 DB item（旧逻辑保留）
//   - YAML 删掉整个 homework → 删 DB homework
//   - YAML 调整 item 数组顺序 → orderNo 按新顺序刷新；
//     refAudioUrl 通过 (homeworkCode, text) 复合匹配恢复，
//     若 text 也改过 → 视作新 item, 旧的删除（管理员需重传音）
```

### 7.3 本地坐标工具 `tools/hotspot-marker.html`

- 单文件 HTML（不依赖任何库），双击在浏览器打开
- 选图 → 鼠标拖框 → 输入单词 → 列表化 → 一键复制 YAML 片段
- 草稿存 `localStorage`
- 约 200 行 JS

### 7.4 curriculum.yaml 扩展示例

沿用现有格式（`assignments` 内嵌在 homework 的 `classes`/`releaseAt`/`dueAt` 字段；items 不写 orderNo，按数组顺序）：

```yaml
classes:
  - code: "T-A"
    name: "幼儿 A 班"
    grade: "学前"
    stage: TODDLER                  # 新字段（默认 KIDS, 旧班无需改）

homeworks:
  - code: "u5-my-house"
    title: "Unit 5 · My House"
    type: PICTURE_WORDS             # 新类型
    description: "看图认词：家里的物品"
    releaseAt: "2026-05-25 08:00"
    dueAt:     "2026-06-01 23:59"
    classes: ["T-A"]
    items:                          # orderNo 按数组顺序 1..N
      - text: "bath"
        hotspot: { x: 0.28, y: 0.18, w: 0.20, h: 0.07 }
      - text: "cupboard"
        hotspot: { x: 0.43, y: 0.55, w: 0.22, h: 0.07 }
      - text: "bed"
        hotspot: { x: 0.30, y: 0.35, w: 0.15, h: 0.07 }
      # ... 3 more
```

注意：`imageUrl` / item 的 `refAudioUrl` **不写在 YAML 里**，由管理员上传后写回 DB；sync 重跑保护这两字段。

---

## 8. 测试与回归

### 8.1 自动化

| 层 | 范围 | 工具 |
|---|---|---|
| 单元（后端） | sync-curriculum 保护 URL 不被擦；ItemReview upsert；stage 过滤 | Jest |
| 集成（后端） | `/storage/upload` + `/submissions/items` 联调；`PUT review` 端到端 | supertest |
| 工具 | `hotspot-marker.html` 拖框 → YAML 输出正确 | 手测 |

E2E 在微信小程序里无法用 Playwright 跑，依赖真机回归。

### 8.2 真机回归 checklist

- [ ] TODDLER 学生登录 → 仅看到 PICTURE_WORDS 作业列表
- [ ] KIDS 学生登录 → 仅看到 REPEAT/RECITE 作业列表
- [ ] 点单词 → TTS → 倒计时 → 嘟 → 录音 → 完成 → 上传成功 ✓
- [ ] 录音中点其它热区 → 被禁用
- [ ] 10 秒超时自动停止并上传
- [ ] 重录已录的词 → 旧录音被覆盖（按 `(submissionId, homeworkItemId)` unique）
- [ ] 退出页面再进 → 已录词标 ✓（断点续做）
- [ ] 未全部录完 → 提交按钮禁用
- [ ] 提交后 → 跳 submit-result，DB 状态变 SUBMITTED
- [ ] 老师端：听每词录音 → 三态打分 → 写总评 → 保存
- [ ] 学生再进作业 → 看到每词评级 + 总评
- [ ] 管理员上传图/音 → sync-curriculum 重跑后 URL 不丢
- [ ] 至少覆盖 1 个 iOS + 1 个安卓真机

---

## 9. 错误处理矩阵

| 场景 | 处理 |
|---|---|
| 学生首次拒绝录音权限 | toast + 引导去微信设置开权限 |
| `refAudioUrl` 加载失败 | 跳过 TTS 直接进倒计时，不阻塞 |
| 录音中网络断 | 录音文件留本地，上传时重试 3 次 |
| 上传成功但 `/submissions/items` 失败 | 前端回 IDLE，学生重做时覆盖 |
| `hotspot` 为 null（YAML 漏配） | 降级显示图下卡片列表 |
| `imageUrl` 为 null（管理员还没传） | 作业列表标"未就绪"，进入时提示"暂不可做" |
| 老师误点评级 | 再次点同一级 = DELETE 撤回 |

---

## 10. 已知风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| `cos.mock` 容器重启文件丢失 | 已上传的图/音/录音消失 | 委托人开通 COS 后切，当前重在跑通链路 |
| 嘟声 mp3 版权 | 音效来源 | 自录 100ms 短音 或用 CC0 库 |
| 大图渲染性能（教材扫描 5MB+） | 小程序加载慢，流量大 | 教研侧压缩至 1MB 内；后端 mock 上传时校验 ≤ 2MB |
| iOS 录音 API 行为差异 | 部分机型录音异常 | 真机回归覆盖至少 1 iOS + 1 安卓 |
| 幼儿误触多次点击 | UI 状态混乱 | RECORDING 时其它热区禁用 + 状态机防抖 |

---

## 11. 决策记录（FAQ）

**Q：为什么不接 COS / 云端 TTS？**
A：委托人 COS 账号尚未开通；MVP 用 `cos.mock` 跑通链路即可，未来切 COS 只动一个文件。TTS 用预录 mp3，零运行成本，质量可控。

**Q：为什么热区坐标在 YAML 而不是小程序里拖框？**
A：5 寸手机屏上拖 6 个热区是体力活；YAML 配合本地 `hotspot-marker.html` 在电脑上配 10 分钟搞定，还能 PR review。

**Q：为什么不新建 PictureWordsItem 表？**
A：PICTURE_WORDS 与 REPEAT/RECITE 的题目结构高度相似（每题 = 一段文字 + 参考音频）。新增 `hotspot?` 字段比建新表更省，老师端列表/批改逻辑也能复用。

**Q：为什么每词独立一次 HTTP 上传，而不是本地暂存批量上传？**
A：每词独立 = 用户操作和数据库状态严格对齐，断点续做 / 重录 / 网络抖动恢复全部自然支持。N 个单词 N 次 HTTP 请求在 N ≤ 10 的体量下完全可接受。

**Q：为什么用 Student.stage + Class.stage 两个字段？**
A：Student.stage 用于登录后路由（让学生只看到适合自己的作业）；Class.stage 用于约束老师布置作业时的类型（TODDLER 班只能布 PICTURE_WORDS，避免误布）。

---

## 12. 实施顺序建议（粗）

1. **数据层**：Prisma schema 改 → 迁移 → 跑通 `prisma db push`
2. **后端**：sync-curriculum 改造（保护 URL）→ stage 过滤 → 资源上传 API（3 个）→ ItemReview API（2 个）→ response 扩展
3. **工具**：`tools/hotspot-marker.html`（独立可先做）
4. **学生端**：`pages/picture-task` 状态机 + 录音流程
5. **老师端**：`pages/teacher-review-picture`
6. **管理员端**：`pages/admin-assets`
7. **YAML**：补 stage / 一个真实 PICTURE_WORDS 作业 + test1.jpg 的 6 个 hotspot
8. **真机回归**：跑 checklist
9. **提交**：commit + 部署云托管

详细任务拆解将在下一步 writing-plans 阶段产出。
