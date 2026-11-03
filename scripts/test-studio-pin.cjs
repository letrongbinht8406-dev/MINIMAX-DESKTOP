/**
 * P2-11 资产 studio 逐文件 pin 回归测试：
 *  1. studioAssetKey 命名
 *  2. recordStudioPin / pinnedStudioProvider / clearStudioPin 往返（注入 MemStorage）
 *  3. pin 的 provider 不在目录 → undefined（降级到全局设置）
 *  4. 红线：studioPin.ts 运行时字符串字面量不含 CJK
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load } = require('./test-ts-loader.cjs')

const { studioAssetKey, pinnedStudioProvider, recordStudioPin, clearStudioPin, studioPinOf } = load('src/lib/imageProviders/studioPin.ts')

class MemStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
}
const storage = new MemStorage()

// 1) key 命名
assert.strictEqual(studioAssetKey('character', 'abc'), 'asset:character:abc:main')
assert.strictEqual(studioAssetKey('character', 'abc', 'master'), 'asset:character:abc:master')

// 2) 往返：内置 provider 在目录里
recordStudioPin('hair', 'h1', 'z-image', '1024x1024', [], 'main', storage)
assert.strictEqual(pinnedStudioProvider('hair', 'h1', [], 'main', storage), 'z-image', '内置 provider pin 命中')
assert.ok(studioPinOf('hair', 'h1', 'main', storage), 'studioPinOf 返回 pin')
clearStudioPin('hair', 'h1', 'main', storage)
assert.strictEqual(pinnedStudioProvider('hair', 'h1', [], 'main', storage), undefined, '清除后无 pin')

// 2b) 自定义 provider 需要 customModels 进目录（createCustomProvider：provider id = 'custom-' + entry.id）
recordStudioPin('wardrobe', 'w1', 'custom-mycat', '1024x1024', [{ id: 'mycat', name: 'MyCat', templateId: 'z-image', components: {} }], 'main', storage)
assert.strictEqual(pinnedStudioProvider('wardrobe', 'w1', [{ id: 'mycat', name: 'MyCat', templateId: 'z-image', components: {} }], 'main', storage), 'custom-mycat', '自定义 provider（已注册）命中')
assert.strictEqual(pinnedStudioProvider('wardrobe', 'w1', [], 'main', storage), undefined, '自定义 provider 未注册 → 降级')

// 3) undefined providerId 不落 pin
recordStudioPin('location', 'l1', undefined, '1344x768', [], 'main', storage)
assert.strictEqual(studioPinOf('location', 'l1', 'main', storage), undefined, 'legacy 路径（providerId=undefined）不记录')

// 4) 红线：运行时字符串字面量（单/双引号）不得含 CJK；注释允许
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'imageProviders', 'studioPin.ts'), 'utf8')
const literals = [...src.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g, 'g')].map((match) => match[1] ?? match[2])
assert.strictEqual(literals.some((literal) => /[\u4e00-\u9fff]/.test(literal)), false, 'studioPin.ts 字符串字面量含 CJK（模型/存储侧红线）')
assert.ok(src.includes('asset:${studio}:${assetId}:${target}'), '资产 key 必须保持英文格式')

// QC-F1 防回归：character 写端落 'master' 的 pin；读端缺省 target('main') 不命中，显式 'master' 才命中
{
  const st3 = new MemStorage()
  recordStudioPin('character', 'char1', 'z-image', '768x1024', [], 'master', st3)
  assert.ok(studioPinOf('character', 'char1', 'master', st3)?.providerId === 'z-image', 'character master pin 可读')
  assert.strictEqual(pinnedStudioProvider('character', 'char1', [], 'master', st3), 'z-image', "读端传 'master' 命中")
  assert.strictEqual(pinnedStudioProvider('character', 'char1', [], 'main', st3), undefined, "读端缺省 'main' 不命中 master pin（防 F1 错位）")
}

console.log('PASS: studio asset-pin — key/往返/降级/红线 全过')
