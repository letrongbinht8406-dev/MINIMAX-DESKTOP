import { Aperture, Clapperboard, FileText, Film, HardDrive, Image as ImageIcon, ImagePlus, Library, ListVideo, MapPin, Menu, Music2, PanelLeftClose, Scan, Scissors, Settings, Shirt, SkipForward, Users, WandSparkles, Watch, type LucideIcon } from 'lucide-react'
import type { View } from '../types'

type MusicEngine = 'acestep' | 'music3'
type SidebarItem = { view: View; label: string; icon: LucideIcon; engine?: MusicEngine; count?: number; tone?: string }

interface WorkspaceSidebarProps {
  view: View
  musicEngine: MusicEngine
  open: boolean
  connected: boolean
  modelReady: boolean
  modelCount: number
  pendingCount: number
  projectName: string
  workspaceName: string
  onToggle(): void
  onClose(): void
  onBrowse(): void
  onNavigate(view: View, engine?: MusicEngine): void
  onVideo(): void
}

export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const groups: Array<{ label: string; items: SidebarItem[] }> = [
    { label: '创建', items: [
      { view: 'scratchpad', label: '草稿板', icon: FileText },
      { view: 'create', label: 'H3 视频', icon: WandSparkles },
      { view: 'continue', label: '续写', icon: SkipForward },
      { view: 'zimage', label: '图像', icon: ImageIcon },
      { view: 'referenceprep', label: '参考素材准备', icon: Scan },
      { view: 'ltx25', label: 'LTX 2.5', icon: Aperture },
      { view: 'ltxripple', label: 'LTX Ripple', icon: Aperture },
      { view: 'photoedit', label: '照片编辑', icon: ImagePlus },
      { view: 'music', engine: 'acestep', label: 'ACE-Step', icon: Music2 },
      { view: 'music', engine: 'music3', label: 'Music 3', icon: Music2 },
    ] },
    { label: '素材库', items: [
      { view: 'characters', label: '角色', icon: Users, tone: 'character' },
      { view: 'hair', label: '发型', icon: Scissors },
      { view: 'wardrobes', label: '服装', icon: Shirt, tone: 'wardrobe' },
      { view: 'accessories', label: '配饰', icon: Watch },
      { view: 'locations', label: '场景', icon: MapPin, tone: 'location' },
      { view: 'library', label: '渲染作品', icon: Library },
    ] },
    { label: '项目', items: [
      { view: 'queue', label: '任务队列', icon: ListVideo, count: props.pendingCount },
      { view: 'movie', label: 'Oyama AI 电影', icon: Clapperboard },
      { view: 'clipmaster', label: '剪辑大师', icon: Film },
    ] },
  ]
  return <>
    {props.open && <button className="mobile-sidebar-backdrop" aria-label="关闭工作区菜单" onClick={props.onClose} />}
    <aside className="sidebar" aria-label="工作区侧边栏" onClick={event => { if (window.innerWidth <= 680 && (event.target as HTMLElement).closest('.nav-button')) props.onClose() }}>
      <div className="sidebar-top"><button className="icon-button sidebar-toggle" onClick={props.onToggle} aria-label={props.open ? '收起侧边栏' : '展开侧边栏'}><PanelLeftClose size={18} /></button></div>
      <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true"><Film size={18} /></span><span className="sidebar-brand-text"><strong>Oyama 视频工作台</strong><small>工作区</small></span></div>
      <button className="sidebar-browse" type="button" data-workspace-trigger onClick={props.onBrowse} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" title="浏览所有工作区 (Ctrl+K)"><Menu size={16} /><span>浏览工作区</span></button>
      <nav className="sidebar-nav" aria-label="主导航">{groups.map(group => <div className="nav-group" key={group.label}><span className="nav-section-label">{group.label}</span>{group.items.map(item => {
        const Icon = item.icon
        const active = props.view === item.view && (!item.engine || item.engine === props.musicEngine)
        return <button type="button" key={`${item.view}-${item.engine ?? ''}`} className={`nav-button ${active ? 'active' : ''}`} data-item-type={item.tone} title={item.label} aria-current={active ? 'page' : undefined} aria-label={item.label} onClick={() => item.view === 'create' ? props.onVideo() : props.onNavigate(item.view, item.engine)}><Icon size={19} /><span>{item.label}</span>{item.count ? <em>{item.count}</em> : null}</button>
      })}</div>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-status">
        {props.connected ? <div className="sidebar-status-current connected"><span className="sidebar-status-dot" aria-hidden="true" /><div><strong>引擎已连接</strong><small>{props.workspaceName} · {props.projectName}</small></div></div> : <button className="sidebar-status-current offline" type="button" onClick={() => props.onNavigate('settings')} title="离线 · 打开设置进行连接"><span className="sidebar-status-dot" aria-hidden="true" /><div><strong>离线 · 未连接</strong><small>{props.workspaceName} · {props.projectName}</small></div></button>}
        <div className={`model-health ${props.modelReady ? 'healthy' : ''}`}><HardDrive size={17} /><div><strong>{props.modelReady ? '模型就绪' : '模型不完整'}</strong><span>{props.modelCount} 个本地文件已索引</span></div></div>
        <button type="button" className={`nav-button ${props.view === 'settings' ? 'active' : ''}`} title="设置" aria-current={props.view === 'settings' ? 'page' : undefined} onClick={() => props.onNavigate('settings')}><Settings size={19} /><span>设置</span></button>
      </div>
    </aside>
  </>
}
