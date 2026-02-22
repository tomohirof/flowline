// =============================================
// Theme & Palette constants
// Shared between FlowEditor and SharedFlowViewer
// =============================================

import type { Palette, Theme, ThemeId } from './types'

export const PALETTES: Palette[] = [
  { dot: '#E8985A', tag: '#FFF4EB', text: '#B06828', name: 'Orange' },
  { dot: '#5B8EC9', tag: '#EBF3FF', text: '#2D6AB0', name: 'Blue' },
  { dot: '#9B6BC9', tag: '#F3EBFF', text: '#6B3BA0', name: 'Purple' },
  { dot: '#5AC98A', tag: '#EBFFEF', text: '#2A7A4A', name: 'Green' },
  { dot: '#C95A7B', tag: '#FFEBF0', text: '#A03050', name: 'Pink' },
  { dot: '#5AB5C9', tag: '#EBFAFF', text: '#1A7A90', name: 'Cyan' },
  { dot: '#C9A85A', tag: '#FFF8EB', text: '#8A6A20', name: 'Gold' },
  { dot: '#7B5AC9', tag: '#EFEBFF', text: '#5030A0', name: 'Violet' },
]

export const THEMES: Record<ThemeId, Theme> = {
  cloud: {
    name: 'Cloud',
    emoji: '☁️',
    bg: '#EAEAF2',
    canvasBg: '#EAEAF2',
    dotGrid: '#D6D6E0',
    sidebar: '#fff',
    sidebarBorder: '#E5E4E9',
    sidebarIcon: '#999',
    sidebarActive: '#7C5CFC',
    sidebarActiveBg: '#F0EBFF',
    titleBar: '#fff',
    titleBarBorder: '#E5E4E9',
    titleColor: '#444',
    titleSub: '#999',
    laneBg: '#F5F5F8',
    laneHeaderBg: '#FAFAFD',
    laneBorder: '#E8E8EE',
    laneAccentOpacity: 0.5,
    nodeStroke: '#A09EAE',
    nodeFill: '#fff',
    nodeShadow: '0 3px 12px rgba(60,60,100,0.18), 0 1px 4px rgba(60,60,100,0.10)',
    nodeSelStroke: '#7C5CFC',
    arrowColor: '#8A889A',
    arrowSel: '#7C5CFC',
    accent: '#7C5CFC',
    statusBg: '#fff',
    statusBorder: '#E5E4E9',
    statusText: '#BBB',
    commentPill: 'rgba(255,244,235,0.75)',
    commentBorder: '#F0D8C0',
    commentText: '#B06828',
    panelBg: '#fff',
    panelBorder: '#E5E4E9',
    panelText: '#555',
    panelLabel: '#999',
    inputBg: '#F8F8FC',
    inputBorder: '#E0E0E8',
    commentIconColor: '#D09030',
    dangerColor: '#E06060',
    laneGap: 6,
  },
  midnight: {
    name: 'Midnight',
    emoji: '🌙',
    bg: '#1A1A24',
    canvasBg: '#1A1A24',
    dotGrid: '#2A2A38',
    sidebar: '#222230',
    sidebarBorder: '#333344',
    sidebarIcon: '#666680',
    sidebarActive: '#A78BFA',
    sidebarActiveBg: '#2D2844',
    titleBar: '#222230',
    titleBarBorder: '#333344',
    titleColor: '#D0D0E0',
    titleSub: '#666680',
    laneBg: '#22222E',
    laneHeaderBg: '#2A2A38',
    laneBorder: '#333344',
    laneAccentOpacity: 0.6,
    nodeStroke: '#8888A0',
    nodeFill: '#2A2A38',
    nodeShadow: '0 4px 16px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.25)',
    nodeSelStroke: '#A78BFA',
    arrowColor: '#777790',
    arrowSel: '#A78BFA',
    accent: '#A78BFA',
    statusBg: '#222230',
    statusBorder: '#333344',
    statusText: '#555568',
    commentPill: 'rgba(58,46,30,0.75)',
    commentBorder: '#5A4830',
    commentText: '#D4A050',
    panelBg: '#222230',
    panelBorder: '#333344',
    panelText: '#C0C0D0',
    panelLabel: '#666680',
    inputBg: '#2A2A38',
    inputBorder: '#3A3A4C',
    commentIconColor: '#D4A050',
    dangerColor: '#E06060',
    laneGap: 6,
  },
  blueprint: {
    name: 'Blueprint',
    emoji: '📐',
    bg: '#E8EDF4',
    canvasBg: '#E8EDF4',
    dotGrid: '#CDD4E0',
    sidebar: '#fff',
    sidebarBorder: '#D8DDE6',
    sidebarIcon: '#8899AA',
    sidebarActive: '#3B82F6',
    sidebarActiveBg: '#EBF2FF',
    titleBar: '#fff',
    titleBarBorder: '#D8DDE6',
    titleColor: '#334155',
    titleSub: '#8899AA',
    laneBg: '#F0F3F8',
    laneHeaderBg: '#F6F8FB',
    laneBorder: '#D8DDE6',
    laneAccentOpacity: 0.5,
    nodeStroke: '#8E9CB0',
    nodeFill: '#fff',
    nodeShadow: '0 3px 12px rgba(40,60,90,0.18), 0 1px 4px rgba(40,60,90,0.10)',
    nodeSelStroke: '#3B82F6',
    arrowColor: '#7888A0',
    arrowSel: '#3B82F6',
    accent: '#3B82F6',
    statusBg: '#fff',
    statusBorder: '#D8DDE6',
    statusText: '#99AABB',
    commentPill: 'rgba(255,244,235,0.75)',
    commentBorder: '#E8CEB8',
    commentText: '#A06020',
    panelBg: '#fff',
    panelBorder: '#D8DDE6',
    panelText: '#445566',
    panelLabel: '#8899AA',
    inputBg: '#F4F6FA',
    inputBorder: '#D0D8E4',
    commentIconColor: '#D09030',
    dangerColor: '#E06060',
    laneGap: 6,
  },
}

