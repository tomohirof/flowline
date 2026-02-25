// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDemoFlow } from './useDemoFlow'
import type { FlowSavePayload } from '../types'

vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn(() => {
    throw new Error('apiFetch should not be called in demo mode')
  }),
}))

describe('useDemoFlow', () => {
  // =============================================
  // Initial state
  // =============================================

  describe('initial state', () => {
    it('should return a flow with default 2 lanes', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.flow).not.toBeNull()
      expect(result.current.flow.lanes).toHaveLength(2)
      expect(result.current.flow.lanes[0].name).toBe('レーン1')
      expect(result.current.flow.lanes[1].name).toBe('レーン2')
    })

    it('should return empty nodes and arrows', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.flow.nodes).toHaveLength(0)
      expect(result.current.flow.arrows).toHaveLength(0)
    })

    it('should have loading=false and no error', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should return saveStatus as saved always', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.saveStatus).toBe('saved')
    })

    it('should have a flow with id "demo"', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.flow.id).toBe('demo')
    })

    it('should have a flow with default title', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.flow.title).toBe('無題のフロー')
    })

    it('should have a flow with themeId "cloud"', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.flow.themeId).toBe('cloud')
    })

    it('should have shareToken as null', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.flow.shareToken).toBeNull()
    })

    it('should have valid ISO date strings for createdAt and updatedAt', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(result.current.flow.createdAt).toBeDefined()
      expect(typeof result.current.flow.createdAt).toBe('string')
      expect(result.current.flow.updatedAt).toBeDefined()
      expect(typeof result.current.flow.updatedAt).toBe('string')
    })
  })

  // =============================================
  // Lane structure validation
  // =============================================

  describe('lane structure', () => {
    it('should have lanes with all required fields (id, name, colorIndex, position)', () => {
      const { result } = renderHook(() => useDemoFlow())
      const lanes = result.current.flow.lanes

      for (const lane of lanes) {
        expect(lane).toHaveProperty('id')
        expect(lane).toHaveProperty('name')
        expect(lane).toHaveProperty('colorIndex')
        expect(lane).toHaveProperty('position')
        expect(typeof lane.id).toBe('string')
        expect(typeof lane.name).toBe('string')
        expect(typeof lane.colorIndex).toBe('number')
        expect(typeof lane.position).toBe('number')
      }
    })

    it('should have unique lane ids', () => {
      const { result } = renderHook(() => useDemoFlow())
      const lanes = result.current.flow.lanes
      const ids = lanes.map((l) => l.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('should have lanes with sequential positions starting from 0', () => {
      const { result } = renderHook(() => useDemoFlow())
      const lanes = result.current.flow.lanes
      expect(lanes[0].position).toBe(0)
      expect(lanes[1].position).toBe(1)
    })

    it('should have lanes with different colorIndex values', () => {
      const { result } = renderHook(() => useDemoFlow())
      const lanes = result.current.flow.lanes
      expect(lanes[0].colorIndex).not.toBe(lanes[1].colorIndex)
    })
  })

  // =============================================
  // Noop operations (no API calls)
  // =============================================

  describe('noop operations', () => {
    it('should provide noop updateFlow that does not call API', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(() => {
        act(() => {
          result.current.updateFlow({
            title: 'test',
            themeId: 'cloud',
            lanes: [],
            nodes: [],
            arrows: [],
          })
        })
      }).not.toThrow()
    })

    it('should provide noop saveNow that does not throw', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(() => {
        act(() => {
          result.current.saveNow()
        })
      }).not.toThrow()
    })

    it('should provide noop retrySave that does not throw', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(() => {
        act(() => {
          result.current.retrySave()
        })
      }).not.toThrow()
    })

    it('should remain saveStatus=saved after updateFlow is called', () => {
      const { result } = renderHook(() => useDemoFlow())

      act(() => {
        result.current.updateFlow({
          title: 'changed',
          themeId: 'midnight',
          lanes: [],
          nodes: [],
          arrows: [],
        })
      })

      expect(result.current.saveStatus).toBe('saved')
    })

    it('should remain saveStatus=saved after saveNow is called', () => {
      const { result } = renderHook(() => useDemoFlow())

      act(() => {
        result.current.saveNow()
      })

      expect(result.current.saveStatus).toBe('saved')
    })

    it('should handle updateFlow with empty payload', () => {
      const { result } = renderHook(() => useDemoFlow())
      const emptyPayload: FlowSavePayload = {
        title: '',
        themeId: '',
        lanes: [],
        nodes: [],
        arrows: [],
      }
      expect(() => {
        act(() => {
          result.current.updateFlow(emptyPayload)
        })
      }).not.toThrow()
    })
  })

  // =============================================
  // Return shape compatibility with useFlow
  // =============================================

  describe('return shape compatibility', () => {
    it('should return all properties that useFlow returns', () => {
      const { result } = renderHook(() => useDemoFlow())
      const keys = Object.keys(result.current)
      expect(keys).toContain('flow')
      expect(keys).toContain('loading')
      expect(keys).toContain('error')
      expect(keys).toContain('saveStatus')
      expect(keys).toContain('updateFlow')
      expect(keys).toContain('saveNow')
      expect(keys).toContain('retrySave')
    })

    it('should return functions for updateFlow, saveNow, and retrySave', () => {
      const { result } = renderHook(() => useDemoFlow())
      expect(typeof result.current.updateFlow).toBe('function')
      expect(typeof result.current.saveNow).toBe('function')
      expect(typeof result.current.retrySave).toBe('function')
    })
  })

  // =============================================
  // Independence (multiple renders)
  // =============================================

  describe('independence', () => {
    it('should return independent flow instances across multiple hook renders', () => {
      const { result: r1 } = renderHook(() => useDemoFlow())
      const { result: r2 } = renderHook(() => useDemoFlow())
      // Different object references
      expect(r1.current.flow).not.toBe(r2.current.flow)
      // Same structure
      expect(r1.current.flow.lanes).toHaveLength(r2.current.flow.lanes.length)
    })
  })
})
