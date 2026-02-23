import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildFlowTool, parseAiResponse } from '../../../api/lib/ai-prompt'

describe('ai-prompt', () => {
  describe('buildSystemPrompt', () => {
    it('should return a string containing schema description', () => {
      const prompt = buildSystemPrompt()
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(0)
      expect(prompt).toContain('lanes')
      expect(prompt).toContain('nodes')
      expect(prompt).toContain('arrows')
    })

    it('should mention Flowline data structure', () => {
      const prompt = buildSystemPrompt()
      expect(prompt).toContain('Flowline')
    })

    it('should describe the flow structure fields', () => {
      const prompt = buildSystemPrompt()
      expect(prompt).toContain('title')
      expect(prompt).toContain('laneId')
      expect(prompt).toContain('rowIndex')
      expect(prompt).toContain('fromNodeId')
      expect(prompt).toContain('toNodeId')
    })
  })

  describe('buildFlowTool', () => {
    it('should return a valid tool definition with name and input_schema', () => {
      const tool = buildFlowTool()
      expect(tool.name).toBe('generate_flow')
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
    })

    it('should have required fields: title, lanes, nodes, arrows', () => {
      const tool = buildFlowTool()
      const required = tool.input_schema.required
      expect(required).toContain('title')
      expect(required).toContain('lanes')
      expect(required).toContain('nodes')
      expect(required).toContain('arrows')
    })

    it('should define lane properties including tempId, name, colorIndex, position', () => {
      const tool = buildFlowTool()
      const laneProps = tool.input_schema.properties.lanes.items.properties
      expect(laneProps.tempId).toBeDefined()
      expect(laneProps.name).toBeDefined()
      expect(laneProps.colorIndex).toBeDefined()
      expect(laneProps.position).toBeDefined()
    })

    it('should define node properties including tempId, laneId, rowIndex, label, orderIndex', () => {
      const tool = buildFlowTool()
      const nodeProps = tool.input_schema.properties.nodes.items.properties
      expect(nodeProps.tempId).toBeDefined()
      expect(nodeProps.laneId).toBeDefined()
      expect(nodeProps.rowIndex).toBeDefined()
      expect(nodeProps.label).toBeDefined()
      expect(nodeProps.orderIndex).toBeDefined()
    })

    it('should define arrow properties including fromNodeId, toNodeId, comment', () => {
      const tool = buildFlowTool()
      const arrowProps = tool.input_schema.properties.arrows.items.properties
      expect(arrowProps.fromNodeId).toBeDefined()
      expect(arrowProps.toNodeId).toBeDefined()
      expect(arrowProps.comment).toBeDefined()
    })
  })

  describe('parseAiResponse', () => {
    it('should extract flow data from tool_use block', () => {
      const response = {
        content: [
          {
            type: 'tool_use' as const,
            id: 'call_1',
            name: 'generate_flow',
            input: {
              title: 'テストフロー',
              lanes: [
                { tempId: 'lane_0', name: '営業部', colorIndex: 0, position: 0 },
              ],
              nodes: [
                {
                  tempId: 'node_0',
                  laneId: 'lane_0',
                  rowIndex: 0,
                  label: '開始',
                  orderIndex: 0,
                },
              ],
              arrows: [],
            },
          },
        ],
      }

      const result = parseAiResponse(response)
      expect(result.title).toBe('テストフロー')
      expect(result.lanes).toHaveLength(1)
      expect(result.nodes).toHaveLength(1)
      expect(result.arrows).toHaveLength(0)
    })

    it('should extract tool_use even when text blocks are present', () => {
      const response = {
        content: [
          { type: 'text' as const, text: '以下のフローを生成しました。' },
          {
            type: 'tool_use' as const,
            id: 'call_2',
            name: 'generate_flow',
            input: {
              title: 'Mixed Response',
              lanes: [],
              nodes: [],
              arrows: [],
            },
          },
        ],
      }

      const result = parseAiResponse(response)
      expect(result.title).toBe('Mixed Response')
    })

    it('should throw when no tool_use block is found', () => {
      const response = {
        content: [{ type: 'text' as const, text: 'テキストのみ' }],
      }

      expect(() => parseAiResponse(response)).toThrow()
    })

    it('should throw when content array is empty', () => {
      const response = { content: [] }
      expect(() => parseAiResponse(response)).toThrow()
    })

    it('should handle arrows with comments', () => {
      const response = {
        content: [
          {
            type: 'tool_use' as const,
            id: 'call_3',
            name: 'generate_flow',
            input: {
              title: 'Arrow Test',
              lanes: [
                { tempId: 'lane_0', name: 'A', colorIndex: 0, position: 0 },
              ],
              nodes: [
                {
                  tempId: 'node_0',
                  laneId: 'lane_0',
                  rowIndex: 0,
                  label: 'Start',
                  orderIndex: 0,
                },
                {
                  tempId: 'node_1',
                  laneId: 'lane_0',
                  rowIndex: 1,
                  label: 'End',
                  orderIndex: 0,
                },
              ],
              arrows: [
                {
                  fromNodeId: 'node_0',
                  toNodeId: 'node_1',
                  comment: '承認後',
                },
              ],
            },
          },
        ],
      }

      const result = parseAiResponse(response)
      expect(result.arrows).toHaveLength(1)
      expect(result.arrows[0].comment).toBe('承認後')
    })
  })
})
