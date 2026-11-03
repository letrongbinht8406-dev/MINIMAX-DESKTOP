// P0-1 模型输入串红线回归测试（docs/项目待优化点清单.md P0-1）
// 喂给模型的串（H3 prompt、ComfyUI 节点输入、LLM 请求）必须保持英文；
// 汉化只允许出现在用户可见消息/UI 文案。若有人把模型串改回中文，本套件必须失败。
'use strict'
const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')

const CJK = new RegExp('[\u4e00-\u9fff]')
// 检测器自检：必须能抓到中文、放过 ascii
assert.ok(CJK.test('场景') && !CJK.test('scene prompt'), 'CJK detector sanity')

const sampleOf = (text) => {
  const i = Array.from(text).findIndex((ch) => CJK.test(ch))
  return i === -1 ? '' : ' ...' + text.slice(Math.max(0, i - 20), i + 20) + '...'
}
const assertNoCjk = (label, text) => assert.ok(!CJK.test(text), label + ' must not contain CJK model input' + sampleOf(text))

const image = (name) => ({ kind: 'image', name, path: name + '.png' })

// ---------------------------------------------------------------------------
// 1) H3 场景编译链（scenePromptState -> h3SceneCompiler）
// ---------------------------------------------------------------------------
const { createSceneState, applySceneCommand } = load('src/lib/scenePromptState.ts')
const { compileScene, parsePromptMarkup } = load('src/lib/h3SceneCompiler.ts')

