#!/usr/bin/env node
/**
 * winCodeSign 缓存修复（Windows 非管理员）：
 * electron-builder 解 winCodeSign 7z 时会为 darwin/ 的 dylib 建符号链接 → 无 SeCreateSymbolicLinkPrivilege 报
 * "Cannot create symbolic link"，整包失败。本脚本对每个 <hash>.7z 找到对应不完整目录，用 7za -snl（跳过链接）
 * 补全；Windows 构建只用 windows-10/windows-6/rcedit 段，darwin 链接无用。
 * 用法：node scripts/fix-wincode-sign-cache.cjs  （package:win 失败时跑，再重跑 package:win）
 */
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const cacheDir = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign')
let sevenZip = path.join(__dirname, '..', 'node_modules', '.pnpm')
// 定位 7zip-bin 的 7za.exe（pnpm 嵌套布局）
const candidates = []
for (const entry of fs.existsSync(sevenZip) ? fs.readdirSync(sevenZip) : []) {
  if (!entry.startsWith('7zip-bin@')) continue
  const bin = path.join(sevenZip, entry, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
  if (fs.existsSync(bin)) candidates.push(bin)
}
if (!candidates.length) {
  console.error('未找到 7zip-bin 的 7za.exe，请先 pnpm install')
  process.exit(1)
}
const sevenza = candidates[0]
if (!fs.existsSync(cacheDir)) {
  console.log('winCodeSign 缓存目录不存在，无需修复')
  process.exit(0)
}
let fixed = 0
for (const archive of fs.readdirSync(cacheDir).filter((name) => name.endsWith('.7z'))) {
  const hash = archive.replace(/\.7z$/, '')
  const target = path.join(cacheDir, hash)
  const marker = path.join(target, 'rcedit-x64.exe')
  if (fs.existsSync(marker)) continue // 完整
  fs.rmSync(target, { recursive: true, force: true })
  console.log(`补全 ${hash}（-snl 跳过 darwin 符号链接）...`)
  execFileSync(sevenza, ['x', '-y', '-snl', '-bd', path.join(cacheDir, archive), `-o${target}`], { stdio: 'pipe' })
  if (fs.existsSync(marker)) {
    console.log(`  ok: ${target}`)
    fixed++
  } else {
    console.error(`  失败: ${target}（rcedit-x64.exe 缺失）`)
    process.exitCode = 1
  }
}
console.log(fixed ? `已补全 ${fixed} 个缓存目录，重跑 pnpm package:win` : '所有缓存已完整')
