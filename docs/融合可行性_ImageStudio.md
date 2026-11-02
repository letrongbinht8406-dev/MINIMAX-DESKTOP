# ImageStudio（WorkBuddy 本地项目）融入 Oyama 桌面端可行性

> 2026-11-02 · Hermes · 用户 2026-11-02 确认：融入目标是 WorkBuddy 两天前做的本地项目 **ImageStudio**（不是 MinimaxH3 提示词资产库）

## 1. 目标项目（代码摸底）

位置：`E:/AI/05-学习阶段产出/作业/龙虾工作台/工作/image-studio`（v0.1.0，2026-11-01 更新，含 Electron 打包 release/ImageStudio-0.1.0）

- 定位：**"Pluggable local image generation workbench on top of ComfyUI"**——纯 Web（Vite+React+TS）+ node server + Electron 壳；架构图第一天就按"多模型可插拔 + 后续接视频"设计
- 工作区：图像生成（文生图/指令编辑/结构化提示词/批量队列）、视频生成（H3 文生/图生/首尾帧/续写/拼接/结构化场景/整片流水线）、资产（input 素材库 + output 结果）、作品集、任务队列（图像视频共用，失败一键重试）
- **可移植核心**（`src/core` 纯 TS，README 明言"与 React、Electron 完全无关"）：
  - `ModelProvider` = 纯函数 intent→graph（provider.ts 3KB 接口）：capabilities（t2i/edit…）、requires（role→ComfyUI 节点的 filename 枚举 + 优先正则 + 用户提示）、modeRequires（如编辑 LoRA 缺席只挡编辑不挡文生图）、requiresNodes（节点存在性门禁）、build(BuildInput)→GraphIR
  - 7 个 provider 共 66KB：qwenImage21（文生图 + ≤4 参考图指令编辑，镜像 Comfy-Org 官方模板，官方 cfg1+euler）、qwenImage2512、mossImage（编辑 LoRA）、flux1Dev、zImage、minimaxH3（24KB 简化版 H3）、comfyTv
  - server 层：modelScanner（扫本地权重）、customModelRegistry（用户自注册模型，provider 带 custom 标记）、configStore、systemStats

## 2. 能力差异（vs Oyama 现状）

| 能力 | Oyama（当前） | ImageStudio |
|---|---|---|
| 图像模型 | Z-Image/SD3 单家族拓扑锁死（ZImageWorkspace 仅家族内选 model/encoder/VAE；5 个 studio 无选择，缺 Z-Image 即整条资产生成路径不可用） | 7 模型可插拔 + 自定义模型注册 + 本地权重扫描 |
| 指令式多图编辑 | 无（FireRed 只做单张照片编辑） | Qwen-Image 2.1（≤4 参考图）/ MOSS（edit LoRA） |
| H3 视频 | 全管线（scene compiler/continuation/ripple/movie editor/GPU 路由/benchmark） | 简化 H3——**成熟方是 Oyama，此方向不移植** |
| 任务队列 | 影片渲染队列 | 图像+视频统一队列、失败重试 |
| 提示词库 | 无 | promptLibrary + 结构化 composer |
| 生产加固 | object_info 前置校验 / VRAM override / benchmark | 启动即 object_info 自动探测模型 + systemStats |

## 3. 融合路线

**A. 移植 provider 层（推荐，直接落地用户"图像模型可扩展可挑选"诉求）**
- 移植：`src/core/{types, ir, provider}` + 图像 providers（qwenImage21/2512、mossImage、flux1Dev、zImage，约 42KB）；不移植 minimaxH3/comfyTv（H3 视频以 Oyama 为准）
- 不移植：electron/server 传输层（Oyama 自有 IPC + comfyFetch）、UI（Oyama 设计系统）、整个 image-studio 应用
- 适配工作：
  1. GraphIR→ComfyPrompt 兼容层（两者都是 ComfyUI JSON 图，差异在连线表示；逐个 provider 验证）
  2. provider 的 requires/requiresNodes 接入 Oyama 的 object_info 校验流 + addRoutedLoader GPU 路由
  3. SettingsView 加"图像生成模型"选择器：自动探测（按 provider prefer 正则）+ 手动切换；参数信封（steps/cfg/sizeStep/负面用法）全部读 provider 声明
  4. 5 个 studio + ZImageWorkspace 统一走 resolve→build→submitPrompt
  5. 红线：provider 内模型输入串保持英文（现状已是英文），仅显示名中文化
- 验证：每个 provider 先 object_info 前置校验再做短渲染执行验证（production-readiness P0 "keep the render truthful"）
- 工作量：**首批 3-5 天**（注册表 + Qwen-Image 2.1 文生图/编辑 + MOSS + 设置选择器 + studio 接线）；每加一个模型 +1 天；自定义模型注册 UI +1-2 天
- 收益：图像生成从"只有 Z-Image"变"多模型 + 可自注册"；白得 Oyama 现在没有的**指令式多图参考编辑**

**B. 独立并存 + 资产共享**（保底）：两应用并存（图像主 ImageStudio、视频主 Oyama），共享 ComfyUI 权重/提示词资产，Oyama 设置里放入口链接。0.5 天，零风险，双维护。

**C. 全量代码合并**（不推荐现阶段）：统一 UI + 客户端，1-2 周，双轨架构（GraphIR vs per-workspace builder）需先对齐，回归风险高。A 落地后如需合流，C 才顺理成章。

## 4. 风险

1. 图格式差异：GraphIR vs ComfyPrompt 连线 + GPU 路由注入点 → 适配层逐 provider 验证
2. 权重可用：Qwen-Image 2.1/2512、MOSS、Flux.1-dev 需本地部署；按 provider requires 的 hint 显示"未安装"
3. 上游 rebase（优化清单 P1-6）后，红线回归测试覆盖要扩到移植 provider 的模型输入串
4. image-studio 是 0.1.0 早期版且由 WorkBuddy 维护 → 移植边界定为"src/core 图像 providers"，约定再移植/手工同步方式，不整仓 fork
5. 龙虾工作台 MinimaxH3 调研资产（Qwen 部署文档/节点对照表）保留为移植时的权重部署参考，无需单独融入

## 5. 结论

**走 A 路线（3-5 天）**：移植 provider 层 + 设置选择器，H3 视频侧保持 Oyama 现状；ImageStudio 保留为 provider 参考实现。排期接在 P0-1 红线测试之后（新 provider 一并纳入 CJK 守卫）。
