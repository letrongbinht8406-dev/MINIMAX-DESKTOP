# 汉化规范（Oyama AI Video Studio → 简体中文）

本文件是本次汉化的唯一约定来源。任何参与翻译的人/子代理必须遵守，保证 100+ 文件译出一致。

## 1. 只译「显示给用户看的文案」，不动逻辑

**要译**：
- 按钮 / 标签 / 标题 / 侧栏导航 / 面板标题
- 表单字段名、占位符（placeholder）、帮助提示（hint / note / description / tooltip）
- 设置项名称与说明
- 通知 / toast / 提示框正文（`setNotice`、`toast`、`alert`、空态 empty-state、错误/成功/警告文案）
- 状态词（连接、运行、排队、完成、失败…）
- 工作区 / 模块的中文名称

**不译（保持英文）**：
- 模型文件名、ComfyUI 节点名、LoRA 名、`minimax_h3_*`、`qwen3vl_*`、`ltx-2.5-*`、`z_image_*` 等技术标识
- 文件路径、目录名、`%USERPROFILE%`、`ffmpeg` 等
- 日志标识、`promptId`、`error.code` 等
- **喂给生成模型的提示词 / 模板字符串**（如 `promptComposer`、`promptPresets`、`h3SceneCompiler`、`characterSurvey`、`buildLtxImageHandoffPrompt`、`diagnosticPrompt`、reference instruction 里拼给模型的英文指令）——这些是模型输入，不是显示文案
- 代码标识符、变量名、类型名、注释（注释可不译）
- `role`、`aria`、CSS class、`localStorage` key
- 专有名词：ComfyUI、Ollama、LM Studio、H3、LTX 2.5、ACE-Step、FLAC、GPU、VRAM、FFmpeg、LoRA、NVFP4-AWQ、INT8、SageAttention、Sol-Attn、Kitchen、RTX 等

判断法：「这句是给用户**看**的 → 译；这句是**发给模型 / 写进工作流 / 日志 / 存储**的 → 不译。」拿不准就先保留英文，宁可漏译不可译错逻辑。

## 2. 术语表（强制统一，勿自创新译）

| 英文 | 中文 |
|---|---|
| Generate / Render | 生成 / 渲染 |
| Cancel | 取消 |
| Prompt | 提示词 |
| Create | 创建 |
| Play / Stop / Pause | 播放 / 停止 / 暂停 |
| Settings | 设置 |
| Model / Models | 模型 / 模型 |
| Duration | 时长 |
| Resolution | 分辨率 |
| Seed | 种子 |
| Queue / Queued | 队列 / 排队中 |
| Reference / References | 参考 / 参考素材 |
| Preview | 预览 |
| Character | 角色 |
| Scene | 场景 |
| Location | 地点 |
| Wardrobe / Outfit | 服装 / 造型 |
| Accessory | 配饰 |
| Hair | 发型 |
| Movie | 影片 |
| Clip | 片段 |
| Music | 音乐 |
| Video | 视频 |
| Image / Still | 图像 / 静帧 |
| Audio | 音频 |
| First frame / Last frame | 首帧 / 尾帧 |
| Keyframes | 关键帧 |
| Turbo | 加速（Turbo） |
| Sampler / Scheduler | 采样器 / 调度器 |
| Attention / Benchmark | 注意力 / 基准测试 |
| GPU Routing | GPU 路由 |
| Upscale | 放大（超分） |
| Enhancement | 增强 |
| Continuation | 续写 |
| Concatenate / Concat | 拼接 |
| Library | 素材库 |
| Asset | 素材 / 资产 |
| Job / Jobs | 任务 |
| Project / Projects | 项目 |
| Workspace | 工作区 |
| Studio | 工作室 |
| Draft | 草稿 |
| Export / Import | 导出 / 导入 |
| Save / Delete / Rename | 保存 / 删除 / 重命名 |
| Search / Select / Add / Remove | 搜索 / 选择 / 添加 / 移除 |
| Apply / Approve / Dismiss | 应用 / 批准 / 忽略 |
| Retry | 重试 |
| Status | 状态 |
| Connected / Disconnected | 已连接 / 未连接 |
| Progress | 进度 |
| Completed / Failed / Running / Cancelled | 已完成 / 失败 / 运行中 / 已取消 |
| Error / Warning / Info / Success | 错误 / 警告 / 信息 / 成功 |
| Optional / Required | 可选 / 必需 |
| Default / Custom | 默认 / 自定义 |
| Quality / Fast / Experimental / Advanced | 质量 / 快速 / 实验性 / 高级 |
| Name / Description / Tags / Notes | 名称 / 描述 / 标签 / 备注 |
| Dialogue / No dialogue | 对白 / 无对白 |
| Natural movement | 自然运动 |
| Lyric / Instrumental | 歌词 / 纯音乐 |
| Tempo / Key | 速度 / 调性 |
| Frame(s) / Second(s) | 帧 / 秒 |
| Turntable / Walkthrough | 转台 / 走位导览 |
| Identity | 身份 |
| Fit / Crop | 合身 / 裁剪 |
| Anchor | 锚点 |
| Beat / Script / Shot / Plan | 节拍 / 剧本 / 镜头 / 规划 |
| Timeline / Sync / Stereo | 时间线 / 同步 / 立体声 |
| Native | 原生 |
| Diagnostics | 诊断 |
| Diagnostics / Benchmark config | 诊断 / 基准配置 |
| Test connection / Rescan | 测试连接 / 重新扫描 |
| Output / Output directory | 输出 / 输出目录 |
| Input | 输入 |
| Duration presets | 时长预设 |
| Aspect ratio | 比例 |
| Landscape / Portrait / Square | 横屏 / 竖屏 / 方图 |
| In-app playback | 应用内播放 |
| Mobile companion | 移动伴侣 |
| LAN / QR | 局域网 / 二维码 |
| Access token / Rotate | 访问令牌 / 轮换 |
| VRAM / overcommit | 显存 / 超配 |
| Ref2VA / FL2VA / T2V / I2V | Ref2VA / FL2VA / 文生视频 / 图生视频（模式缩写保留，可加中文括注） |
| Movie creator / Composer | 影片创建 / 场景编排 |
| Scratchpad | 草稿纸 |
| Ripple | 涟漪（LTX Ripple） |
| Fire-red edit / Photo edit | 照片编辑 |
| Character survey | 角色调研 |
| Copilot | 智能助手 |
| Enhancement tool (enhance/timeline/audio) | 提示增强 / 时间线 / 音频重写 |

## 3. 句式与排版
- 通知 / 错误文案保留原句的**结构**（数字、占位变量、单位、标点顺序），只把英文词换成中文，变量插值（`${...}`）原样保留。
- 专有名词/技术词保留英文时，用「中文（English）」或「English 中文」自然带过，勿生造。
- 保持简洁，不要意译成长句。UI 文案以短促为主。
- 全角/半角：中文里数字、字母、单位与中文之间不加空格也可；`${x}` 等代码段保持半角。
- 冒号、括号：中文语境优先用全角「：」「（）」。

## 4. 交付要求
- 逐文件、逐条替换，**不改任何代码逻辑、不改引号风格、不改 import/类型**。
- 改完后该文件 `tsc` 应仍通过（字符串替换不改变类型）。
- 汇报：列出你改的文件，以及有意识保留英文的类别（如模型名、提示词模板）。
