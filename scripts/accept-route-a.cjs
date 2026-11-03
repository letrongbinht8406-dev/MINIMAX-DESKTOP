// 路线A 确定性验收脚本（qc 只跑脚本，不手工逐项）
// 用法: node scripts/accept-route-a.cjs [--json]
// 结果: 每项检查 pass/fail + 结构化 JSON；任一失败 exit 1
'use strict'
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..')
const asJson = process.argv.includes('--json')

const checks = []
function record(name, ok, detail) {
  checks.push({ name, pass: ok, detail })
  if (!asJson) process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}\n`)
}
function run(cmd) {
  const r = spawnSync('cmd', ['/c', cmd], { cwd: root, encoding: 'utf8', timeout: 600000 })
  return { code: r.status === null ? 1 : r.status, out: (r.stdout || '') + (r.stderr || ''), err: r.error }
}
function runPnpm(args) {
  const r = spawnSync('cmd', ['/c', `pnpm ${args}`], { cwd: root, encoding: 'utf8', timeout: 900000 })
  return { code: r.status === null ? 1 : r.status, out: (r.stdout || '') + (r.stderr || '') }
}

// 1) 门禁四项
const typecheck = run('npx tsc --noEmit')
record('tsc(src)', typecheck.code === 0, typecheck.code === 0 ? '' : typecheck.out.slice(-500))
const typecheckElectron = run('npx tsc -p tsconfig.electron.json --noEmit')
record('tsc(electron)', typecheckElectron.code === 0, typecheckElectron.code === 0 ? '' : typecheckElectron.out.slice(-500))
const lint = run('npx eslint . --max-warnings 0')
record('eslint(0 warnings)', lint.code === 0, lint.code === 0 ? '' : lint.out.slice(-500))
const test = run('node scripts/test-image-providers.cjs')
record('test:image-providers', test.code === 0, test.code === 0 ? '' : test.out.slice(-400))
// 全量 test 链
const fullTest = runPnpm('test')
record('pnpm test(19 suites)', fullTest.code === 0, fullTest.code === 0 ? '' : fullTest.out.slice(-500))
const buildWeb = runPnpm('build:web')
record('build:web', buildWeb.code === 0, buildWeb.code === 0 ? '' : buildWeb.out.slice(-400))

// 2) 内置 provider 零污染 & 自定义注册断言在测试套件里
const suiteSrc = fs.readFileSync(path.join(root, 'scripts/test-image-providers.cjs'), 'utf8')
record('suite CJK 扫描为真（正则匹配汉字、拒绝 ascii）', (() => {
  const cjkLine = suiteSrc.split('\n').find((l) => l.includes('graph must not contain CJK'))
  const open = cjkLine.indexOf('[')
  const close = cjkLine.indexOf(']', open)
  const rx = new RegExp('[' + cjkLine.slice(open + 1, close) + ']')
  return suiteSrc.includes('not mutated') && suiteSrc.includes('pinned diffusion file matches') && rx.test('\u6d77') && !rx.test('abc')
})(), 'test-image-providers.cjs')

// 3) 冒烟 dry run（5 provider 应全 AVAILABLE）
const smoke = run('node scripts/smoke-image-providers.cjs')
const availableCount = (smoke.out.match(/AVAILABLE/g) || []).length
record('smoke dry-run 5 providers AVAILABLE', smoke.code === 0 && availableCount >= 5, `${availableCount} AVAILABLE`)

// 4) provider 层 CJK 扫描（仅允许出现在注释里）
const providerFiles = [
  'src/lib/imageProviders/types.ts',
  'src/lib/imageProviders/ir.ts',
  'src/lib/imageProviders/provider.ts',
  'src/lib/imageProviders/resolve.ts',
  'src/lib/imageProviders/studio.ts',
  'src/lib/imageProviders/customRegistry.ts',
  'src/lib/imageProviders/index.ts',
  ...fs.readdirSync(path.join(root, 'src/lib/imageProviders/providers')).map((f) => `src/lib/imageProviders/providers/${f}`),
]
const cjkRe = /[\u4e00-\u9fff]/
let cjkViolations = []
for (const rel of providerFiles) {
  const p = path.join(root, rel)
  if (!fs.existsSync(p)) continue
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  let inBlock = false
  lines.forEach((line, idx) => {
    const t = line.trim()
    const isCommentLine = t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')
    if (inBlock && t.includes('*/')) inBlock = false
    else if (t.startsWith('/*') && !t.includes('*/')) inBlock = true
    const isMetadata = /^\s*(label|description)\s*:/.test(line)
    if (cjkRe.test(line) && !isCommentLine && !inBlock && !isMetadata) cjkViolations.push(`${rel}:${idx + 1}`)
  })
}
record('provider 层 CJK 只在注释/元数据文案（不流入模型输入）', cjkViolations.length === 0, cjkViolations.slice(0, 8).join(', '))

// 5) 旧 Z-Image 管线 1:1 保留（5 studio 关键参数串）
const studios = ['CharacterStudio', 'WardrobeStudio', 'AccessoryStudio', 'HairStudio', 'LocationStudio'].map((n) => `src/components/${n}.tsx`)
const legacyMissing = []
for (const rel of studios) {
  const s = fs.readFileSync(path.join(root, rel), 'utf8')
  for (const token of ['Math.floor(Math.random()', "'turbo'", 'resolveAttentionBackend', 'buildZImage']) {
    if (!s.includes(token)) legacyMissing.push(`${rel}:${token}`)
  }
}
record('5 studio 旧 Z-Image 管线参数保留', legacyMissing.length === 0, legacyMissing.slice(0, 6).join(', '))

// 6) electron/main.ts 完整性
const mainTs = fs.readFileSync(path.join(root, 'electron/main.ts'), 'utf8')
const mainLines = mainTs.split('\n').length
const electronImports = (mainTs.match(/^import .* from 'electron'/gm) || []).length
const loadOk = mainTs.includes("imageProviderId") && mainTs.includes('customImageModels')
record(
  'electron/main.ts 完整（行数≈1817、1 处 electron import、loadSettings 校验）',
  mainLines >= 1780 && mainLines <= 1860 && electronImports === 1 && loadOk,
  `lines=${mainLines}, electronImports=${electronImports}`
)

const failed = checks.filter((c) => !c.pass)
if (asJson) {
  process.stdout.write(JSON.stringify({ verdict: failed.length === 0 ? 'pass' : 'fail', checks }, null, 2) + '\n')
} else {
  process.stdout.write(`\n${failed.length === 0 ? '裁决: PASS' : '裁决: FAIL'}（${checks.length - failed.length}/${checks.length}）\n`)
}
process.exit(failed.length === 0 ? 0 : 1)
