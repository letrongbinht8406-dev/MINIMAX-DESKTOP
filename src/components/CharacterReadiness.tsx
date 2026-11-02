import { Images } from 'lucide-react'

export type CharacterDetailTab = 'identity' | 'hair' | 'wardrobe' | 'accessories' | 'voice' | 'references'

interface CharacterReadinessProps {
  primaryReady: boolean
  referenceCount: number
  hairName: string
  wardrobeCount: number
  accessoryCount: number
  onOpen(tab: CharacterDetailTab): void
  onAddPrimary(): void
}

export function CharacterReadiness({ primaryReady, referenceCount, hairName, wardrobeCount, accessoryCount, onOpen, onAddPrimary }: CharacterReadinessProps) {
  const items: Array<{ label: string; value: string; tab: CharacterDetailTab; ready: boolean }> = [
    { label: '主图', value: primaryReady ? 'Ready' : '添加图片', tab: 'identity', ready: primaryReady },
    { label: '辅助视角', value: `${referenceCount}`, tab: 'references', ready: referenceCount > 0 },
    { label: 'Hair', value: hairName || '选择风格', tab: 'hair', ready: Boolean(hairName) },
    { label: 'Wardrobe', value: wardrobeCount ? `${wardrobeCount} attached` : '选择服装', tab: 'wardrobe', ready: wardrobeCount > 0 },
    { label: 'Accessories', value: accessoryCount ? `${accessoryCount} attached` : 'Optional', tab: 'accessories', ready: true },
  ]
  return <section className="character-canvas-context" aria-label="角色一致性摘要">
    <div className="character-canvas-context-heading"><Images size={15} /><strong>Continuity at a glance</strong><small>Select a row to edit</small></div>
    <div className="character-readiness-list">{items.map(item => <button type="button" key={item.label} onClick={() => item.tab === 'identity' && !primaryReady ? onAddPrimary() : onOpen(item.tab)}><span>{item.label}</span><strong className={item.ready ? 'ready' : ''}>{item.value}</strong></button>)}</div>
  </section>
}
