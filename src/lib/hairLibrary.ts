import type { HairStyleProject, MediaFile } from '../types'
import { createId } from './createId'

const KEY = 'minimax.hair-style-projects'
export const HAIR_LIBRARY_EVENT = 'minimax-hair-library-changed'

export function newHairStyleProject(index = 1): HairStyleProject {
  const now = Date.now()
  return { id: createId(), name: `Hair design ${index}`, description: '', texture: '自然质感', length: '中等长度', color: '', hairline: '自然发际线', finish: '柔和自然效果', visualStyle: '高端沙龙参考摄影', referencePrompt: '', createdAt: now, updatedAt: now }
}

export function loadHairStyleProjects(): HairStyleProject[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Partial<HairStyleProject>[]
    return raw.filter((item) => item.id).map((item, index) => ({ ...newHairStyleProject(index + 1), ...item }))
  } catch { return [] }
}

export function saveHairStyleProjects(projects: HairStyleProject[]) {
  localStorage.setItem(KEY, JSON.stringify(projects))
  window.dispatchEvent(new CustomEvent(HAIR_LIBRARY_EVENT))
}

export function hairStyleReference(project: HairStyleProject): MediaFile[] {
  return project.referenceImage ? [project.referenceImage] : []
}
