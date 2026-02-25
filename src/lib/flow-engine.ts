import type { InternalArrow } from '../features/editor/types'

/**
 * Replace occurrences of `oldKey` with `newKey` in the `from` / `to` fields
 * of every arrow.  Returns a new array — the original is not mutated.
 */
export function remapArrows(
  arrows: InternalArrow[],
  oldKey: string,
  newKey: string,
): InternalArrow[] {
  return arrows.map((a) => ({
    ...a,
    from: a.from === oldKey ? newKey : a.from,
    to: a.to === oldKey ? newKey : a.to,
  }))
}

/**
 * Remove arrows whose `from` or `to` key appears in `deletedKeys`.
 * Returns a new array — the original is not mutated.
 */
export function filterArrowsByDeletedKeys(
  arrows: InternalArrow[],
  deletedKeys: Set<string>,
): InternalArrow[] {
  return arrows.filter((a) => !deletedKeys.has(a.from) && !deletedKeys.has(a.to))
}
