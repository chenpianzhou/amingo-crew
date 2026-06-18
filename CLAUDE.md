# CLAUDE.md — AMINGO 开发约定

给在本仓库工作的人（含 AI 助手）的速查。完整背景见 `README.md`。

## 这是什么

小队合拍 Web App：crew 内多人就同一主题各拍 2s clip → AI 识别归类 → 一键合成竖屏分屏成片。
**刻意做薄**：无数据库、无前端框架、无构建步骤。改动优先保持这种简单性。

## 代码地图

| 文件 | 职责 | 不要在这里放什么 |
|------|------|------------------|
| `server.js` | Express 路由、multer 上传、校验、错误兜底 | 业务算法（放 store/video/vision） |
| `store.js` | 数据模型 + `crews.json` 读写 + 文件落盘 | 路由、ffmpeg |
| `vision.js` | Claude 主题识别（一帧 → 一个英文词） | 其它 |
| `video.js` | 全部 ffmpeg 流水线（转码/分屏/拼接/导出） | 路由 |
| `public/index.html` | 整个前端（单文件原生 JS） | 拆分文件（保持单文件） |

## 硬约束（改之前先读）

- **UI 文案一律英文**。toast / 按钮 / 提示都不能出现中文（注释可以中文）。
- **按钮图标用内联 SVG**，不用 emoji（iOS 渲染不一致）。
- **数据持久化**：`store.save()` 全量写 `crews.json`。任何改 `crews/clips/stitches` 的地方都要 `save()`。`DATA_DIR` = `/data`（线上 Volume）或项目根目录（本地）。
- **密钥只走环境变量** `ANTHROPIC_API_KEY`，禁止硬编码。
- **JSON 文件不能写注释**。

## 容易踩的坑

1. **ffmpeg 必须含 `drawtext`**（标题叠加）。`ffmpeg-static` 的 linux 静态版**不含** drawtext → 会报 "Filter not found"。`video.js` 启动自动选「含 drawtext 的可用 ffmpeg」（系统 apt 版优先），并打印 `[ffmpeg] using=... drawtext=...`。改 ffmpeg 相关逻辑别破坏这个选择。
2. **导出会 OOM**：1080×1920 编码在小实例内存吃紧。所有 libx264 调用都带 `-threads 1` + `-preset ultrafast`。别改回多线程/慢 preset。
3. **上传 mimetype**：浏览器对 blob 不带类型时，busboy 默认 `text/plain`。`fileFilter` 因此对 `.webm/.mp4` + `octet-stream/text-plain` 放行；前端上传前也强制包成 `video/webm` 的 File。两边都别退回「只认 `video/*`」。
4. **multer 先落盘再校验**：crew/member 校验失败要 `rmUpload()` 删孤儿文件。
5. **主题大小写归一**：`Food` / `food` 视为同一主题（`store.catKey` + 上传时复用已有写法）。「同人同主题」分组、stitch 索引都用 `catKey`，前后端要一致（前端 `index.html` 也有同名 `catKey`）。
6. **同人同主题限 3 条 + 横向拼接**：上传后 `rebuildStitch` 删最旧、≥2 条则 `hstack` 成一条存 `stitches`。卡片显示和导出都用拼接后的那条 → 分屏**按人数**不是按 clip 数。
7. **前端轮询不要重建 DOM**：`refreshCards` 每 4s 轮询，用「渲染签名」比对，数据没变就跳过 `innerHTML`，否则视频会每 4s 黑屏重载。改渲染逻辑要保留签名机制。
8. **crewId 失效兜底**：`startOrJoin` 拿不到 crewId 不进 app；`uploadClip` 在 crewId/memberId 缺失时拒传（否则会 POST 到 `/api/crew/undefined/clip`）。
9. **安全上下文**：摄像头 / `navigator.share` / 剪贴板只在 `localhost` 或 HTTPS 可用。局域网 HTTP 上手机拍不了。

## 本地跑 & 部署

```bash
node server.js                         # 本地，默认 :3456
npx @railway/cli up                    # 部署（Dockerfile 构建，直接传本地代码，不依赖 git push）
```

部署目标：Railway 项目 `graceful-peace`。必须在 Railway 设 `ANTHROPIC_API_KEY`。数据在 `/data` Volume，重部署不丢。

## 验证习惯（证据驱动）

- 改 ffmpeg / 导出：实跑 `POST /api/crew/:id/export`，`ffprobe` 看尺寸/时长，必要时抽帧肉眼看布局。
- 改识别：用真实画面（非纯色占位）打 `/api/vision`。
- 改前端：检查 `<div>` 配平，线上验证 `curl` 拉 HTML grep 关键串。
- 别用 mock 绿灯代替真实链路验证。

## Git

- commit 格式：`<type>(amingo): <中文描述>`（type: feat/fix/perf/refactor/docs/chore）。
- 不提交：`node_modules`、`crews.json`、`uploads/`、`thumbs/`、`_trash/`（见 `.gitignore`）。
