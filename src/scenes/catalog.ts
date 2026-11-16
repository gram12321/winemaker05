/** Presentation-only scene objects. These are navigation targets, not game data. */
export type SceneId = 'estate' | 'winery' | 'cellar' | 'company'

export interface SceneObject {
  id: string
  name: string
  kind: string
  description: string
}

export interface SceneDefinition {
  id: SceneId
  eyebrow: string
  title: string
  introduction: string
  objects: readonly SceneObject[]
}

export const scenes: Record<SceneId, SceneDefinition> = {
  estate: {
    id: 'estate',
    eyebrow: 'The vineyard',
    title: 'Estate',
    introduction: 'A place to understand the land, from vineyard to winery.',
    objects: [
      { id: 'west-parcel', name: 'West parcel', kind: 'Vineyard parcel', description: 'A placeholder for a vineyard parcel and its origin details.' },
      { id: 'east-parcel', name: 'East parcel', kind: 'Vineyard parcel', description: 'A placeholder for a vineyard parcel and its origin details.' },
      { id: 'estate-house', name: 'Estate buildings', kind: 'Estate', description: 'A placeholder for the buildings at the heart of the estate.' },
    ],
  },
  winery: {
    id: 'winery',
    eyebrow: 'The production floor',
    title: 'Winery',
    introduction: 'A closer look at the spaces where wine is made.',
    objects: [
      { id: 'vessel-one', name: 'Production vessel A', kind: 'Vessel', description: 'A placeholder for a production vessel and its contents.' },
      { id: 'vessel-two', name: 'Production vessel B', kind: 'Vessel', description: 'A placeholder for a production vessel and its contents.' },
      { id: 'work-area', name: 'Work area', kind: 'Production space', description: 'A placeholder for a winery work area.' },
    ],
  },
  cellar: {
    id: 'cellar',
    eyebrow: 'The wine collection',
    title: 'Cellar',
    introduction: 'A home for wine, its development, and its story.',
    objects: [
      { id: 'barrel-bay', name: 'Barrel bay', kind: 'Cellar storage', description: 'A placeholder for a cellar storage area.' },
      { id: 'bottle-bay', name: 'Bottle shelves', kind: 'Cellar storage', description: 'A placeholder for a bottle storage area.' },
      { id: 'wine', name: 'Wine detail', kind: 'Wine', description: 'Explore the presentation of a focused wine detail.' },
    ],
  },
  company: {
    id: 'company',
    eyebrow: 'The bigger picture',
    title: 'Company',
    introduction: 'A place to bring the whole enterprise together.',
    objects: [],
  },
}
