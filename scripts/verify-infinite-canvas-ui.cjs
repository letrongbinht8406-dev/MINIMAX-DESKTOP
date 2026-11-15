// Real-browser acceptance test for the Oyama infinite-canvas workspace.
// Requires a running Vite dev server (pnpm dev:web) on http://127.0.0.1:5173/.
// v2: fit view before node drag; fixed note-text assertion expression.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('ws')

const browserPath = process.env.E2E_BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const appUrl = process.env.CANVAS_E2E_URL || 'http://127.0.0.1:5173/'
const storageKey = 'oyama.infinite-canvas.layout.v1'
const noteText = '验收便签 A'
const port = 9335 + Math.floor(Math.random() * 500)
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'oyama-canvas-e2e-'))
const shotPath = process.env.CANVAS_SHOT || path.join(os.tmpdir(), 'oyama-canvas-acceptance.png')
let browser
let socket
let nextId = 0
const pending = new Map()
const browserErrors = []
let failures = 0
let total = 0

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }
function check(label, ok, detail) {
  total += 1
  if (!ok) failures += 1
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail === undefined ? '' : '  |  ' + detail))
}
async function until(fn, label, timeout = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await fn().catch(() => null)
    if (value) return value
    await delay(150)
  }
  throw new Error('Timed out waiting for ' + label)
}
function send(method, params) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id: id, method: method, params: params || {} }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' :: ' + ((result.exceptionDetails.exception && result.exceptionDetails.exception.description) || ''))
  return result.result && result.result.value
}
async function clickEntry() {
  return evaluate('(() => { const b = document.querySelector(".infinite-canvas-entry") || [...document.querySelectorAll("button")].find(x => x.textContent.includes("无限画布")); if (!b) return false; b.click(); return true })()')
}
async function clickText(text) {
  return evaluate('(() => { const t = [...document.querySelectorAll("button, [role=tab], a")].find(n => n.textContent.trim() === ' + JSON.stringify(text) + '); if (!t) return false; t.click(); return true; })()')
}
async function rectOf(selector) {
  return evaluate('(() => { const e = document.querySelector(' + JSON.stringify(selector) + '); return e ? e.getBoundingClientRect().toJSON() : null; })()')
}
async function transform() {
  return evaluate('document.querySelector(".infinite-canvas-world") && document.querySelector(".infinite-canvas-world").style.transform')
}
function scaleOf(t) { const m = /scale\(([-0-9.]+)\)/.exec(t || ''); return m ? parseFloat(m[1]) : null }
function translateOf(t) { const m = /translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/.exec(t || ''); return m ? m[1] + ',' + m[2] : null }
async function mouse(type, x, y, buttons) {
  await send('Input.dispatchMouseEvent', { type: type, x: x, y: y, button: 'left', buttons: buttons, clickCount: 1 })
}
async function wheel(x, y, deltaY) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: x, y: y, deltaX: 0, deltaY: deltaY, button: 'none', buttons: 0 })
}

