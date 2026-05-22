import { z } from 'zod'

const laneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    colorIndex: z.number().int().min(0),
    position: z.number().int().min(0),
    groupId: z.string().optional(),
    groupRole: z.enum(['parent', 'sub']).optional(),
  })
  .refine((d) => (d.groupId === undefined) === (d.groupRole === undefined), {
    message: 'groupId と groupRole は両方指定するか、両方省略してください',
  })

const nodeSchema = z.object({
  id: z.string().min(1),
  laneId: z.string().min(1),
  rowIndex: z.number().int().min(0),
  label: z.string().min(1),
  note: z.string().nullable().optional(),
  orderIndex: z.number().int().min(0),
  bg: z.string().nullable().optional(),
  strokeColor: z.string().nullable().optional(),
  dash: z.string().nullable().optional(),
  shape: z.enum(['diamond']).nullable().optional(),
})

const arrowSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  comment: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  dash: z.string().nullable().optional(),
  bidirectional: z.boolean().optional(),
  fromSide: z.enum(['top', 'right', 'bottom', 'left']).nullable().optional(),
  toSide: z.enum(['top', 'right', 'bottom', 'left']).nullable().optional(),
})

export const createFlowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  themeId: z.string().min(1).optional(),
  projectId: z.string().min(1).nullable().optional(),
  lanes: z.array(laneSchema).optional().default([]),
  nodes: z.array(nodeSchema).optional().default([]),
  arrows: z.array(arrowSchema).optional().default([]),
})

export const updateFlowSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  themeId: z.string().min(1).optional(),
  lanes: z.array(laneSchema).optional(),
  nodes: z.array(nodeSchema).optional(),
  arrows: z.array(arrowSchema).optional(),
})

export type CreateFlowInput = z.infer<typeof createFlowSchema>
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100),
})

export const moveFlowSchema = z.object({
  projectId: z.string().min(1).nullable(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type MoveFlowInput = z.infer<typeof moveFlowSchema>
