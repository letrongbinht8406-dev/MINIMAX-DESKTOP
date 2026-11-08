/**
 * 模型目录诊断回归测试（对齐 Comfy Desktop「Issues 面板明确列出缺失模型」口径）：
 *  1. 不存在的路径 / 空路径 / 路径指向文件 → missing，不再静默当「0 个文件」
 *  2. 空目录 → empty；有模型文件 → ok 且按扩展名计数（子目录递归、忽略隐藏目录）
 *  3. 深度上限避免误配置的盘符根目录被整盘遍历
 *  4. diagnoseModelPaths / summarizeModelPaths 汇总
 *  5. 红线：electron/modelDiagnostics.ts 运行时字符串字面量无 CJK
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { load } = require('./test-ts-loader.cjs')

const { diagnoseModelPath, diagnoseModelPaths, summarizeModelPaths, MODEL_FILE_EXTENSIONS } = load('electron/modelDiagnostics.ts')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oyama-model-diag-'))
try {
  const empty = path.join(root, 'empty')
  const populated = path.join(root, 'populated')
  const nested = path.join(populated, 'H3', 'turbo')
  const deep = path.join(root, 'deep')
  fs.mkdirSync(empty)
  fs.mkdirSync(nested, { recursive: true })
  fs.writeFileSync(path.join(nested, 'a.safetensors'), 'a')
  fs.writeFileSync(path.join(nested, 'b.gguf'), 'b')
  fs.writeFileSync(path.join(populated, 'c.pt'), 'c')
  fs.writeFileSync(path.join(populated, 'readme.txt'), 'ignore')
  fs.writeFileSync(path.join(populated, 'preview.png'), 'ignore')
  fs.mkdirSync(path.join(populated, '.cache'), { recursive: true })
  fs.writeFileSync(path.join(populated, '.cache', 'hidden.safetensors'), 'ignore')
  const aFile = path.join(root, 'not-a-dir.safetensors')
  fs.writeFileSync(aFile, 'x')

  // 1) 路径类
  assert.strictEqual(diagnoseModelPath('vae', path.join(root, 'nope')).status, 'missing', '不存在的目录 → missing')
  assert.strictEqual(diagnoseModelPath('vae', '   ').status, 'missing', '空路径 → missing')
  assert.strictEqual(diagnoseModelPath('vae', aFile).status, 'missing', '路径指向文件 → missing')
  assert.strictEqual(diagnoseModelPath('vae', undefined).status, 'missing', 'undefined 容错')

  // 2) 目录内容
  const emptyResult = diagnoseModelPath('vae_approx', empty)
  assert.strictEqual(emptyResult.status, 'empty', '存在但无模型 → empty')
  assert.strictEqual(emptyResult.fileCount, 0, '空目录文件数 0')
  const ok = diagnoseModelPath('loras', populated)
  assert.strictEqual(ok.status, 'ok', '有模型 → ok')
  assert.strictEqual(ok.fileCount, 3, '递归计数 3 个模型文件，忽略 txt/png 与隐藏目录')
  assert.strictEqual(ok.path, populated, '回显规范化路径')
  assert.strictEqual(JSON.stringify([...MODEL_FILE_EXTENSIONS]), JSON.stringify(['.safetensors', '.pt', '.pth', '.gguf', '.onnx']), '扩展名与主进程 scanDirectory 一致')

  // 3) 深度上限
  let cursor = deep
  fs.mkdirSync(cursor, { recursive: true })
  for (let index = 0; index < 7; index += 1) { cursor = path.join(cursor, `l${index}`); fs.mkdirSync(cursor, { recursive: true }) }
  fs.writeFileSync(path.join(cursor, 'too-deep.safetensors'), 'x')
  assert.strictEqual(diagnoseModelPath('diffusion_models', deep).status, 'empty', '超出扫描深度的文件不计入，防止整盘遍历')

  // 4) 汇总
  const items = diagnoseModelPaths({ diffusion_models: deep, text_encoders: path.join(root, 'nope'), vae: populated, loras: empty })
  assert.strictEqual(items.length, 4, '按 kind 逐个返回')
  const summary = summarizeModelPaths(items)
  assert.strictEqual(summary.total, 4, '总数')
  assert.strictEqual(summary.ok, 1, 'ok 数')
  assert.strictEqual(summary.empty, 2, 'empty 数（含深目录）')
  assert.strictEqual(summary.missing, 1, 'missing 数')
  assert.strictEqual(summary.files, 3, '模型文件总数')
  assert.strictEqual(summarizeModelPaths([]).total, 0, '空输入')

  // 5) 红线
  const source = fs.readFileSync(path.join(__dirname, '..', 'electron', 'modelDiagnostics.ts'), 'utf8')
  const literals = [...source.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)].map((match) => match[1] ?? match[2])
  assert.strictEqual(literals.some((literal) => /[\u4e00-\u9fff]/.test(literal)), false, '运行时字符串字面量含 CJK')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

console.log('PASS: model path diagnostics — 缺失/空目录/计数/深度/汇总/红线 全过')
