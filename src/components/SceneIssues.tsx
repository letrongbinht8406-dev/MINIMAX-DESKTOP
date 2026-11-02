import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import type { Conflict, ScenePromptState } from '../lib/scenePromptState'

const help: Record<string, [string, string]> = {
  'empty-scene': ['场景方向', 'Describe the action in 场景方向. The grey example is a placeholder; it is not part of your scene.'],
  'duration': ['镜头构建器', '将片段时长设置为 1 到 15 秒之间的数值。'],
  'missing-shots': ['镜头构建器', '添加一个镜头，然后在片段内设置其起始和结束位置。'],
  'shot-timing': ['镜头构建器', 'Review each shot’s End (s). Shots must connect with no gaps or overlaps. Fit shots to clip redistributes their lengths evenly.'],
  'shot-end': ['镜头构建器', 'Set the last shot’s End (s) to Clip duration, or use Fit shots to clip.'],
  'camera-conflict': ['镜头构建器', '请确保镜头控制与场景描述一致。修改控制项或编辑冲突的描述。'],
  'wardrobe-conflict': ['Characters', 'Make the character’s wardrobe field agree with the outfit named in Scene. Neither explicit choice is silently replaced.'],
  'wardrobe-nudity-conflict': ['Scene', 'A preserved wardrobe and an explicit nude or undressed direction cannot both be true. Remove the nude wording from Scene to keep the outfit, or turn off Preserve on the wardrobe source if nudity is intentional.'],
  'attribute-sources': ['References', 'Expand Retained attributes & ownership. Keep this attribute selected on only one reference for this owner; leave identity selected on multiple views if needed.'],
  'owner-required': ['References', 'Expand this card’s Retained attributes & ownership and choose its Character owner. Add the character in Characters first if needed.'],
  'missing-owner': ['References', '请选择此参考卡片中已有的角色所有者。'],
  'role-required': ['References', 'Choose Reference only and select what this image contributes, or assign it as the single Frame 0 anchor when it must condition the opening at 0.00s.'],
  'multiple-anchors': ['第 0 帧引导', 'Choose exactly one Frame 0 anchor. Other pictures can remain reference-only, and at most one separate ending frame can be active.'],
  'missing-opening': ['References', '在来源中选择一张图片作为首帧。它将成为 0.00 秒时的精确画面状态。'],
  'missing-ending': ['References', '在来源中选择一张图片作为尾帧。在帧端点模式下，开场图片为可选项。'],
  'visual-required': ['References', '请使用"添加参考"至少附加一张图片或一段视频。'],
  'reference-limit': ['References', 'Open Character library & media and remove excess references: up to 9 images, 3 videos and 3 audio inputs, including enabled video soundtracks.'],
  'duplicate-reference': ['References', '请打开角色库与媒体，并移除重复的来源。'],
  'anchor-kind': ['References', '只有静态图片才能作为开场或结尾帧。请先从源视频中提取一帧。'],
  'anchor-review': ['References', 'Expand this card, set the observed Frame shotSize and Frame angle, then review the image against your direction. Check “I reviewed the frame” only after checking it visually.'],
  'anchor-conflict': ['第 0 帧引导', 'To keep the native Frame 0 anchor, change the requested shot framing. For a newly generated opening, turn the guide off and retain the picture as a reference only.'],
  'anchor-attribute': ['第 0 帧引导', 'Keep the Frame 0 anchor and change the conflicting character or environment instruction, or turn the anchor off and use reference-only guidance.'],
  'reference-lock': ['References', '展开此卡片并取消勾选冲突的锁定控制项，或修改场景以匹配锁定值。'],
  'continuation-anchor': ['第 0 帧引导', 'Frame-0 continuation is required, but no picture is assigned to native frame_idx 0. Choose the extracted final frame in 第 0 帧引导 settings. If you only want the same cast, wardrobe, or location in a new composition, use reference-only scene continuity instead.'],
  'speech-disabled': ['Dialogue', '启用对白，或从场景指导和对话中移除所有台词。'],
  'dialogue-time': ['Dialogue', '展开该台词的"时间与节奏"设置。选择一个镜头及其内部的开始时间。'],
  'dialogue-fields': ['Dialogue', '为每条台词选择说话者，输入语言（如 English），并输入台词内容。'],
  'dialogue-markup': ['Dialogue', 'Remove H3 tags and angle brackets from dialogue fields. Enter only the words and language; the compiler adds the syntax.'],
  'speaker-missing': ['Dialogue', '请选择一个仍在角色列表中登记的角色，作为此台词的说话者。'],
  'audio-speaker': ['References', 'Expand the voice reference and select its Speaker. Add a spoken line for that character in Dialogue, or choose Ambience if this source is not a voice.'],
  'speech-fit': ['Dialogue', 'Shorten the line or increase its shot duration. Use Across cuts for a continued line, or Cut off at clip end for an intentional interruption.'],
  'speech-continuation': ['Dialogue', 'Add the next or previous part in the adjacent shot with the same speaker and matching Across cuts choices. Otherwise choose Complete line.'],
  'full-audio-conflict': ['声音与音乐', 'A complete copied soundtrack conflicts with additional dialogue or audio. Remove the extra audio direction, or change the source’s Audio relationship to reference or partially_copy.'],
  'legacy-format': ['Scene', 'Keep filmmaking language in Scene. To edit an existing H3 prompt directly, select 手动覆盖 and paste it there.'],
  'empty-manual': ['手动覆盖', 'Enter your H3 prompt in 手动覆盖, or return to Scene Composer to use automatic compilation.'],
  'manual-reference': ['手动覆盖', 'Compare the reference mapping in H3 Debug with the labels in your manual prompt. Attach the missing media or update the label.'],
  'manual-timing': ['手动覆盖', '请将此剪辑移至所选片段结束之前，或增加片段时长。'],
  'command-target': ['Scene', '在命令中指定图片名称，例如：//preserve Picture 3 wardrobe, environment, lighting'],
}

