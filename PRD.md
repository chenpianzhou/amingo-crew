# Amingo PRD v1

> **一句话定位**：让一群密友在各自的地方拍同一个主题的 3 秒视频，AI 自动识别主题并拼成分屏成片，可以分享到社媒——制造"我们在做同一件事"的友谊仪式感。

---

## 1. 背景与动机

### 1.1 要解决的问题

异地密友想拍"合照/合拍"但做不到——不在同一个地方。现有方案（iMessage 发照片、CapCut 手动拼）要么拍完就沉进聊天记录（没有作品感），要么操作太重（12 步才能出一条分屏视频）。

### 1.2 核心洞察

社媒上 #longdistancebesties 等"异地朋友同主题拍摄"的趋势已经验证了需求——人们**已经在做这件事**，只是流程太痛苦所以只在特殊场合做。Amingo 要把 12 步变成 1 步。

### 1.3 产品灵魂

- **"我拍了，你也来"**——不是工具，是一个邀请
- **同频感**——同一个主题、不同的人、不同的地方，放一起就是"我们有多像"的证据
- **零压力**——不打卡、不限时、不催。你想拍就拍，产品只管拼

---

## 2. 目标用户

| 维度 | 描述 |
|---|---|
| 核心人群 | 18-25 岁，有 2-5 个异地密友的大学生/刚毕业年轻人 |
| 关系类型 | 高中好友各奔东西、异地闺蜜/兄弟、跨城情侣 |
| 使用设备 | 手机（iOS Safari / Android Chrome 为主），Web App |
| 地区 | 美国优先（目标用户是美国大学生） |

---

## 3. 用户故事

### 3.1 核心故事

> Mia 在纽约咖啡馆拍了一杯拿铁（3 秒）→ Amingo 自动识别为"Drink" → Sara 在东京收到提醒"Mia filmed ☕ Drink" → Sara 打开 app，看到 Mia 的拿铁 + 自己的空位（+号）→ 点 + 拍了自己的奶茶 → 两杯饮料自动上下分屏 → Sara 发到 IG story："across the pacific but still drinking together ☕"

### 3.2 其他故事

- **Alex 随手拍了一张自拍** → AI 识别"Selfie" → 新主题卡出现在所有人的 feed 里 → 朋友们陆续拍自己的自拍填进去
- **Mia 这周在 Food 主题里已经拍过一次了** → 她又拍了一个汉堡 → 她在 Food 卡里的那行分成了两个小格（面 + 汉堡）
- **周日晚上** → 本周所有主题自动归档 → 新一周从空白开始
- **三个人都拍了 Drink** → 点 ▶ share → 生成竖屏三分屏视频（拿铁 / 奶茶 / 可乐）+ 底部半透明标题"☕ Drink" → 可下载/分享

---

## 4. 功能清单与优先级

### P0：必须有（MVP）

| # | 功能 | 描述 |
|---|---|---|
| 1 | **创建/加入 crew** | 输入名字创建 crew → 得到邀请链接；朋友打开链接输入名字加入 |
| 2 | **拍摄（3 秒）** | 点击快门 → 录制 3 秒自动停止 → 自动上传。支持前后摄像头翻转 |
| 3 | **AI 主题识别** | 拍完抓一帧 → 发到服务端 → Claude Vision (Haiku 4.5) 识别 → 返回一个宽泛生活类别关键词（如 Food/Drink/Selfie/Outdoor）|
| 4 | **自动归类** | AI 返回的类别如果 crew 已有该主题 → 归入；如果是新类别 → 自动创建新主题卡。AI 识别不出 → 归入"Moments"（无主题区）|
| 5 | **主题卡左右滑动浏览** | 首页 = 左右滑动的全屏竖屏卡片。每张卡 = 一个主题的分屏预览（视频循环播放）。底部圆点指示当前位置 |
| 6 | **分屏布局** | 每张主题卡内：每个 crew 成员占一行（上下分屏）。拍过的 → 显示视频缩略图；没拍的 → 显示 + 号 |
| 7 | **从 + 号拍摄** | 点主题卡里的 + 号 → 直接进相机 → 相机里飘过该主题的幽灵文字（淡淡显示 3.5 秒后消失）→ 拍完自动归入该主题（跳过 AI 识别）|
| 8 | **自由拍摄** | 底部绿色拍摄按钮 → 进相机（无主题提示）→ 拍完走 AI 识别流程 |
| 9 | **同人同主题多次拍摄** | 同一个人在同一主题下拍了多条 → 该人的行分成多个并排小格 + 右边一个 + 号可以继续拍 |
| 10 | **Nudge 通知** | 任何人拍了视频并创建/归入主题 → crew 内所有人收到通知："Sara filmed ☕ Drink" |
| 11 | **单主题成片导出** | 点主题卡右上角 ▶ share → 服务端用 ffmpeg 合成竖屏分屏视频 → 返回可下载/分享的 mp4 |
| 12 | **Session 持久化** | crewId/memberId 存 localStorage，刷新/关闭再打开不丢。crew 数据 + 视频文件存服务端持久化存储 |
| 13 | **最右卡片 = 新建入口** | 卡片列表最右一张 = "film something new" + 拍摄按钮，点击进相机 |

