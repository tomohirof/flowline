import { Hono } from 'hono'
import type { AuthEnv } from '../app'
import { authMiddleware } from '../middleware/auth'
import { aiMiddleware } from '../middleware/ai'
import { generateId } from '../lib/id'
import { createMessage } from '../lib/anthropic-client'
import {
  buildSystemPrompt,
  buildFlowTool,
  parseAiResponse,
  type FlowToolInput,
} from '../lib/ai-prompt'
import type { LaneRow, NodeRow, ArrowRow } from '../lib/flow-transform'
import { toLane, toNode, toArrow } from '../lib/flow-transform'

const MODEL_HAIKU = 'claude-haiku-4-5-20251001'
const MODEL_SONNET = 'claude-sonnet-4-6-20250514'
const COMPLEXITY_THRESHOLD = 10

function selectModel(nodeCount: number): string {
  return nodeCount >= COMPLEXITY_THRESHOLD ? MODEL_SONNET : MODEL_HAIKU
}
const MAX_PROMPT_LENGTH = 2000

const ai = new Hono<AuthEnv>()

ai.use('*', authMiddleware)
ai.use('*', aiMiddleware)

// =============================================
// Helper: Replace temp IDs with real UUIDs
// =============================================

function replaceTempIds(input: FlowToolInput) {
  const laneIdMap = new Map<string, string>()
  const nodeIdMap = new Map<string, string>()

  // Generate real IDs for lanes
  const lanes = input.lanes.map((lane) => {
    const realId = generateId()
    laneIdMap.set(lane.tempId, realId)
    return {
      id: realId,
      name: lane.name,
      colorIndex: lane.colorIndex,
      position: lane.position,
    }
  })

  // Generate real IDs for nodes, mapping laneId references
  const nodes = input.nodes.map((node) => {
    const realId = generateId()
    nodeIdMap.set(node.tempId, realId)
    return {
      id: realId,
      laneId: laneIdMap.get(node.laneId) ?? node.laneId,
      rowIndex: node.rowIndex,
      label: node.label,
      orderIndex: node.orderIndex,
    }
  })

  // Map arrow references
  const arrows = input.arrows.map((arrow) => ({
    id: generateId(),
    fromNodeId: nodeIdMap.get(arrow.fromNodeId) ?? arrow.fromNodeId,
    toNodeId: nodeIdMap.get(arrow.toNodeId) ?? arrow.toNodeId,
    comment: arrow.comment ?? null,
  }))

  return { title: input.title, lanes, nodes, arrows }
}

// =============================================
// POST /generate - Generate new flow from prompt
// =============================================

ai.post('/generate', async (c) => {
  let body: { prompt?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.prompt || body.prompt.trim().length === 0) {
    return c.json({ error: 'プロンプトを入力してください' }, 400)
  }

  const prompt = body.prompt.trim()
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return c.json({ error: `プロンプトは${MAX_PROMPT_LENGTH}文字以内で入力してください` }, 400)
  }

  try {
    const tool = buildFlowTool()

    const response = await createMessage(c.env.ANTHROPIC_API_KEY, {
      model: MODEL_HAIKU,
      max_tokens: 4096,
      system: buildSystemPrompt(),
      tools: [tool],
      tool_choice: { type: 'tool', name: 'generate_flow' },
      messages: [{ role: 'user', content: prompt }],
    })

    const flowData = parseAiResponse(response)
    const flow = replaceTempIds(flowData)

    return c.json({ flow, model: MODEL_HAIKU })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('AI generation failed:', detail)
    return c.json({ error: 'AI生成に失敗しました。しばらく後に再試行してください。', detail }, 502)
  }
})

// =============================================
// POST /:flowId/edit - Edit existing flow with AI
// =============================================

ai.post('/:flowId/edit', async (c) => {
  const userId = c.get('userId')
  const db = c.env.FLOWLINE_DB
  const flowId = c.req.param('flowId')

  // Check flow ownership
  const flowRow = await db
    .prepare('SELECT id, user_id, title, deleted_at FROM flows WHERE id = ?')
    .bind(flowId)
    .first<{ id: string; user_id: string; title: string; deleted_at: string | null }>()

  if (!flowRow) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }
  if (flowRow.user_id !== userId) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  if (flowRow.deleted_at) {
    return c.json({ error: 'フローが見つかりません' }, 404)
  }

  let body: { prompt?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'リクエストの形式が正しくありません' }, 400)
  }

  if (!body.prompt || body.prompt.trim().length === 0) {
    return c.json({ error: 'プロンプトを入力してください' }, 400)
  }

  const prompt = body.prompt.trim()
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return c.json({ error: `プロンプトは${MAX_PROMPT_LENGTH}文字以内で入力してください` }, 400)
  }

  // Fetch current flow data
  const lanesResult = await db
    .prepare('SELECT * FROM lanes WHERE flow_id = ? ORDER BY position ASC')
    .bind(flowId)
    .all<LaneRow>()
  const nodesResult = await db
    .prepare('SELECT * FROM nodes WHERE flow_id = ? ORDER BY row_index ASC, order_index ASC')
    .bind(flowId)
    .all<NodeRow>()
  const arrowsResult = await db
    .prepare('SELECT * FROM arrows WHERE flow_id = ?')
    .bind(flowId)
    .all<ArrowRow>()

  const model = selectModel((nodesResult.results ?? []).length)
  const currentLanes = (lanesResult.results ?? []).map(toLane)
  const currentNodes = (nodesResult.results ?? []).map(toNode)
  const currentArrows = (arrowsResult.results ?? []).map(toArrow)

  const currentFlowJson = JSON.stringify(
    {
      title: flowRow.title,
      lanes: currentLanes,
      nodes: currentNodes,
      arrows: currentArrows,
    },
    null,
    2,
  )

  try {
    const tool = buildFlowTool()

    const response = await createMessage(c.env.ANTHROPIC_API_KEY, {
      model,
      max_tokens: 4096,
      system: buildSystemPrompt(),
      tools: [tool],
      tool_choice: { type: 'tool', name: 'generate_flow' },
      messages: [
        {
          role: 'user',
          content: `以下は現在のフローデータです:\n\n${currentFlowJson}\n\n以下の編集を適用してください:\n${prompt}`,
        },
      ],
    })

    const flowData = parseAiResponse(response)
    const flow = replaceTempIds(flowData)

    return c.json({ flow, model })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('AI edit failed:', detail)
    return c.json({ error: 'AI生成に失敗しました。しばらく後に再試行してください。', detail }, 502)
  }
})

export { ai }