async function main() {
  if (!fs.existsSync(browserPath)) throw new Error('Browser missing: ' + browserPath)
  browser = spawn(browserPath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' })
  const target = await until(async () => {
    const response = await fetch('http://127.0.0.1:' + port + '/json/list')
    return (await response.json()).find(item => item.type === 'page')
  }, 'browser debug endpoint', 30000)
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  socket.on('message', data => {
    const message = JSON.parse(String(data))
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text)
    if (!message.id || !pending.has(message.id)) return
    const p = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) p.reject(new Error(message.error.message))
    else p.resolve(message.result)
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1379, height: 982, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: appUrl })
  await until(() => evaluate('document.querySelector("#root") && document.querySelector("#root").textContent.includes("Oyama AI Video Studio")'), 'app shell', 45000)
  check('应用外壳真实加载（纯 web + browserMock，无需 Electron/ComfyUI）', true)

  const entry = await evaluate('(() => { const b = document.querySelector(".infinite-canvas-entry"); if (!b) return null; const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), display: cs.display, visible: r.width > 1 && r.height > 1 && cs.display !== "none" && cs.visibility !== "hidden" } })()')
  check('「无限画布」入口在视口内真实可见', Boolean(entry && entry.visible), JSON.stringify(entry))
  check('初始为经典模式（无画布覆盖层）', await evaluate('!document.querySelector(".infinite-canvas-overlay")'))
  check('点击「无限画布」打开覆盖层', await clickEntry())
  await until(() => evaluate('Boolean(document.querySelector(".infinite-canvas-overlay"))'), 'canvas overlay')

  const counts = await evaluate('({ cards: document.querySelectorAll(".infinite-canvas-card-workspace").length, groups: document.querySelectorAll(".infinite-canvas-group").length, notes: document.querySelectorAll(".infinite-canvas-card-note").length, edges: document.querySelectorAll(".infinite-canvas-edge path").length, brand: document.querySelector(".infinite-canvas-brand") && document.querySelector(".infinite-canvas-brand").textContent.trim(), status: document.querySelector(".infinite-canvas-status") && document.querySelector(".infinite-canvas-status").getAttribute("aria-live"), buttons: [...document.querySelectorAll(".infinite-canvas-actions button")].map(b => b.textContent.trim()) })')
  check('渲染 20 张工作区卡片', counts.cards === 20, 'got ' + counts.cards)
  check('渲染 4 个分组框', counts.groups === 4, 'got ' + counts.groups)
  check('渲染 16 条贝塞尔连线', counts.edges === 16, 'got ' + counts.edges)
  check('品牌栏显示 20 个工作区', counts.brand && counts.brand.indexOf('20 个工作区') >= 0, counts.brand)
  check('状态栏 aria-live=polite', counts.status === 'polite', counts.status)
  check('工具栏控制齐全', ['重置布局', '添加便签', '连线', '适应视图', '返回经典模式'].every(t => counts.buttons.indexOf(t) >= 0), counts.buttons.join(','))

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'))
  check('画布全屏截图已保存', fs.existsSync(shotPath), shotPath)

  const t0 = await transform()
  await clickText('+')
  await delay(200)
  const t1 = await transform()
  check('点击 + 放大使 scale 增大', scaleOf(t1) > scaleOf(t0), t0 + ' -> ' + t1)
  check('缩放百分比同步显示', /^[0-9]+%$/.test(await evaluate('document.querySelector(".infinite-canvas-zoom").textContent.trim()')))

  const surface = await rectOf('.infinite-canvas-surface')
  const cx = Math.round(surface.x + surface.width * 0.75)
  const cy = Math.round(surface.y + surface.height * 0.78)
  const t2 = await transform()
  await wheel(cx, cy, -240)
  await delay(250)
  const t3 = await transform()
  check('鼠标滚轮缩放改变 scale', Math.abs(scaleOf(t3) - scaleOf(t2)) > 0.0001, t2 + ' -> ' + t3)

  const empty = await evaluate('(() => { const s = document.querySelector(".infinite-canvas-surface"); const r = s.getBoundingClientRect(); for (let y = r.bottom - 25; y > r.top + 20; y -= 20) { for (let x = r.right - 25; x > r.left + 20; x -= 20) { const e = document.elementFromPoint(x, y); if (e && e.classList.contains("infinite-canvas-surface")) return { x: x, y: y }; } } return null; })()')
  check('找到可平移的空白画布区域', Boolean(empty), JSON.stringify(empty))
  if (empty) {
    const p0 = await transform()
    await mouse('mousePressed', empty.x, empty.y, 1)
    await mouse('mouseMoved', empty.x - 90, empty.y - 55, 1)
    await mouse('mouseReleased', empty.x - 90, empty.y - 55, 0)
    await delay(200)
    const p1 = await transform()
    check('拖动空白处平移画布（translate 改变）', translateOf(p0) !== translateOf(p1), p0 + ' -> ' + p1)
  }

  // Bring every card back into view before hit-testing a card head.
  check('点击「适应视图」使卡片全部可见', await clickText('适应视图'))
  await delay(300)
  const head = await rectOf('.infinite-canvas-card-workspace .infinite-canvas-card-head')
  check('首个卡片标题栏位于视口内', head && head.y > 0 && head.y < 982, JSON.stringify(head))
  const before = await evaluate('(() => { const c = document.querySelector(".infinite-canvas-card-workspace"); return { left: c.style.left, top: c.style.top }; })()')
  const hx = Math.round(head.x + head.width * 0.3)
  const hy = Math.round(head.y + head.height / 2)
  await mouse('mousePressed', hx, hy, 1)
  await mouse('mouseMoved', hx + 70, hy + 45, 1)
  await mouse('mouseReleased', hx + 70, hy + 45, 0)
  await delay(250)
  const after = await evaluate('(() => { const c = document.querySelector(".infinite-canvas-card-workspace"); return { left: c.style.left, top: c.style.top }; })()')
  check('拖动卡片标题栏改变卡片坐标', before.left !== after.left || before.top !== after.top, before.left + ',' + before.top + ' -> ' + after.left + ',' + after.top)

  check('点击「添加便签」', await clickText('添加便签'))
  await until(() => evaluate('document.querySelectorAll(".infinite-canvas-card-note").length === 1'), 'note card')
  await evaluate('(() => { const t = document.querySelector(".infinite-canvas-note"); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; setter.call(t, ' + JSON.stringify(noteText) + '); t.dispatchEvent(new Event("input", { bubbles: true })); return t.value; })()')
  const noteValue = await evaluate('document.querySelector(".infinite-canvas-note") && document.querySelector(".infinite-canvas-note").value')
  check('便签文本可编辑且受控更新', noteValue === noteText, noteValue)

  const edgesBefore = await evaluate('document.querySelectorAll(".infinite-canvas-edge path").length')
  check('点击「连线」进入连线模式', await clickText('连线'))
  await evaluate('document.querySelectorAll(".infinite-canvas-card-workspace")[0].click()')
  await delay(150)
  await evaluate('document.querySelectorAll(".infinite-canvas-card-workspace")[19].click()')
  await delay(250)
  const edgesAfter = await evaluate('document.querySelectorAll(".infinite-canvas-edge path").length')
  check('连线模式依次点两张卡片新增一条连线', edgesAfter === edgesBefore + 1, edgesBefore + ' -> ' + edgesAfter)

  const stored = await evaluate('(() => { const raw = localStorage.getItem(' + JSON.stringify(storageKey) + '); if (!raw) return null; const s = JSON.parse(raw); return { version: s.version, nodes: s.nodes.length, notes: s.nodes.filter(n => n.kind === "note").length, edges: s.edges.length, hasText: raw.indexOf(' + JSON.stringify(noteText) + ') >= 0 }; })()')
  check('布局写入 localStorage（含版本/节点/边）', stored !== null && stored.version === 1, JSON.stringify(stored))
  check('localStorage 含便签文本与新增连线', stored !== null && stored.notes === 1 && stored.hasText && stored.edges === edgesAfter, JSON.stringify(stored))

  await send('Page.reload')
  await until(() => evaluate('document.querySelector("#root") && document.querySelector("#root").textContent.includes("Oyama AI Video Studio")'), 'app shell after reload', 45000)
  check('刷新后重新打开无限画布', await clickEntry())
  await until(() => evaluate('Boolean(document.querySelector(".infinite-canvas-overlay"))'), 'canvas after reload')
  const afterReload = await evaluate('({ notes: document.querySelectorAll(".infinite-canvas-card-note").length, noteValue: document.querySelector(".infinite-canvas-note") && document.querySelector(".infinite-canvas-note").value, cards: document.querySelectorAll(".infinite-canvas-card-workspace").length, edges: document.querySelectorAll(".infinite-canvas-edge path").length })')
  check('刷新后便签文本仍在（真实持久化）', afterReload.notes === 1 && afterReload.noteValue === noteText, JSON.stringify(afterReload))
  check('刷新后 20 张卡片与连线恢复', afterReload.cards === 20 && afterReload.edges === edgesAfter, JSON.stringify(afterReload))

  check('双击「队列」卡片', await evaluate('(() => { const c = [...document.querySelectorAll(".infinite-canvas-card-workspace")].find(n => n.querySelector(".infinite-canvas-card-title") && n.querySelector(".infinite-canvas-card-title").textContent.trim() === "队列"); if (!c) return false; c.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); return true; })()'))
  await until(() => evaluate('!document.querySelector(".infinite-canvas-overlay")'), 'canvas closed after dblclick')
  const appClass = await evaluate('document.querySelector(".app-shell").className')
  check('双击关闭画布并切到 queue 工作区', appClass.indexOf('studio-view-queue') >= 0, appClass)

  check('再次打开无限画布', await clickEntry())
  await until(() => evaluate('Boolean(document.querySelector(".infinite-canvas-overlay"))'), 'canvas reopened')
  check('点击「返回经典模式」', await clickText('返回经典模式'))
  await until(() => evaluate('!document.querySelector(".infinite-canvas-overlay")'), 'canvas exited')
  check('退出后经典界面仍在（titlebar 可见）', await evaluate('Boolean(document.querySelector(".titlebar"))'))

  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 620, deviceScaleFactor: 1, mobile: false })
  await delay(200)
  check('860x620 紧凑窗口打开无限画布', await clickEntry())
  await until(() => evaluate('Boolean(document.querySelector(".infinite-canvas-overlay"))'), 'canvas at compact size')
  const compact = await evaluate('({ w: innerWidth, sw: document.documentElement.scrollWidth, cards: document.querySelectorAll(".infinite-canvas-card-workspace").length })')
  check('紧凑窗口画布仍渲染 20 张卡片', compact.cards === 20, JSON.stringify(compact))
  check('紧凑窗口无横向文档溢出', compact.sw <= 860, 'scrollWidth=' + compact.sw)

  check('无未捕获浏览器异常', browserErrors.length === 0, browserErrors.join(' | '))

  console.log('RESULT: ' + (failures === 0 ? 'PASS' : 'FAIL') + ' — ' + (total - failures) + '/' + total + ' checks passed')
  if (failures > 0) process.exitCode = 1
}

main().catch(error => { console.error('E2E ERROR: ' + (error && error.stack || error)); failures += 1; console.log('RESULT: FAIL — ' + error.message); process.exitCode = 1 }).finally(async () => {
  if (socket) socket.close()
  if (browser) { browser.kill(); await delay(400) }
  const resolved = path.resolve(profile)
  const tempRoot = fs.realpathSync(os.tmpdir())
  if (path.dirname(resolved) === tempRoot && path.basename(resolved).startsWith('oyama-canvas-e2e-')) {
    try { fs.rmSync(resolved, { recursive: true, force: true }) } catch (e) { console.warn('profile cleanup failed: ' + e.message) }
  }
})