### P1：重要但可延后

| # | 功能 | 描述 |
|---|---|---|
| 14 | **Mix All 混剪** | 把当前所有主题各取一段，串成一条 10-15 秒混剪视频 |
| 15 | **周维度归档** | 每周日自动把本周所有内容归入"往期"，新一周空白开始 |
| 16 | **成片标题叠加** | 导出视频时每个主题段底部叠加半透明标题条（emoji + 主题名） |
| 17 | **Admin 下载页** | `/admin.html?crew=xxx` → 列出所有 clip + 逐条下载按钮（仅管理者使用）|

### P2：锦上添花

| # | 功能 | 描述 |
|---|---|---|
| 18 | Widget 入口 | iOS/Android 桌面 widget 显示朋友最新视频，点击直接进相机 |
| 19 | 历史回看 | 往期归档的每周内容可翻看 |
| 20 | 视频转 mp4 | 服务端自动将 webm 转 mp4（兼容 iOS Safari 播放）|

### 明确不做（非目标）

- ❌ 公开 feed / 算法推荐 / 发现页
- ❌ 点赞 / 评论 / 转发
- ❌ 聊天 / IM
- ❌ 用户注册 / 密码 / 邮箱验证（链接即身份）
- ❌ 每日打卡 / 限时 / 断签 / 任何形式的催促
- ❌ AI 自动成片（用户主动点 share 才生成）

---

## 5. 详细交互流程

### 5.1 Onboarding

```
┌─────────────────────────────────┐
│ 场景 A：新用户（无邀请链接）        │
│                                 │
│ 打开 app                         │
│  → 看到 Onboarding 页             │
│     - 标题：AMINGO                │
│     - 副标题：film 3s clips with  │
│       your crew, same topic,     │
│       different takes            │
│     - 输入框：your name            │
│     - 按钮：START A CREW          │
│  → 输入名字 → 点 START             │
│  → 创建 crew → 进入主页            │
│  → 主页空白，只有"film something   │
│    new"那张卡                     │
│                                 │
│ 场景 B：通过邀请链接               │
│                                 │
│ 打开 /join/xxxx                   │
│  → Onboarding 页，但：            │
│     - 副标题变成"Sara's crew"     │
│     - 按钮变成 JOIN CREW          │
│  → 输入名字 → 点 JOIN             │
│  → 加入 crew → 进入主页            │
│  → 能看到 crew 里已有的内容        │
└─────────────────────────────────┘
```

### 5.2 主页（左右滑动卡片）

```
结构：
[主题卡A] ← 滑动 → [主题卡B] ← 滑动 → [Moments] ← 滑动 → [film new]

排序规则：
- 有空位的卡（等你拍的）在前
- 已完成的卡在后
- "film something new" 永远在最右

每张主题卡内部：
┌────────────────┐
│ ☕ Drink    ▶   │  ← 顶部：emoji + 主题名 + share 按钮
│ ┌────────────┐ │
│ │  Mia 的拿铁  │ │  ← 第一行：Mia 的视频（循环播放）
│ │──────────── │ │
│ │  Sara 的奶茶 │ │  ← 第二行：Sara 的视频
│ │──────────── │ │
│ │    + Alex    │ │  ← 第三行：Alex 还没拍，显示 +
│ └────────────┘ │
└────────────────┘

如果某人拍了多条（如 Mia 拍了 2 次 Drink）：
│ ┌──────┬──────┬──┐ │
│ │ 拿铁  │ 啤酒  │ + │ │  ← Mia 的行分成多格
│ └──────┴──────┴──┘ │
```

### 5.3 拍摄流程