// =============================================
// Node background color palettes
// =============================================

export interface NodeColor {
  id: string
  fill: string | null
  label: string
  dot: string
}

export const NODE_COLORS: NodeColor[] = [
  { id: 'default', fill: null, label: 'デフォルト', dot: '#ccc' },
  { id: 'white', fill: '#FFFFFF', label: 'ホワイト', dot: '#E0E0E0' },
  { id: 'cream', fill: '#FFF9EF', label: 'クリーム', dot: '#F0DFC0' },
  { id: 'peach', fill: '#FFF0EB', label: 'ピーチ', dot: '#F0C8B8' },
  { id: 'rose', fill: '#FFF0F5', label: 'ローズ', dot: '#F0C0D0' },
  { id: 'lavender', fill: '#F5F0FF', label: 'ラベンダー', dot: '#D0C0F0' },
  { id: 'sky', fill: '#EEF5FF', label: 'スカイ', dot: '#B8D0F0' },
  { id: 'mint', fill: '#EEFFF5', label: 'ミント', dot: '#B0E0C8' },
  { id: 'lemon', fill: '#FEFFF0', label: 'レモン', dot: '#E0E0A0' },
  { id: 'smoke', fill: '#F4F4F6', label: 'スモーク', dot: '#C8C8D0' },
]

export const NODE_COLORS_DARK: NodeColor[] = [
  { id: 'default', fill: null, label: 'デフォルト', dot: '#555' },
  { id: 'charcoal', fill: '#2A2A38', label: 'チャコール', dot: '#444458' },
  { id: 'warm', fill: '#302A24', label: 'ウォーム', dot: '#584830' },
  { id: 'blush', fill: '#302428', label: 'ブラッシュ', dot: '#583040' },
  { id: 'grape', fill: '#2A2434', label: 'グレープ', dot: '#483060' },
  { id: 'navy', fill: '#242A34', label: 'ネイビー', dot: '#304060' },
  { id: 'forest', fill: '#243028', label: 'フォレスト', dot: '#305040' },
  { id: 'olive', fill: '#2C2E22', label: 'オリーブ', dot: '#505030' },
  { id: 'slate', fill: '#2C2C32', label: 'スレート', dot: '#484850' },
]

// =============================================
// Line color & stroke style palettes
// =============================================

export interface LineColor {
  id: string
  color: string | null
  label: string
}

export const LINE_COLORS: LineColor[] = [
  { id: 'default', color: null, label: 'デフォルト' },
  { id: 'gray', color: '#8A889A', label: 'グレー' },
  { id: 'red', color: '#E06060', label: 'レッド' },
  { id: 'orange', color: '#D08040', label: 'オレンジ' },
  { id: 'amber', color: '#C0A030', label: 'アンバー' },
  { id: 'green', color: '#50A060', label: 'グリーン' },
  { id: 'teal', color: '#40A0A0', label: 'ティール' },
  { id: 'blue', color: '#5080D0', label: 'ブルー' },
  { id: 'purple', color: '#8060C0', label: 'パープル' },
  { id: 'pink', color: '#C06088', label: 'ピンク' },
]

export interface StrokeStyle {
  id: string
  label: string
  dash: string
}

export const STROKE_STYLES: StrokeStyle[] = [
  { id: 'solid', label: '実線', dash: 'none' },
  { id: 'dashed', label: '破線', dash: '8,4' },
  { id: 'dotted', label: '点線', dash: '3,3' },
  { id: 'dashdot', label: '一点鎖線', dash: '8,3,2,3' },
]
