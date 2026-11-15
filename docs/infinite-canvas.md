# 无限画布工作区（Infinite Canvas）

## 它解决什么

Oyama AI Video Studio 原来有 20 个工作区（创作 / 准备素材 / 审阅与编辑 / 设置），
需要在顶部标题栏、侧边栏或可搜索导航器之间来回切换。无限画布把全部工作区
变成同一张可平移、可缩放、可连线的画布上的卡片，双击卡片即可进入对应工作区，
不必再翻菜单找入口。

入口：标题栏右侧「无限画布」按钮。画布上的「返回经典模式」按钮随时回到原界面；
画布是以覆盖层方式挂载的，经典界面的状态（提示词、素材、渲染任务）不会被卸载，
因此来回切换不会丢现场。

## 交互

| 操作 | 效果 |
|---|---|
| 拖动空白处 | 平移画布 |
| 滚轮 | 以鼠标位置为锚点缩放（25%–250%） |
| 拖动卡片标题栏 | 移动卡片 |
| 双击卡片 / 「打开 →」 | 关闭画布并进入该工作区 |
| 连线 → 依次点两张卡片 | 建立一条贝塞尔连线 |
| 添加便签 | 在画布当前视野新增可编辑便签 |
| 重置布局 | 恢复按分组排列的初始 20 卡片布局 |
| 适应视图 / 缩放 ± | 视图控制 |
| 0 / F | 适应全部内容 |
| Delete / Backspace | 删除选中节点（分组框不可删） |
| Esc | 取消选中 / 退出连线模式 |

## 数据与兼容

- 布局（卡片坐标、连线、便签文字、视口）保存在 localStorage 的
  oyama.infinite-canvas.layout.v1，版本号 CANVAS_STATE_VERSION = 1。
- 读取走 sanitizeCanvasState()：坏 JSON、缺字段、NaN/越界坐标、非法连线、
  已下线的工作区、重复 id 都会容错处理；缺失的工作区卡片会自动补齐，
  多余/过时的卡片会丢弃。存储写入失败（配额满）或读取抛错时回退到默认布局，
  不会覆盖已有快照。
- 卡片列表来自 src/lib/workspaceNavigation.ts 的 workspaceDestinations，
  以后新增工作区会自动出现在画布上，不需要改画布代码。
- 画布纯前端实现，零新依赖：src/lib/infiniteCanvas.ts（纯几何/状态逻辑）、
  src/components/InfiniteCanvas.tsx（React 组件）、src/infinite-canvas.css（复用
  workspace-theme.css 的主题变量）。没有引入 react-flow / tldraw 等第三方画布框架，
  避免改动依赖树与打包体积。

## 验证

pnpm test 的 test:infinite-canvas 套件通过 scripts/test-ts-loader.cjs
真实转译并调用 infiniteCanvas.ts，覆盖：缩放钳制与视口归一化、屏幕↔世界坐标往返、
锚点缩放不漂移、20 卡片/4 分组框/16 连线的初始布局、包围盒与适应视图、
节点/便签/连线的增删改、命中测试与贝塞尔路径、坏数据容错、序列化往返、
存储写入失败与存储被禁用时的回退。

交付门禁：pnpm typecheck / pnpm lint（--max-warnings 0）/ pnpm test / pnpm build:web 全部通过。

## 真实浏览器验收

已用无头 Edge（CDP over WebSocket）在 Vite dev server 上真实加载应用并跑完交互，
脚本为 scripts/verify-infinite-canvas-ui.cjs，命令（需先 pnpm dev:web）：

  $env:CANVAS_SHOT="<截图输出路径>"; node scripts/verify-infinite-canvas-ui.cjs

结果 37/37 全通过、无未捕获浏览器异常，截图见 docs/infinite-canvas-ui.png。实测覆盖：
外壳加载、标题栏入口、覆盖层开关、20 卡片 / 4 分组框 / 16 连线渲染、工具栏、
aria-live 状态栏、+ 按钮与滚轮缩放（scale 0.595→0.714→0.785，缩放文本同步）、
拖动空白平移、拖动卡片改坐标（120,150→231,221）、添加并编辑便签、连线模式新增连线
（16→17）、localStorage 持久化、Page.reload 后布局与便签文本恢复、双击卡片关闭画布并
切到 queue 工作区、返回经典模式、860×620 紧凑窗口 20 卡片且无横向溢出。

## 已知边界

- TODO(electron): 上述验收走的是纯 web（vite dev + browserMock），不是带原生
  preload bridge 的 Electron 窗口；完成条件是在打包后的桌面应用里重复这四条路径
  （拖拽、缩放、双击进入工作区、返回经典模式）。
- 画布目前是「工作区导航 + 便签 + 连线」层，卡片本身不内嵌各工作区的实时表单；
  工作区 UI 仍是经典模式里的原组件，双击进入后使用。
