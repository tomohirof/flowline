import { describe, it, expect } from 'vitest'
import { isGroupParent, isGroupSub, getGroupWidth } from './lane-group-utils'

describe('lane-group-utils', () => {
  describe('isGroupParent', () => {
    it('should return true for parent lane with groupId', () => {
      expect(isGroupParent({ groupId: 'g1', groupRole: 'parent' })).toBe(true)
    })
    it('should return false for sub lane', () => {
      expect(isGroupParent({ groupId: 'g1', groupRole: 'sub' })).toBe(false)
    })
    it('should return false when groupId is undefined', () => {
      expect(isGroupParent({ groupRole: 'parent' })).toBe(false)
    })
    it('should return false for ungrouped lane', () => {
      expect(isGroupParent({})).toBe(false)
    })
    it('should return false when groupId is empty string', () => {
      expect(isGroupParent({ groupId: '', groupRole: 'parent' })).toBe(false)
    })
  })

  describe('isGroupSub', () => {
    it('should return true for sub lane with groupId', () => {
      expect(isGroupSub({ groupId: 'g1', groupRole: 'sub' })).toBe(true)
    })
    it('should return false for parent lane', () => {
      expect(isGroupSub({ groupId: 'g1', groupRole: 'parent' })).toBe(false)
    })
    it('should return false when groupId is undefined', () => {
      expect(isGroupSub({ groupRole: 'sub' })).toBe(false)
    })
    it('should return false when groupId is empty string', () => {
      expect(isGroupSub({ groupId: '', groupRole: 'sub' })).toBe(false)
    })
    it('should return false for ungrouped lane', () => {
      expect(isGroupSub({})).toBe(false)
    })
  })

  describe('getGroupWidth', () => {
    const LW = 200
    const G = 6

    it('should return LW for ungrouped lane', () => {
      const lane = { id: 'a', name: 'L1', ci: 0 }
      const lanes = [lane]
      expect(getGroupWidth(lane, lanes, LW, G)).toBe(200)
    })
    it('should return correct width for 2-lane group', () => {
      const lanes = [
        { id: 'a', name: 'L1', ci: 0, groupId: 'g1', groupRole: 'parent' as const },
        { id: 'b', name: 'L2', ci: 0, groupId: 'g1', groupRole: 'sub' as const },
      ]
      expect(getGroupWidth(lanes[0], lanes, LW, G)).toBe(406)
    })
    it('should return correct width for 3-lane group', () => {
      const lanes = [
        { id: 'a', name: 'L1', ci: 0, groupId: 'g1', groupRole: 'parent' as const },
        { id: 'b', name: 'L2', ci: 0, groupId: 'g1', groupRole: 'sub' as const },
        { id: 'c', name: 'L3', ci: 0, groupId: 'g1', groupRole: 'sub' as const },
      ]
      expect(getGroupWidth(lanes[0], lanes, LW, G)).toBe(612)
    })
    it('should only count lanes in the same group', () => {
      const lanes = [
        { id: 'a', name: 'L1', ci: 0, groupId: 'g1', groupRole: 'parent' as const },
        { id: 'b', name: 'L2', ci: 0, groupId: 'g1', groupRole: 'sub' as const },
        { id: 'c', name: 'L3', ci: 1 },
      ]
      expect(getGroupWidth(lanes[0], lanes, LW, G)).toBe(406)
    })
    it('should return LW for single-member group', () => {
      const lanes = [
        { id: 'a', name: 'L1', ci: 0, groupId: 'g1', groupRole: 'parent' as const },
      ]
      expect(getGroupWidth(lanes[0], lanes, LW, G)).toBe(200)
    })
    it('should handle multiple separate groups correctly', () => {
      const lanes = [
        { id: 'a', name: 'L1', ci: 0, groupId: 'g1', groupRole: 'parent' as const },
        { id: 'b', name: 'L2', ci: 0, groupId: 'g1', groupRole: 'sub' as const },
        { id: 'c', name: 'L3', ci: 1, groupId: 'g2', groupRole: 'parent' as const },
        { id: 'd', name: 'L4', ci: 1, groupId: 'g2', groupRole: 'sub' as const },
        { id: 'e', name: 'L5', ci: 1, groupId: 'g2', groupRole: 'sub' as const },
      ]
      expect(getGroupWidth(lanes[0], lanes, LW, G)).toBe(406)
      expect(getGroupWidth(lanes[2], lanes, LW, G)).toBe(612)
    })
    it('should return LW when gap is 0', () => {
      const lanes = [
        { id: 'a', name: 'L1', ci: 0, groupId: 'g1', groupRole: 'parent' as const },
        { id: 'b', name: 'L2', ci: 0, groupId: 'g1', groupRole: 'sub' as const },
      ]
      expect(getGroupWidth(lanes[0], lanes, 200, 0)).toBe(400)
    })
  })
})
