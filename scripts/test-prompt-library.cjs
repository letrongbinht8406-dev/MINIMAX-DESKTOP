/**
 * 提示词库（图像）回归测试：
 *  1. loadPromptLibrary 容错（空/损坏 JSON/数组/缺字段 → 安全降级）
 *  2. savePromptLibrary 往返
 *  3. rememberPrompt：同文本同 provider 只更新时间不新增；换 provider 视为新条目；空文本忽略
 *  4. capHistory：非收藏按上限裁剪、收藏永不裁掉、按时间倒序
 *  5. toggleFavorite / renameEntry / removeEntry
 *  6. filterEntries：历史/收藏页签 + 搜索命中文本、负向词、名字
 *  7. 红线：promptLibrary.ts 运行时字符串字面量不得含 CJK（注释除外）
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load } = require('./test-ts-loader.cjs')

const {
  PROMPT_LIBRARY_KEY,
  loadPromptLibrary,
  savePromptLibrary,
  rememberPrompt,
  capHistory,
  toggleFavorite,
  renameEntry,
  removeEntry,
  filterEntries,
} = load('src/lib/promptLibrary.ts')

class MemStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
}

const same = (actual, expected, message) => assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message)

const options = {
  resolution: '1344x768',
  providerId: 'zimage',
  variant: 'turbo',
  sampler: 'res_multistep',
  scheduler: 'simple',
  seed: 42,
  steps: 8,
  guidance: 1,
}

// 1) 容错
const storage = new MemStorage()
same(loadPromptLibrary(storage), [], '空存储 → []')
storage.setItem(PROMPT_LIBRARY_KEY, '{oops not json')
same(loadPromptLibrary(storage), [], '损坏 JSON → []')
storage.setItem(PROMPT_LIBRARY_KEY, JSON.stringify(['a']))
same(loadPromptLibrary(storage), [], '数组 → []')
storage.setItem(PROMPT_LIBRARY_KEY, JSON.stringify({ version: 1, entries: [{ id: 1, text: 'x', createdAt: 1 }, { id: 'ok', text: 'y', createdAt: 2, favorite: 1 }] }))
const tolerant = loadPromptLibrary(storage)
assert.strictEqual(tolerant.length, 1, '缺字段条目被丢弃')
assert.strictEqual(tolerant[0].favorite, true, 'favorite 归一化为布尔')

// 2) 往返
const roundTrip = new MemStorage()
const seeded = rememberPrompt([], { text: 'a quiet street at dawn', negative: 'blur', providerId: 'zimage', options }, 1000)
assert.strictEqual(savePromptLibrary(seeded, roundTrip), true, '写入成功')
same(loadPromptLibrary(roundTrip), seeded, '写读一致')

// 3) rememberPrompt
const first = rememberPrompt([], { text: '  cinematic portrait  ', negative: '  ', providerId: 'zimage', options }, 1000)
assert.strictEqual(first.length, 1, '新增一条')
assert.strictEqual(first[0].text, 'cinematic portrait', '文本 trim')
assert.strictEqual(first[0].negative, undefined, '空负向词不入库')
assert.strictEqual(first[0].options.seed, 42, '参数快照随条目保存')
const updated = rememberPrompt(first, { text: 'cinematic portrait', negative: 'text', providerId: 'zimage', options: { ...options, seed: 7 } }, 2000)
assert.strictEqual(updated.length, 1, '同文本同 provider 不重复堆')
assert.strictEqual(updated[0].createdAt, 2000, '时间顶到最新')
assert.strictEqual(updated[0].options.seed, 7, '参数跟随最新一次提交')
assert.strictEqual(updated[0].negative, 'text', '负向词更新')
const otherProvider = rememberPrompt(updated, { text: 'cinematic portrait', providerId: 'flux1dev', options }, 3000)
assert.strictEqual(otherProvider.length, 2, '换 provider 视为新条目')
same(rememberPrompt(otherProvider, { text: '   ', providerId: 'zimage', options }, 4000).length, 2, '空文本不入库')

// 4) capHistory
const bulk = Array.from({ length: 6 }, (_, index) => ({
  id: `p${index}`, text: `prompt ${index}`, providerId: 'zimage', options: {}, createdAt: index, favorite: index === 0,
}))
const capped = capHistory(bulk, 3)
assert.strictEqual(capped.length, 3, '按上限裁剪')
assert.strictEqual(capped.some((entry) => entry.favorite), true, '收藏不被裁掉')
same(capped.filter((entry) => !entry.favorite).map((entry) => entry.text), ['prompt 5', 'prompt 4'], '非收藏保留最新，整体按时间倒序')
const favoritesOnly = capHistory(bulk.map((entry) => ({ ...entry, favorite: true })), 2)
assert.strictEqual(favoritesOnly.length, 6, '收藏条数超过上限也不裁')

// 5) 收藏/改名/删除
const starred = toggleFavorite(capped, 'p0')
assert.strictEqual(starred.find((entry) => entry.id === 'p0').favorite, false, '取消收藏')
const renamed = renameEntry(starred, 'p5', '  落地窗晨光  ')
assert.strictEqual(renamed.find((entry) => entry.id === 'p5').name, '落地窗晨光', '改名 trim')
assert.strictEqual(renameEntry(starred, 'p5', '   ').find((entry) => entry.id === 'p5').name, undefined, '空名字清空')
assert.strictEqual(removeEntry(starred, 'p5').length, starred.length - 1, '删除一条')

// 6) filterEntries
const withFavorites = [{ id: 'a', text: 'neon alley', negative: 'blur', providerId: 'zimage', options: {}, createdAt: 2, favorite: true, name: '霓虹' },
  { id: 'b', text: 'soft portrait', providerId: 'zimage', options: {}, createdAt: 1, favorite: false }]
assert.strictEqual(filterEntries(withFavorites, 'favorites', '').length, 1, '收藏页签只留星标')
assert.strictEqual(filterEntries(withFavorites, 'history', '').length, 2, '历史页签为全部')
assert.strictEqual(filterEntries(withFavorites, 'history', 'NEON').length, 1, '文本大小写无关')
assert.strictEqual(filterEntries(withFavorites, 'history', 'blur').length, 1, '负向词可搜')
assert.strictEqual(filterEntries(withFavorites, 'history', '霓虹').length, 1, '名字可搜')
assert.strictEqual(filterEntries(withFavorites, 'history', 'nothing').length, 0, '无命中')

// 7) 红线
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'promptLibrary.ts'), 'utf8')
const literals = [...source.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)].map((match) => match[1] ?? match[2])
assert.strictEqual(literals.some((literal) => /[\u4e00-\u9fff]/.test(literal)), false, 'promptLibrary.ts 字符串字面量含 CJK（存储/逻辑侧红线）')
assert.match(source, /PROMPT_LIBRARY_KEY = 'minimax\.prompt-library\.v1'/, '存储键必须保持英文')

console.log('PASS: prompt library — 容错/往返/去重/上限/收藏/搜索/红线 全过')
