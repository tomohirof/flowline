// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFlow } from './useFlow'
import type { Flow, FlowSavePayload } from '../types'

// Mock the api module
vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { apiFetch, ApiError } from '../../../lib/api'

const mockApiFetch = vi.mocked(apiFetch)

const mockFlow: Flow = {
  id: 'flow-1',
  title: 'Test Flow',
  themeId: 'cloud',
  shareToken: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lanes: [
    { id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 },
    { id: 'lane-2', name: 'Lane 2', colorIndex: 1, position: 1 },
  ],
  nodes: [
    { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'Task 1', note: null, orderIndex: 0 },
  ],
  arrows: [],
}

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('useFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =============================================
  // Initial load tests
  // =============================================

  describe('initial load', () => {
    it('should start with loading=true and flow=null', () => {
      mockApiFetch.mockImplementation(() => new Promise(() => {})) // never resolves
      const { result } = renderHook(() => useFlow('flow-1'))
      expect(result.current.loading).toBe(true)
      expect(result.current.flow).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.saveStatus).toBe('saved')
    })

    it('should load flow data from GET /api/flows/:id', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.flow).toEqual(mockFlow)
      expect(result.current.error).toBeNull()
      expect(mockApiFetch).toHaveBeenCalledWith('/flows/flow-1')
    })

    it('should set error when load fails with 404', async () => {
      mockApiFetch.mockRejectedValueOnce(new ApiError(404, 'フローが見つかりません'))

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.flow).toBeNull()
      expect(result.current.error).toBe('フローが見つかりません')
    })

    it('should set error when load fails with 500', async () => {
      mockApiFetch.mockRejectedValueOnce(new ApiError(500, 'サーバーエラー'))

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.flow).toBeNull()
      expect(result.current.error).toBe('サーバーエラー')
    })

    it('should set generic error message for network errors', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Failed to fetch'))

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.flow).toBeNull()
      expect(result.current.error).toBe('フローの読み込みに失敗しました')
    })

    it('should handle empty flow id gracefully', () => {
      const { result } = renderHook(() => useFlow(''))
      expect(mockApiFetch).not.toHaveBeenCalled()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('フローIDが指定されていません')
    })
  })

  // =============================================
  // Auto-save (debounce) tests
  // =============================================

  describe('auto-save with debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should set saveStatus to unsaved when updateFlow is called', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const payload: FlowSavePayload = {
        title: 'Updated Title',
        themeId: 'cloud',
        lanes: mockFlow.lanes,
        nodes: mockFlow.nodes,
        arrows: mockFlow.arrows,
      }

      act(() => {
        result.current.updateFlow(payload)
      })

      expect(result.current.saveStatus).toBe('unsaved')
    })

    it('should debounce save for 2 seconds after updateFlow', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const payload: FlowSavePayload = {
        title: 'Updated Title',
        themeId: 'cloud',
        lanes: mockFlow.lanes,
        nodes: mockFlow.nodes,
        arrows: mockFlow.arrows,
      }

      mockApiFetch.mockResolvedValueOnce({ flow: { ...mockFlow, title: 'Updated Title' } })

      act(() => {
        result.current.updateFlow(payload)
      })

      // Not yet called (still within debounce window)
      expect(mockApiFetch).toHaveBeenCalledTimes(1) // only the initial GET

      // Advance timer by 2 seconds
      await act(async () => {
        vi.advanceTimersByTime(2000)
        await flushPromises()
      })

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledTimes(2)
      })

      expect(mockApiFetch).toHaveBeenLastCalledWith('/flows/flow-1', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    })

    it('should reset debounce timer when updateFlow is called again', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const payload1: FlowSavePayload = {
        title: 'First Update',
        themeId: 'cloud',
        lanes: mockFlow.lanes,
        nodes: mockFlow.nodes,
        arrows: mockFlow.arrows,
      }

      const payload2: FlowSavePayload = {
        title: 'Second Update',
        themeId: 'cloud',
        lanes: mockFlow.lanes,
        nodes: mockFlow.nodes,
        arrows: mockFlow.arrows,
      }

      mockApiFetch.mockResolvedValueOnce({ flow: { ...mockFlow, title: 'Second Update' } })

      act(() => {
        result.current.updateFlow(payload1)
      })

      // 1 second passes
      await act(async () => {
        vi.advanceTimersByTime(1000)
        await flushPromises()
      })

      // Update again - should reset timer
      act(() => {
        result.current.updateFlow(payload2)
      })

      // 1 more second passes (total 2s from first, 1s from second)
      await act(async () => {
        vi.advanceTimersByTime(1000)
        await flushPromises()
      })

      // Should NOT have saved yet (only 1s since last update)
      expect(mockApiFetch).toHaveBeenCalledTimes(1)

      // 1 more second passes (total 2s from second update)
      await act(async () => {
        vi.advanceTimersByTime(1000)
        await flushPromises()
      })

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledTimes(2)
      })

      // Should save with the LATEST payload
      expect(mockApiFetch).toHaveBeenLastCalledWith('/flows/flow-1', {
        method: 'PUT',
        body: JSON.stringify(payload2),
      })
    })
  })

  // =============================================
  // Save status transitions
  // =============================================

  describe('save status transitions', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should transition saved -> unsaved -> saving -> saved', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.saveStatus).toBe('saved')
      })

      const payload: FlowSavePayload = {
        title: 'Updated',
        themeId: 'cloud',
        lanes: mockFlow.lanes,
        nodes: mockFlow.nodes,
        arrows: mockFlow.arrows,
      }

      mockApiFetch.mockResolvedValueOnce({ flow: { ...mockFlow, title: 'Updated' } })

      act(() => {
        result.current.updateFlow(payload)
      })

      expect(result.current.saveStatus).toBe('unsaved')

      await act(async () => {
        vi.advanceTimersByTime(2000)
        await flushPromises()
      })

      await waitFor(() => {
        expect(result.current.saveStatus).toBe('saved')
      })
    })

    it('should set saveStatus to error when save fails', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const payload: FlowSavePayload = {
        title: 'Updated',
        themeId: 'cloud',
        lanes: mockFlow.lanes,
        nodes: mockFlow.nodes,
        arrows: mockFlow.arrows,
      }

      mockApiFetch.mockRejectedValueOnce(new ApiError(500, 'Internal Server Error'))

      act(() => {
        result.current.updateFlow(payload)
      })

      await act(async () => {
        vi.advanceTimersByTime(2000)
        await flushPromises()
      })

      await waitFor(() => {
        expect(result.current.saveStatus).toBe('error')
      })
    })
  })

  // =============================================
  // Immediate save (Ctrl+S)
  // =============================================

  describe('immediate save', () => {
    it('should save immediately when saveNow is called', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const payload: FlowSavePayload = {
        title: 'Immediate Save',
        themeId: 'cloud',
        lanes: mockFlow.lanes,
        nodes: mockFlow.nodes,
        arrows: mockFlow.arrows,
      }

      mockApiFetch.mockResolvedValueOnce({ flow: { ...mockFlow, title: 'Immediate Save' } })

      act(() => {
        result.current.updateFlow(payload)
      })

      // Save immediately (without waiting for debounce)
      await act(async () => {
        result.current.saveNow()
      })

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledTimes(2)
      })

      expect(mockApiFetch).toHaveBeenLastCalledWith('/flows/flow-1', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    })

    it('should not call save when there are no pending changes', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        result.current.saveNow()
      })

      // Only the initial GET, no PUT
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })
  })

  // =============================================
  // Edge cases
  // =============================================

  describe('edge cases', () => {
    it('should handle flow with empty lanes, nodes, and arrows', async () => {
      const emptyFlow: Flow = {
        ...mockFlow,
        lanes: [],
        nodes: [],
        arrows: [],
      }
      mockApiFetch.mockResolvedValueOnce({ flow: emptyFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.flow).toEqual(emptyFlow)
    })

    it('should reload flow when flowId changes', async () => {
      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result, rerender } = renderHook(({ id }) => useFlow(id), {
        initialProps: { id: 'flow-1' },
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.flow?.id).toBe('flow-1')

      const otherFlow = { ...mockFlow, id: 'flow-2', title: 'Other Flow' }
      mockApiFetch.mockResolvedValueOnce({ flow: otherFlow })

      rerender({ id: 'flow-2' })

      await waitFor(() => {
        expect(result.current.flow?.id).toBe('flow-2')
      })

      expect(mockApiFetch).toHaveBeenCalledWith('/flows/flow-2')
    })

    it('should cancel pending debounce when flowId changes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result, rerender } = renderHook(({ id }) => useFlow(id), {
        initialProps: { id: 'flow-1' },
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const payload: FlowSavePayload = {
        title: 'Updated',
        themeId: 'cloud',
        lanes: mockFlow.lanes,
        nodes: mockFlow.nodes,
        arrows: mockFlow.arrows,
      }

      act(() => {
        result.current.updateFlow(payload)
      })

      const otherFlow = { ...mockFlow, id: 'flow-2', title: 'Other Flow' }
      mockApiFetch.mockResolvedValueOnce({ flow: otherFlow })

      rerender({ id: 'flow-2' })

      // Advance past debounce time - should NOT save to flow-1
      await act(async () => {
        vi.advanceTimersByTime(3000)
        await flushPromises()
      })

      // Only 2 calls: GET flow-1, GET flow-2 (no PUT for flow-1)
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledTimes(2)
      })

      vi.useRealTimers()
    })

    it('should handle concurrent rapid updates', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockApiFetch.mockResolvedValueOnce({ flow: mockFlow })

      const { result } = renderHook(() => useFlow('flow-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      mockApiFetch.mockResolvedValueOnce({ flow: { ...mockFlow, title: 'Final' } })

      // Simulate multiple rapid updates
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.updateFlow({
            title: `Update ${i}`,
            themeId: 'cloud',
            lanes: mockFlow.lanes,
            nodes: mockFlow.nodes,
            arrows: mockFlow.arrows,
          })
        })
      }

      await act(async () => {
        vi.advanceTimersByTime(2000)
        await flushPromises()
      })

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledTimes(2) // 1 GET + 1 PUT (last one only)
      })

      // Should save with the LAST payload
      expect(mockApiFetch).toHaveBeenLastCalledWith('/flows/flow-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Update 4',
          themeId: 'cloud',
          lanes: mockFlow.lanes,
          nodes: mockFlow.nodes,
          arrows: mockFlow.arrows,
        }),
      })

      vi.useRealTimers()
    })
  })
})
