// =============================================
// AI Prompt utilities for Claude API integration
// =============================================

export interface FlowToolInput {
  title: string
  lanes: Array<{
    tempId: string
    name: string
    colorIndex: number
    position: number
  }>
  nodes: Array<{
    tempId: string
    laneId: string
    rowIndex: number
    label: string
    orderIndex: number
  }>
  arrows: Array<{
    fromNodeId: string
    toNodeId: string
    comment?: string
  }>
}

/**
 * Build system prompt explaining Flowline's data structure.
 */
export function buildSystemPrompt(): string {
  return `あなたはFlowlineというビジネスフローチャート作成ツールのAIアシスタントです。
ユーザーのプロンプトに基づいて、業務フローチャートのデータ構造を生成してください。

## Flowlineのデータ構造

フローは以下の要素で構成されます:

### title (string)
フローのタイトル。

### lanes (配列)
スイムレーン（担当部署/役割）。各レーンには以下のフィールドがあります:
- tempId: 一時ID（例: "lane_0", "lane_1"）
- name: レーン名（例: "営業部", "技術部"）
- colorIndex: 色インデックス（0から始まる整数）
- position: 表示順（0から始まる整数）

### nodes (配列)
フロー内の各作業ステップ。各ノードには以下のフィールドがあります:
- tempId: 一時ID（例: "node_0", "node_1"）
- laneId: 所属するレーンのtempId
- rowIndex: 行位置（0から始まる整数、上から下へ）
- label: 作業名
- orderIndex: 同じ行内での順序（0から始まる整数）

### arrows (配列)
ノード間の接続矢印。各矢印には以下のフィールドがあります:
- fromNodeId: 始点ノードのtempId
- toNodeId: 終点ノードのtempId
- comment: 矢印のラベル/コメント（省略可能）

## 注意事項
- 各レーンには必ず異なるcolorIndexを割り当ててください
- ノードのlaneIdは必ず存在するレーンのtempIdを参照してください
- 矢印のfromNodeId/toNodeIdは必ず存在するノードのtempIdを参照してください
- 実用的で理解しやすいフローを生成してください
- generate_flowツールを必ず使用してください`
}

/**
 * Build the Anthropic Tool definition for structured flow output.
 */
export function buildFlowTool() {
  return {
    name: 'generate_flow',
    description:
      'ビジネスフローチャートのデータ構造を生成します。レーン、ノード、矢印を含む完全なフロー定義を返してください。',
    input_schema: {
      type: 'object' as const,
      required: ['title', 'lanes', 'nodes', 'arrows'],
      properties: {
        title: {
          type: 'string',
          description: 'フローのタイトル',
        },
        lanes: {
          type: 'array',
          description: 'スイムレーン（担当部署/役割）の配列',
          items: {
            type: 'object',
            required: ['tempId', 'name', 'colorIndex', 'position'],
            properties: {
              tempId: {
                type: 'string',
                description: '一時ID（例: "lane_0"）',
              },
              name: {
                type: 'string',
                description: 'レーン名',
              },
              colorIndex: {
                type: 'number',
                description: '色インデックス',
              },
              position: {
                type: 'number',
                description: '表示順',
              },
            },
          },
        },
        nodes: {
          type: 'array',
          description: '作業ステップの配列',
          items: {
            type: 'object',
            required: ['tempId', 'laneId', 'rowIndex', 'label', 'orderIndex'],
            properties: {
              tempId: {
                type: 'string',
                description: '一時ID（例: "node_0"）',
              },
              laneId: {
                type: 'string',
                description: '所属レーンのtempId',
              },
              rowIndex: {
                type: 'number',
                description: '行位置',
              },
              label: {
                type: 'string',
                description: '作業名',
              },
              orderIndex: {
                type: 'number',
                description: '同一行内での順序',
              },
            },
          },
        },
        arrows: {
          type: 'array',
          description: 'ノード間の接続矢印の配列',
          items: {
            type: 'object',
            required: ['fromNodeId', 'toNodeId'],
            properties: {
              fromNodeId: {
                type: 'string',
                description: '始点ノードのtempId',
              },
              toNodeId: {
                type: 'string',
                description: '終点ノードのtempId',
              },
              comment: {
                type: 'string',
                description: '矢印のコメント（省略可能）',
              },
            },
          },
        },
      },
    },
  }
}

/**
 * Parse Claude API response and extract flow data from tool_use block.
 */
export function parseAiResponse(response: {
  content: Array<
    { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown }
  >
}): FlowToolInput {
  const toolUse = response.content.find((block) => block.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('AIレスポンスにtool_useブロックが含まれていません')
  }
  return toolUse.input as FlowToolInput
}