export function SceneIssues({ conflicts, state, onChange, onReferences }: { conflicts: Conflict[]; state: ScenePromptState; onChange(state: ScenePromptState): void; onReferences(): void }) {
  const errors = conflicts.filter(item => item.severity === 'error').length
  const jump = (section: string, referenceId?: string) => {
    if (section === '手动覆盖') { onChange({ ...state, view: 'manual' }); return }
    const root = document.querySelector('.scene-composer')
    const card = referenceId ? Array.from(root?.querySelectorAll<HTMLElement>('[data-reference-id]') || []).find(el => el.dataset.referenceId === referenceId) : undefined
    const target = card || Array.from(root?.querySelectorAll<HTMLElement>('.scene-section, .scene-authoring') || []).find(el => el.textContent?.includes(section))
    if (card) card.querySelector('details')?.setAttribute('open', '')
    if (target instanceof HTMLDetailsElement) target.open = true
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target?.querySelector<HTMLElement>('input, textarea, select, button')?.focus({ preventScroll: true })
  }
  return <section className={`scene-issues ${errors ? 'has-errors' : ''}`} aria-label="场景就绪">
    <header>{errors ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<div><strong>{errors ? `${errors} ${errors === 1 ? 'change' : 'changes'} needed before rendering` : '场景检查通过'}</strong><p>{errors ? '以下各项说明了问题所在及修复位置。' : conflicts.length ? '请查看以下建议。它们不会阻止渲染。' : '您的场景、参考素材和时间轴均一致。'}</p></div></header>
    {conflicts.map((conflict, index) => {
      const [section, guidance] = help[conflict.code] || ['References', '请在 References 中查看此素材的分配，并在 H3 Debug 中查看映射。']
      return <article key={`${conflict.code}-${conflict.referenceId}-${index}`}><div className="scene-issue-title"><span>{conflict.severity === 'error' ? 'Required' : 'Suggestion'}</span><strong>{conflict.message}</strong></div><p>{guidance}</p><div className="scene-issue-actions">
        {conflict.code === 'continuation-anchor' && <button type="button" onClick={() => onChange({ ...state, continuity: { ...state.continuity, exactFrame: false, scene: true } })}>Use scene continuity instead</button>}
        {conflict.code === 'speech-disabled' && <button type="button" onClick={() => onChange({ ...state, noDialogue: false })}>启用对话</button>}
        {['shot-timing', 'shot-end', 'missing-shots'].includes(conflict.code) && Number.isFinite(state.duration) && state.duration > 0 && <button type="button" onClick={() => { const shots = state.shots.length ? state.shots : [{ id: 'shot-1', start: 0, end: state.duration, description: '', camera: {}, characterIds: [] }]; onChange({ ...state, shots: shots.map((shot, i) => ({ ...shot, start: state.duration * i / shots.length, end: state.duration * (i + 1) / shots.length })) }) }}>Fit shots to clip</button>}
        {['missing-opening', 'missing-ending', 'visual-required', 'reference-limit', 'duplicate-reference'].includes(conflict.code) ? <button type="button" onClick={onReferences}>{state.mode === 'image' || state.mode === 'frames' ? '选择源帧' : '打开参考库'} <ArrowRight size={12} /></button> : <button type="button" onClick={() => jump(section, conflict.referenceId)}>Review {section} <ArrowRight size={12} /></button>}
      </div></article>
    })}
  </section>
}