```
入口 1：点主题卡里的 + 号
  → 相机全屏打开
  → 幽灵文字飘过（如"☕\nDrink"，12% 透明度，3.5 秒消失）
  → 点快门 → 录 3 秒自动停
  → 自动关闭相机 → 自动上传（归入该主题）→ 刷新卡片
  → 不走 AI 识别（主题已确定）

入口 2：点底部绿色拍摄按钮 / 最右"film new"卡
  → 相机全屏打开（无幽灵文字）
  → 点快门 → 录 3 秒自动停
  → 自动关闭相机
  → 抓一帧 → 发服务端 Claude Vision 识别
  → AI 返回类别（如"Food"）→ 匹配已有主题 or 创建新主题
  → AI 识别不出 → 归入 Moments
  → 上传 + 刷新卡片

相机功能：
  - 右上角：🔄 翻转摄像头按钮
  - 左上角：✕ 关闭
  - 录制时：顶部显示红点 + 倒计时（0:03 → 0:02 → 0:01）
  - 相机边框变红（录制状态指示）
  - 左下角：📂 从相册上传入口（仅接受 video/*）
```

### 5.4 成片导出

```
触发：点主题卡右上角 ▶ share

服务端处理（ffmpeg）：
  1. 取该主题下所有 clip
  2. 每个成员取最新的 N 条视频
  3. 按成员数决定布局：
     - 2 人 → 上下二分屏
     - 3 人 → 上中下三分屏
     - 4 人 → 田字格（2×2）
     - 5+ 人 → 上下等分
  4. 每段 normalize 到 1080×1920 竖屏 30fps
  5. 底部叠加半透明标题条（emoji + 主题名）[P1]
  6. 输出 mp4

返回给前端 → 弹出视频播放 + 下载/分享按钮
```

### 5.5 Nudge 通知

```
触发条件：任何人的视频被归入一个主题时（AI 识别或从 + 号拍摄）

通知内容："{name} filmed {emoji} {category}"
  例："Sara filmed ☕ Drink"

展示方式：顶部滑下横幅（4 秒后自动消失）
点击横幅 → 打开相机

不通知：
  - 不通知自己（自己拍的不给自己 nudge）
  - 归入 Moments 的不通知（无主题 = 不召唤）
```

### 5.6 周维度归档 [P1]

```
每周日 23:59（UTC）：
  → 本周所有主题卡 + clips 打包存入"往期"
  → 主页清空，新一周从空白开始
  → 往期数据不删除，存在历史里可回看
```

---

## 6. AI 主题识别

### 6.1 调用方式

- **模型**：Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **输入**：一帧 JPEG（从录制的视频中抓取，base64 编码）
- **Prompt**：

```
You are a social media photo tag assistant. Look at this image and return ONLY 1-2 words: the broadest lifestyle category it belongs to.

Examples: Food, Drink, Selfie, OOTD, Pet, Outdoor, Daily, Cozy, Sports, Music.

Return ONLY the English word(s), nothing else.
```

- **输出**：一个英文单词（如 "Food"）
- **Emoji 映射**：服务端根据返回词匹配 emoji（food→🍔, drink→☕, selfie→🤳 等）
- **失败处理**：识别失败 / 返回为空 → 归入 Moments（无主题）

### 6.2 成本估算

- Haiku 4.5 input: ~$0.001/image (小图 base64)
- 每人每天 ~3-5 条 → 每 crew 每天 ~$0.01-0.02
- 可控，不需要限速

---

## 7. 数据模型

```
Crew {
  id: string (8 char hex)
  members: [
    { id: string, name: string }
  ]
  clips: [
    {
      id: string
      memberId: string
      memberName: string
      file: string          // 文件名（如 "abc123_def456.mp4"）
      thumb: string | null  // base64 缩略图
      category: string | null  // AI 识别的主题（如 "Food"），null = Moments
      emoji: string | null     // 对应 emoji（如 "🍔"）
      ts: number               // 上传时间戳
    }
  ]
  nudges: [
    { from: string, category: string, emoji: string, ts: number }
  ]
}
```

**持久化**：
- 数据：`crews.json` 文件（读写磁盘）
- 视频文件：`uploads/` 目录
- Railway 部署时挂载 Volume 到 `/data`，数据 + 文件都存 Volume（重启/重部署不丢）

**[假设：MVP 阶段用 JSON 文件存储足够。用户量超过 ~100 个 crew 后需迁移到数据库（如 SQLite 或 PostgreSQL）]**

---

## 8. API 设计

