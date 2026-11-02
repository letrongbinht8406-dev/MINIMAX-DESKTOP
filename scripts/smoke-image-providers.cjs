const { load } = require('./test-ts-loader.cjs')
const { imageProviders } = load('src/lib/imageProviders/index.ts')
const { buildImageGraph, resolveProvider } = load('src/lib/imageProviders/resolve.ts')

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = args.find((item) => item.startsWith(name + '='))
  return hit ? hit.slice(name.length + 1) : fallback
}
const run = args.includes('--run')
const providerFlag = flag('--provider', '')
const url = flag('--url', 'http://127.0.0.1:8188')

async function main() {
  const info = await (await fetch(url + '/object_info')).json()
  const resolutions = imageProviders.map((provider) => resolveProvider(info, provider))
  for (const entry of resolutions) {
    console.log(`${entry.provider.id} ${entry.available ? 'AVAILABLE' : 'unavailable'}`)
    if (!entry.available) console.log('   missing:', entry.missing.join(' | '))
  }
  if (!run) {
    console.log('DRY RUN: no generation submitted. Pass --run to execute a 512x512 short render.')
    return
  }
  const candidates = resolutions.filter((entry) => entry.available)
  if (!candidates.length) throw new Error('no image provider is available on this ComfyUI server')
  const target = providerFlag
    ? candidates.find((entry) => entry.provider.id === providerFlag)
    : candidates.find((entry) => entry.provider.id === 'z-image') ?? candidates[0]
  if (!target) throw new Error(`provider ${providerFlag} is not available on this server`)
  const provider = target.provider
  const graph = buildImageGraph(info, provider, {
    mode: 't2i', prompt: 'smoke test: a small red cube on a white background', negativePrompt: '',
    width: 512, height: 512,
    steps: provider.defaults.steps ?? 8, cfg: provider.defaults.cfg ?? 1,
    sampler: provider.defaults.sampler ?? 'euler', scheduler: provider.defaults.scheduler ?? 'simple',
    seed: 42, batchSize: 1, references: [], loras: [], filenamePrefix: 'oyama_smoke',
  })
  const submitted = await (await fetch(url + '/prompt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: 'oyama-smoke' }),
  })).json()
  const promptId = submitted.prompt_id
  if (!promptId) throw new Error('ComfyUI rejected the graph: ' + JSON.stringify(submitted))
  console.log(`submitted ${provider.id} (${provider.defaults.steps ?? 8} steps, 512x512), waiting for ${promptId}...`)
  const deadline = Date.now() + 15 * 60 * 1000
  for (;;) {
    if (Date.now() > deadline) throw new Error('smoke render timed out after 15 minutes')
    const history = await (await fetch(url + '/history/' + promptId)).json()
    const record = history[promptId]
    if (record) {
      if (record.status?.status === 'error' || record.status?.status_failed) {
        throw new Error('render failed: ' + JSON.stringify(record.status.messages ?? record.status))
      }
      if (record.status?.status === 'success' || record.status?.completed === true) {
        const images = Object.values(record.outputs ?? {}).flatMap((output) => output.images ?? [])
        if (!images.length) throw new Error('render completed but produced no images')
        console.log(`PASS: ${provider.id} smoke render produced ${images.length} image(s): ${images.map((item) => item.filename).join(', ')}`)
        return
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
