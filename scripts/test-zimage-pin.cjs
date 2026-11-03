/**
 * P2-11 逐文件 pin 回归测试：
 *  1. loadFilePins 容错（损坏 JSON / 非对象 / 缺字段 → 安全降级）
 *  2. saveFilePin / clearFilePin 往返
 *  3. resolvePinnedProvider 优先级（有 pin 且 provider 在目录 → pin；否则回落）
 *  4. 红线：zimagePin.ts 的运行时字符串字面量不得含 CJK（注释除外；存储键/字段全英文）
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load } = require('./test-ts-loader.cjs')

const { loadFilePins, saveFilePin, clearFilePin, resolvePinnedProvider } = load('src/lib/zimagePin.ts')

class MemStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
}

// 1) 容错（test-ts-loader 跨 realm 返回值：用 JSON 等价断言，deepStrictEqual 会因 realm 边界失败）
const same = (actual, expected, msg) => assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg)
const storage = new MemStorage()
same(loadFilePins(storage), {}, '空存储 → {}')
storage.setItem('zimage.file-pins.v1', '{oops not json')
same(loadFilePins(storage), {}, '损坏 JSON → {}')
storage.setItem('zimage.file-pins.v1', JSON.stringify(['a', 'b']))
same(loadFilePins(storage), {}, '数组 → {}')
storage.setItem('zimage.file-pins.v1', JSON.stringify({
  'a.png': { providerId: 42 },
  'b.png': { providerId: 'flux1dev', steps: 8, cfg: 1, seed: 1, resolution: '1024x1024' },
}))
const parsed = loadFilePins(storage)
assert.strictEqual(Object.keys(parsed).length, 1, '缺字段条目被丢弃，合法条目保留')
assert.strictEqual(parsed['b.png'].pinnedAt, 0, '缺 pinnedAt → 0')

// 2) 往返
const m2 = new MemStorage()
saveFilePin({ fileId: 'x.png', providerId: 'custom-abc', steps: 20, cfg: 3, seed: 7, resolution: '512x512', pinnedAt: 123 }, m2)
assert.match(m2.getItem('zimage.file-pins.v1'), /"custom-abc"/, 'pin 已持久化')
same(clearFilePin('x.png', m2), {}, '清除后为空')

// 3) 优先级
const catalog = [{ id: 'z-image' }, { id: 'custom-abc' }]
const pins = { 'x.png': { fileId: 'x.png', providerId: 'custom-abc', steps: 20, cfg: 3, seed: 7, resolution: '512x512', pinnedAt: 0 } }
assert.strictEqual(resolvePinnedProvider(pins, catalog, 'x.png', 'z-image'), 'custom-abc', 'pin 命中且目录里有该 provider → 用 pin')
assert.strictEqual(resolvePinnedProvider(pins, [{ id: 'z-image' }], 'x.png', 'z-image'), 'z-image', 'pin 的 provider 不在目录 → 回落')
assert.strictEqual(resolvePinnedProvider({}, catalog, 'x.png', 'custom-abc'), 'custom-abc', '无 pin → 回落参数本身')
assert.strictEqual(resolvePinnedProvider(pins, catalog, '', 'z-image'), 'z-image', '空 fileId → 回落')

// 4) 红线：运行时字符串字面量（单/双引号）不得含 CJK；注释里的中文允许
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'zimagePin.ts'), 'utf8')
const literals = [...src.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g, 'g')].map((match) => match[1] ?? match[2])
assert.strictEqual(literals.some((literal) => /[\u4e00-\u9fff]/.test(literal)), false, 'zimagePin.ts 字符串字面量含 CJK（模型/存储侧红线）')
assert.match(src, /const STORAGE_KEY = 'zimage\.file-pins\.v1'/, '存储键必须保持英文')

console.log('PASS: zimage file-pin — 容错/往返/优先级/红线 全过')
