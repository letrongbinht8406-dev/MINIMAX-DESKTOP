import { useState } from 'react'
import { FolderOpen, Pencil, Save, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from './ui'
import { workspaceProjectLabel, type WorkspaceProjectScope } from '../lib/workspaceNavigation'
import type { WorkspaceProject } from '../lib/workspaceProjects'

export function WorkspaceProjectManager({ activeScope, projects, onClose, onSave, onLoad, onRename, onDelete, feedback }: { feedback: { tone: 'error' | 'success' | 'neutral'; text: string } | null; activeScope: WorkspaceProjectScope | null; projects: WorkspaceProject[]; onClose(): void; onSave(name: string, scope: WorkspaceProjectScope): boolean; onLoad(project: WorkspaceProject): void; onRename(project: WorkspaceProject): void; onDelete(project: WorkspaceProject): void }) {
  const [name, setName] = useState('')
  const [filter, setFilter] = useState<'all' | WorkspaceProjectScope>('all')
  const visibleProjects = projects.filter((project) => filter === 'all' || project.scope === filter)
  const details = (project: WorkspaceProject) => {
    const prompt = ['prompt', 'metadata', 'vocals', 'arrangement', 'lyrics'].map(key => typeof project.snapshot[key] === 'string' ? project.snapshot[key] : '').join(' ').trim()
    const references = ['referenceImages', 'referenceVideos', 'referenceAudios', 'msrReferences'].reduce((total, key) => total + (Array.isArray(project.snapshot[key]) ? project.snapshot[key].length : 0), 0) + (project.snapshot.firstFrame ? 1 : 0)
    return `${prompt ? `${prompt.length.toLocaleString()} 字符提示词` : '无提示词'} · ${references} 个媒体参考素材`
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="workspace-project-modal" aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); Array.from(document.querySelectorAll<HTMLButtonElement>('[data-workspace-trigger]')).find(button => button.getClientRects().length > 0)?.focus() }}>
      <header><div><FolderOpen size={20} /><span><DialogTitle>工作区项目</DialogTitle><small>提示词、控件与所选参考文件的完整本地快照。</small></span></div></header>
      <div className="workspace-project-body">
        {feedback && <p className={`project-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
        {activeScope ? <form className="workspace-project-save" onSubmit={(event) => { event.preventDefault(); if (onSave(name, activeScope)) setName('') }}><span><strong>保存当前 {workspaceProjectLabel(activeScope)} 工作区</strong><small>包含完整提示词、渲染选项与参考素材分配。文件仍保留在原始本地位置。</small></span><label><span>项目名称</span><input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="例如 厨房对话 v1" /></label><button className="primary-button" type="submit" disabled={!name.trim()}><Save size={15} />保存项目</button></form> : <p className="settings-note">打开 生成、LTX 2.5、生成图像 或 音乐，即可将该工作区存为项目。你仍可打开下方任意已保存项目。</p>}
        <div className="workspace-project-toolbar"><span><strong>已保存项目</strong><small>{projects.length} 个本地项目</small></span><label><span>显示</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">全部工作区</option><option value="create">MiniMax H3 / Ref2VA</option><option value="ltx25">LTX 2.5</option><option value="zimage">生成图像</option><option value="music">音乐 · ACE-Step</option><option value="music3">音乐 · Music 3</option></select></label></div>
        {visibleProjects.length ? <div className="workspace-project-list">{visibleProjects.map((project) => <article key={project.id}><div><span className="workspace-project-scope">{workspaceProjectLabel(project.scope)}</span><strong>{project.name}</strong><small>{details(project)}</small><small>更新于 {new Date(project.updatedAt).toLocaleString()}</small></div><div><button type="button" className="secondary-button" onClick={() => onLoad(project)}>打开</button><button type="button" className="icon-button" aria-label={`重命名 ${project.name}`} onClick={() => onRename(project)}><Pencil size={15} /></button><button type="button" className="icon-button danger-icon" aria-label={`删除 ${project.name}`} onClick={() => { if (window.confirm(`删除项目“${project.name}”？不会删除任何源文件。`)) onDelete(project) }}><Trash2 size={15} /></button></div></article>)}</div> : <div className="workspace-project-empty"><FolderOpen size={26} /><strong>暂无项目</strong><span>保存当前工作区，即可记录其提示词、设置与参考素材。</span></div>}
      </div>
      <footer><small>项目本地存储在 Oyama AI Video Studio 中。打开项目不会改动其源图像、视频、音频或素材库资源。</small><button className="secondary-button" onClick={onClose}>完成</button></footer>
    </DialogContent>
  </Dialog>
}

