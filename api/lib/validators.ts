import { z } from 'zod'

const laneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  colorIndex: z.number().int().min(0),
  position: z.number().int().min(0),
})

const nodeSchema = z.object({
  id: z.string().min(1),
  laneId: z.string().min(1),
  rowIndex: z.number().int().min(0),
  label: z.string().min(1),
  note: z.string().nullable().optional(),
  orderIndex: z.number().int().min(0),
})

const arrowSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  comment: z.string().nullable().optional(),
})

export const createFlowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  themeId: z.string().min(1).optional(),
  lanes: z.array(laneSchema).optional().default([]),
  nodes: z.array(nodeSchema).optional().default([]),
  arrows: z.array(arrowSchema).optional().default([]),
})

export const updateFlowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  themeId: z.string().min(1).optional(),
  lanes: z.array(laneSchema).optional().default([]),
  nodes: z.array(nodeSchema).optional().default([]),
  arrows: z.array(arrowSchema).optional().default([]),
})

export type CreateFlowInput = z.infer<typeof createFlowSchema>
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>