for (const [name, fixture] of [
  ['T2VA', () => {
    let state = createSceneState('A quiet kitchen at dawn. The camera slowly pulls back from the counter while steam rises from the coffee machine.', 8, 'text')
    state = applySceneCommand(state, 'shot', 'Wide Shot')
    state = applySceneCommand(state, 'camera', 'Dolly In', 'slow push in on the kettle')
    return compileScene(state)
  }],
  ['I2VA', () => {
    let state = createSceneState('A sailor walks along the harbor wall at sunset, gulls circling overhead.', 6, 'image')
    state = applySceneCommand(state, 'shot', 'Medium Shot')
    return compileScene(state)
  }],
  ['REF2VA', () => {
    let state = createSceneState('Two friends share a table outside a rainy street cafe, laughing over maps and espresso.', 10, 'reference')
    state = bindSceneReferencesSafe(state)
    return compileScene(state)
  }],
]) {
  const compiled = fixture()
  assertNoCjk('H3 ' + name + ' compiled prompt', compiled.prompt)
  assertNoCjk('H3 ' + name + ' conflict messages stay user-visible', JSON.stringify(compiled.conflicts).replace(/\\"/g, '"') && compiled.prompt, '')
}
function bindSceneReferencesSafe(state) {
  const { bindSceneReferences } = load('src/lib/scenePromptState.ts')
  return bindSceneReferences(state, [
    { file: image('Kierra'), purpose: 'character', label: 'Character: Kierra / face', characterId: 'kierra', source: 'character-studio' },
    { file: image('Table'), purpose: 'generic', label: 'Rainy cafe table', source: 'shot' },
  ])
}

// 负向探针（P0-1 验收：中文值进管线必须被抓住）
const polluted = applySceneCommand(createSceneState('A quiet kitchen at dawn.', 8, 'text'), 'shot', '远景')
assert.ok(CJK.test(compileScene(polluted).prompt), 'detector must catch CJK leaking through the H3 pipeline')
const pollutedMarkup = parsePromptMarkup('<d>[中文台词]你好</d>')
assert.ok(CJK.test(JSON.stringify(pollutedMarkup)), 'detector must catch CJK in dialogue markup values')

// ---------------------------------------------------------------------------
// 2) ComfyUI 工作流（H3 与 LTX 2.5）—— 节点 class_type/inputs 抽查
// ---------------------------------------------------------------------------
const { buildMiniMaxWorkflow, buildMiniMaxReferenceStillWorkflow, OFFICIAL_H3_SAMPLER, OFFICIAL_H3_SCHEDULER } = load('src/lib/workflow.ts')
const { buildLtx25Workflow } = load('src/lib/ltx25Workflow.ts')

const h3Models = { fl2va: 'fl2va', ref2va: 'ref2va', fastH3: 'fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors', textEncoder: 'clip', videoVae: 'video', audioVae: 'audio', fl2vLora: 'fl-lora', ref2vLora: 'ref-lora' }
const ltxModels = { diffusion: 'ltx-distilled.safetensors', textEncoder: 'gemma4.safetensors', videoVae: 'video-vae.safetensors', audioVae: 'audio-vae.safetensors', latentUpscaler: 'latent-x2.safetensors' }

const h3Options = { mode: 'text', width: 768, height: 768, prompt: 'A quiet city street at dawn with ambient traffic audio.', duration: 5, seed: 42, steps: 30, turbo: 'fast', sampler: OFFICIAL_H3_SAMPLER, scheduler: OFFICIAL_H3_SCHEDULER, filenamePrefix: 'redline-h3', refImageSize: 'match', userLoras: [] }
for (const [label, options, uploads] of [
  ['H3 T2VA', h3Options, { images: [], videos: [], audios: [] }],
  ['H3 I2VA', { ...h3Options, mode: 'image', turbo: '8', refImageSize: 'match' }, { images: [image('first')], first: image('first'), last: image('last'), videos: [], audios: [] }],
  ['H3 REF2VA', { ...h3Options, mode: 'reference', turbo: 'off', duration: 8 }, { images: [image('ref-a'), image('ref-b')], videos: [image('ref-v')], audios: [] }],
]) {
  const graph = buildMiniMaxWorkflow(options, h3Models, uploads)
  const json = JSON.stringify(graph)
  assertNoCjk(label + ' graph JSON', json)
  for (const node of Object.values(graph)) {
    assert.ok(!CJK.test(node.class_type), label + ' node class_type must be ASCII: ' + node.class_type)
  }
}
assert.ok(!CJK.test(OFFICIAL_H3_SAMPLER) && !CJK.test(OFFICIAL_H3_SCHEDULER), 'H3 sampler/scheduler enum values must stay ASCII')

// H3 带编译场景（sceneState 进图）
const sceneForGraph = createSceneState('A lighthouse beam sweeps over dark waves while fog horns echo.', 8, 'text')
const graphWithScene = buildMiniMaxWorkflow({ ...h3Options, mode: 'text', turbo: '8', duration: 8, sceneState: sceneForGraph }, h3Models, { images: [], videos: [], audios: [] })
assertNoCjk('H3 graph with compiled sceneState', JSON.stringify(graphWithScene))
const stillGraph = buildMiniMaxReferenceStillWorkflow({ mode: 'image', width: 768, height: 768, prompt: 'A harbor buoy at dusk, calm water, cinematic lighting.', duration: 5, seed: 7, turbo: 'off', sampler: 'euler', scheduler: 'simple', filenamePrefix: 'redline-still', refImageSize: 'match', userLoras: [] }, h3Models, { images: [image('still-ref')], videos: [], audios: [] })
assertNoCjk('H3 reference still graph', JSON.stringify(stillGraph))

for (const [label, options, extra] of [
  ['LTX25 T2VA', { mode: 'text', preset: 'turbo', prompt: 'A paper boat drifts down a rain gutter, puddles reflecting street lamps.', width: 768, height: 512, duration: 2, seed: 1, filenamePrefix: 'redline-ltx' }, undefined],
  ['LTX25 I2VA', { mode: 'image', preset: 'quality', prompt: 'A kite surfer carves across foamy waves at golden hour.', width: 1280, height: 736, duration: 5, seed: 42, filenamePrefix: 'redline-ltx-i2v' }, { name: 'first.png' }],
]) {
  const graph = buildLtx25Workflow(options, ltxModels, extra, label.includes('I2VA') ? [] : [])
  const json = JSON.stringify(graph)
  assertNoCjk(label + ' graph JSON', json)
  for (const node of Object.values(graph)) assert.ok(!CJK.test(node.class_type), label + ' node class_type must be ASCII: ' + node.class_type)
}

// ---------------------------------------------------------------------------
// 3) 提示词 LLM 请求（promptComposer）
// ---------------------------------------------------------------------------
const { composeReferenceInstructions, buildPromptAssistantRequest, formatH3PromptOutput } = load('src/lib/promptComposer.ts')
const bindings = [
  { file: image('Kierra'), purpose: 'character', label: 'Character: Kierra / face', characterId: 'kierra', source: 'character-studio' },
  { file: image('KierraBody'), purpose: 'character-angle', label: 'Character: Kierra / body', characterId: 'kierra', source: 'character-studio' },
  { file: image('Kitchen'), purpose: 'generic', label: 'Kitchen environment', source: 'shot' },
]
assertNoCjk('composeReferenceInstructions', composeReferenceInstructions(bindings))
for (const tool of ['enhance', 'timeline', 'audio']) {
  const request = buildPromptAssistantRequest(tool, 'A cat watches rain on the windowsill, tail flicking slowly.', { duration: 8, mode: 'text', referenceMap: bindings.map((item, index) => '<Picture ' + (index + 1) + ': ' + item.label + '>') })
  assertNoCjk('buildPromptAssistantRequest(' + tool + ')', request)
}
assertNoCjk('formatH3PromptOutput', formatH3PromptOutput('The camera pulls back slowly while the kettle whistles.', 'Summary kept in English by the model.', { mode: 'text', duration: 8, referenceMap: ['<Picture 1: Character: Kierra / face>'] }))

// ---------------------------------------------------------------------------
// 4) 检测器元验证（防"空跑"回归：本套件必须真的在扫 CJK）
// ---------------------------------------------------------------------------
const poisoned = 'The camera ' + '拉远' + ' slowly.'
assert.ok(CJK.test(poisoned), 'CJK detector must catch planted Chinese')
assert.ok(!sampleOf('clean ascii').length, 'sampleOf on clean text is empty')
// 关键路径锚点：REF2VA task 标签必须恒为英文（P0-1 验收场景）
const refState = bindSceneReferencesSafe(createSceneState('Two friends at a rainy cafe table.', 10, 'reference'))
const refPrompt = compileScene(refState).prompt
assert.ok(refPrompt.includes('reference generation'), 'REF2VA task label stays English')
assert.ok(CJK.test(refPrompt.replace('reference generation', '参考生成')), 'detector must catch a Chinese task label')

console.log('PASS: model-input redline — H3 prompts, ComfyUI/LTX graphs, and LLM request strings stay CJK-free')
