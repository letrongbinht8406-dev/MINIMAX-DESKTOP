import { ImagePlus, MapPin, Music2, Plus, Scissors, Trash2, Users, Video } from 'lucide-react'
import { characterReferences } from '../lib/characterLibrary'
import { locationReferences } from '../lib/locationLibrary'
import type { CharacterProject, LocationProject, MediaFile, MediaKind } from '../types'

interface ReferenceSourcePanelProps {
  characters: CharacterProject[]
  locations: LocationProject[]
  selectedCharacterIds: string[]
  selectedLocationIds: string[]
  imageCount: number
  videoCount: number
  audioCount: number
  images: MediaFile[]
  videos: MediaFile[]
  audios: MediaFile[]
  managedImagePaths: ReadonlySet<string>
  onAddCharacter(id: string): void
  onAddLocation(id: string): void
  onClear(): void
  onChoose(kind: 'image' | 'video' | 'audio'): void
  onRemove(kind: MediaKind, index: number): void
  onEditVideo(index: number): void
  onOpenCharacters(): void
  onOpenLocations(): void
}

export function ReferenceSourcePanel(props: ReferenceSourcePanelProps) {
  const hasReferences = props.selectedCharacterIds.length + props.selectedLocationIds.length + props.imageCount + props.videoCount + props.audioCount > 0
  const standaloneImages = props.images.map((file, index) => ({ file, index, kind: 'image' as const })).filter(item => !props.managedImagePaths.has(item.file.path))
  const attachedMedia = [...standaloneImages, ...props.videos.map((file, index) => ({ file, index, kind: 'video' as const })), ...props.audios.map((file, index) => ({ file, index, kind: 'audio' as const }))]

  return <section className="reference-source-panel" aria-label="参考输入">
    <header>
      <span><strong>参考输入</strong><small>选择可复用的主体与地点，再添加场景素材。</small></span>
      <span className="reference-source-total">{props.imageCount}/9 图像 · {props.videoCount}/3 视频 · {props.audioCount}/3 音频</span>
      {hasReferences && <button type="button" className="reference-source-clear" onClick={props.onClear}>清除镜头参考</button>}
    </header>

    <details open>
      <summary><Users size={16} /><span>角色</span><small>{props.selectedCharacterIds.length} 已选</small></summary>
      <div className="reference-source-options">
        {props.characters.length ? props.characters.map(character => {
          const references = characterReferences(character)
          const selected = props.selectedCharacterIds.includes(character.id)
          return <button type="button" key={character.id} className={selected ? 'selected' : ''} aria-pressed={selected} disabled={!references.length} onClick={() => props.onAddCharacter(character.id)}>
            {references[0]?.preview ? <img src={references[0].preview} alt="" /> : <Users size={18} />}
            <span><strong>{character.name}</strong><small>{references.length ? `${references.length} 张已批准图像` : '请在角色工作室中添加已批准的身份图像'}</small></span>
            <span>{selected ? '移除' : references.length ? '添加' : '需图像'}</span>
          </button>
        }) : <p>素材库中暂无角色。</p>}
        <button type="button" className="reference-source-manage" onClick={props.onOpenCharacters}>打开角色工作室</button>
      </div>
    </details>

    <details>
      <summary><MapPin size={16} /><span>地点</span><small>{props.selectedLocationIds.length} 已选</small></summary>
      <div className="reference-source-options">
        {props.locations.length ? props.locations.map(location => {
          const references = locationReferences(location)
          const selected = props.selectedLocationIds.includes(location.id)
          return <button type="button" key={location.id} className={selected ? 'selected' : ''} aria-pressed={selected} disabled={!references.length} onClick={() => props.onAddLocation(location.id)}>
            {references[0]?.preview ? <img src={references[0].preview} alt="" /> : <MapPin size={18} />}
            <span><strong>{location.name}</strong><small>{references.length ? `${references.length} 张已批准视图` : '请在地点工作室中添加已批准的视图'}</small></span>
            <span>{selected ? '移除' : references.length ? '添加' : '需图像'}</span>
          </button>
        }) : <p>素材库中暂无地点。</p>}
        <button type="button" className="reference-source-manage" onClick={props.onOpenLocations}>打开地点工作室</button>
      </div>
    </details>

    <details>
      <summary><ImagePlus size={16} /><span>场景素材</span><small>{attachedMedia.length} 已附加</small></summary>
      {attachedMedia.length > 0 && <ul className="reference-source-files" aria-label="附加的场景媒体">{attachedMedia.map(({ file, index, kind }) => <li key={`${kind}:${file.path}:${index}`}>
        <span className="reference-source-file-icon">{kind === 'image' && file.preview ? <img src={file.preview} alt="" /> : kind === 'video' ? <Video size={16} /> : kind === 'audio' ? <Music2 size={16} /> : <ImagePlus size={16} />}</span>
        <span className="reference-source-file-name"><strong>{file.name}</strong><small>{kind === 'video' && file.clip ? `视频 · ${(file.clip.end - file.clip.start).toFixed(1)}s 片段` : kind === 'image' ? '图像' : kind === 'video' ? '视频' : '音频'}</small></span>
        {kind === 'video' && <button type="button" className="reference-source-file-action" onClick={() => props.onEditVideo(index)} aria-label={`Edit clip ${file.name}`} title="剪辑片段"><Scissors size={15} /></button>}
        <button type="button" className="reference-source-file-action" onClick={() => props.onRemove(kind, index)} aria-label={`Remove ${file.name} from this shot`} title="从该镜头移除"><Trash2 size={15} /></button>
      </li>)}</ul>}
      <div className="reference-source-add">
        <button type="button" disabled={props.imageCount >= 9} onClick={() => props.onChoose('image')}><Plus size={14} /><ImagePlus size={16} />图像</button>
        <button type="button" disabled={props.videoCount >= 3} onClick={() => props.onChoose('video')}><Plus size={14} /><Video size={16} />视频</button>
        <button type="button" disabled={props.audioCount >= 3} onClick={() => props.onChoose('audio')}><Plus size={14} /><Music2 size={16} />音频</button>
      </div>
    </details>
  </section>
}
