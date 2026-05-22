import type { Flow } from '../features/editor/types'

const modules = import.meta.glob<{ default: Flow }>('./fixtures/*.json', { eager: true })

export const fixtures: Record<string, Flow> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => {
    const name = path.replace(/^\.\/fixtures\//, '').replace(/\.json$/, '')
    return [name, mod.default]
  }),
)