| Method | Path | 描述 | 请求 | 响应 |
|---|---|---|---|---|
| POST | `/api/crew` | 创建 crew | `{name}` | `{crewId, memberId, joinUrl}` |
| POST | `/api/crew/:id/join` | 加入 crew | `{name}` | `{crewId, memberId, members}` |
| GET | `/api/crew/:id` | 获取 crew 状态 | - | `{id, members, clips, nudges}` |
| POST | `/api/crew/:id/clip` | 上传视频 | FormData: clip(file), memberId, thumb, category, emoji | `{ok, clip}` |
| POST | `/api/crew/:id/nudge` | 发送 nudge | `{memberId, category, emoji}` | `{ok}` |
| GET | `/api/crew/:id/nudges?since=ts` | 轮询新 nudge | - | `{nudges[]}` |
| POST | `/api/crew/:id/export` | 导出成片 | - | `{videoUrl}` |
| POST | `/api/vision` | AI 识别图片 | `{image: base64}` | `{label, emoji}` |
| GET | `/api/crew/:id/download/:clipId` | 下载原始视频 | - | 文件流 |
| GET | `/join/:crewId` | 加入页面（返回前端 HTML） | - | HTML |

---

## 9. 异常流与边界条件

| 场景 | 处理方式 |
|---|---|
| 相机权限被拒 | 显示上传入口（📂），隐藏快门按钮 |
| 录制时 app 切后台 | 停止录制，保留已录制的部分，走正常上传流程 |
| 上传失败（网络断） | toast "upload failed"，视频保留在本地 blob，用户可重试（刷新页面后丢失）|
| AI 识别超时（>5s） | 走 fallback → 归入 Moments |
| AI 识别返回乱码 | 视为识别失败 → 归入 Moments |
| webm 转 mp4 失败 | 保留原始 webm 文件，前端用 `<video>` 播放（部分 iOS 不兼容 webm）|
| crew 不存在（localStorage 存了旧 crewId） | API 返回 404 → 前端清除 localStorage → 刷新回 Onboarding |
| 同名成员 join | 视为同一人，返回已有的 memberId |
| crew 成员数上限 | **[假设：暂不设上限，建议 ≤8 人（分屏超过 8 格太小）]** |
| 视频时长非 3 秒（上传的文件可能更长） | 服务端合成时 `-t 3` 截断 |
| 空 crew（无 clips）点 export | 返回 `{error: "no clips yet"}` |

---

## 10. 成功指标

| 指标 | 定义 | 目标 |
|---|---|---|
| **D7 回拍率** | 创建 crew 后第 7 天仍有人拍新视频的 crew 占比 | ≥30% |
| **crew 完成率** | 某主题下所有成员都拍了的比例 | ≥50% |
| **分享率** | 点了 ▶ share 的主题卡数 / 已完成主题卡总数 | ≥20% |
| **邀请转化** | 收到邀请链接 → 实际加入 crew 的比例 | ≥60% |

**[假设：以上目标基于 BeReal/Locket 同类产品的早期数据推算，需实际验证后调整]**

---

## 11. 技术方案

| 组件 | 技术选型 | 说明 |
|---|---|---|
| 前端 | 单个 HTML（Vanilla JS） | 无框架，轻量，PWA 潜力 |
| 后端 | Node.js + Express | API 服务 |
| 文件上传 | multer | 处理 multipart/form-data |
| 视频处理 | ffmpeg (ffmpeg-static) | webm→mp4 转码 + 分屏合成 + 标题叠加 |
| AI 识别 | Claude Haiku 4.5 API | 图片→主题关键词 |
| 数据存储 | JSON 文件 + 文件系统 | MVP 阶段够用 |
| 部署 | Railway (Docker + Volume) | 持久化存储，永久链接 |
| 容器 | Dockerfile (node:24-slim + ffmpeg) | 确保 ffmpeg 可用 |

---

## 12. 待确认问题

1. **[假设]** 周维度归档的具体时间：周日 23:59 UTC？还是跟用户时区走？
2. **[假设]** crew 成员上限 8 人——是否需要更大？
3. **[假设]** 视频存储空间：每条 3 秒视频 ≈ 1-3MB，100 个 crew × 每周 20 条 ≈ 2-6GB/周。Railway Volume 空间是否足够？何时需要迁移到 S3？
4. **[假设]** Moments（无主题）是否需要分享功能？目前只有有主题的卡片有 ▶ share。
5. **[待定]** mix all 混剪的具体交互：是一个按钮在哪里？自动生成还是手动选主题？
6. **[待定]** 成片是否需要配音乐/音效？目前是静音的。
7. **[待定]** 是否需要 Web Push Notification（目前 nudge 只在 app 内轮询显示，关了 app 收不到）。
