import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styles from '../FlowEditor.module.css'
import { PanelSection, PanelRow, PanelInput, PanelTextarea, PanelBtn } from './PanelParts'
import type {
  Theme,
  ThemeId,
  TaskData,
  MemoData,
  RowData,
  InternalLane,
  InternalArrow,
  EditorSettings,
} from '../types'
import {
  PALETTES,
  THEMES,
  NODE_COLORS,
  NODE_COLORS_DARK,
  LINE_COLORS,
  STROKE_STYLES,
} from '../theme-constants'

interface RightPanelProps {
  // Selection
  multiSel: Set<string>
  setMultiSel: React.Dispatch<React.SetStateAction<Set<string>>>
  selTask: string | null
  selArrow: string | null
  setSelArrow: React.Dispatch<React.SetStateAction<string | null>>
  selLane: string | null

  // Data
  tasks: Record<string, TaskData>
  setTasks: React.Dispatch<React.SetStateAction<Record<string, TaskData>>>
  memos: Record<string, MemoData>
  setMemos: React.Dispatch<React.SetStateAction<Record<string, MemoData>>>
  arrows: InternalArrow[]
  setArrows: React.Dispatch<React.SetStateAction<InternalArrow[]>>
  lanes: InternalLane[]
  setLanes: React.Dispatch<React.SetStateAction<InternalLane[]>>
  rows: RowData[]
  order: string[]

  // Theme
  themeId: ThemeId
  setThemeId: React.Dispatch<React.SetStateAction<ThemeId>>
  showThemePicker: boolean
  setShowThemePicker: React.Dispatch<React.SetStateAction<boolean>>

  // Settings
  editorSettings: EditorSettings
  updateEditorSetting: (key: string, value: boolean) => void

  // Actions
  delTask: (id: string) => void
  delMultiSel: () => void
  startConnect: (k: string) => void
  moveLane: (id: string, dir: number) => void
  rmLane: (id: string) => void
  ungroupLane: (laneId: string) => void
  onShapeChange?: (taskKey: string, shape?: 'diamond') => void
  exportMermaid: () => string
  downloadJSON: () => void
  downloadPng: () => void
  pngState: 'idle' | 'generating' | 'done'
}

export const RightPanel = ({
  multiSel,
  setMultiSel,
  selTask,
  selArrow,
  setSelArrow,
  selLane,
  tasks,
  setTasks,
  memos,
  setMemos,
  arrows,
  setArrows,
  lanes,
  setLanes,
  rows,
  order,
  themeId,
  setThemeId,
  showThemePicker,
  setShowThemePicker,
  editorSettings,
  updateEditorSetting,
  delTask,
  delMultiSel,
  startConnect,
  moveLane,
  rmLane,
  ungroupLane,
  onShapeChange,
  exportMermaid,
  downloadJSON,
  downloadPng,
  pngState,
}: RightPanelProps): ReactNode => {
  const { t } = useTranslation('editor')
  const T: Theme = THEMES[themeId]
  const isDark = themeId === 'midnight'

  const selTaskData = selTask ? tasks[selTask] : null
  const selArrowData = selArrow ? arrows.find((a) => a.id === selArrow) : null
  const selLaneData = selLane ? lanes.find((l) => l.id === selLane) : null

  const [mermaidCopied, setMermaidCopied] = useState(false)
  const [jsonDownloaded, setJsonDownloaded] = useState(false)
  const mermaidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jsonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (mermaidTimerRef.current) clearTimeout(mermaidTimerRef.current)
      if (jsonTimerRef.current) clearTimeout(jsonTimerRef.current)
    }
  }, [])

  // Multiple nodes selected
  if (multiSel.size > 0) {
    return (
      <>
        <PanelSection label="">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className={styles.multiSelBadge}>{multiSel.size}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.panelText }}>
              {t('rightPanel.multiSelect', { count: multiSel.size })}
            </span>
          </div>
          <span style={{ fontSize: 10, color: T.panelLabel }}>
            {t('rightPanel.multiSelectHint')}
          </span>
        </PanelSection>
        <PanelSection label={t('rightPanel.bgColor')}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {(isDark ? NODE_COLORS_DARK : NODE_COLORS).map((nc) => (
              <div
                key={nc.id}
                onClick={() =>
                  setTasks((p) => {
                    const n = { ...p }
                    multiSel.forEach((k) => {
                      if (n[k]) n[k] = { ...n[k], bg: nc.fill || undefined }
                    })
                    return n
                  })
                }
                title={nc.label}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: nc.fill || T.nodeFill,
                  border: `1.5px solid ${nc.dot}`,
                  transition: 'all 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {nc.fill === null && (
                  <span style={{ fontSize: 10, color: T.panelLabel }}>&#x2298;</span>
                )}
              </div>
            ))}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.borderColor')}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {LINE_COLORS.map((lc) => (
              <div
                key={lc.id}
                onClick={() =>
                  setTasks((p) => {
                    const n = { ...p }
                    multiSel.forEach((k) => {
                      if (n[k]) n[k] = { ...n[k], strokeColor: lc.color || undefined }
                    })
                    return n
                  })
                }
                title={lc.label}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: T.nodeFill,
                  border: `2px solid ${lc.color || T.nodeStroke}`,
                  transition: 'all 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {lc.color === null && (
                  <span style={{ fontSize: 10, color: T.panelLabel }}>&#x2298;</span>
                )}
              </div>
            ))}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.borderStyle')}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STROKE_STYLES.map((ss) => (
              <div
                key={ss.id}
                onClick={() =>
                  setTasks((p) => {
                    const n = { ...p }
                    multiSel.forEach((k) => {
                      if (n[k]) n[k] = { ...n[k], dash: ss.dash === 'none' ? undefined : ss.dash }
                    })
                    return n
                  })
                }
                title={ss.label}
                style={{
                  flex: 1,
                  minWidth: 42,
                  height: 30,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: `1px solid ${T.inputBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.1s',
                }}
              >
                <svg width="32" height="2" viewBox="0 0 32 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="32"
                    y2="1"
                    stroke={T.panelText}
                    strokeWidth="2"
                    strokeDasharray={ss.dash}
                  />
                </svg>
              </div>
            ))}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.operations')}>
          <button
            className={styles.dangerBtn}
            onClick={() => delMultiSel()}
            data-testid="multi-delete-btn"
          >
            {t('rightPanel.deleteMulti', { count: multiSel.size })}
          </button>
          <button
            className={styles.panelBtn}
            onClick={() => setMultiSel(new Set())}
            style={{ marginTop: 6 }}
            data-testid="multi-deselect-btn"
          >
            {t('rightPanel.deselect')}
          </button>
        </PanelSection>
      </>
    )
  }
  // Node selected
  if (selTask && selTaskData) {
    const lane = lanes.find((l) => l.id === selTaskData.lid)
    const oi = order.indexOf(selTask)
    return (
      <>
        <PanelSection label={t('rightPanel.node')}>
          <PanelRow label={t('rightPanel.label')} />
          <PanelTextarea
            value={selTaskData.label === t('defaultNodeLabel') ? '' : selTaskData.label}
            placeholder={t('rightPanel.defaultLabel')}
            rows={2}
            onChange={(v: string) =>
              setTasks((p2) => ({
                ...p2,
                [selTask]: { ...p2[selTask], label: v || t('defaultNodeLabel') },
              }))
            }
          />
        </PanelSection>
        <PanelSection label={t('rightPanel.shape')}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(
              [
                {
                  shape: undefined as 'diamond' | undefined,
                  label: t('rightPanel.shapeRect'),
                  icon: (active: boolean) => (
                    <svg width="20" height="14" viewBox="0 0 20 14">
                      <rect
                        x="1"
                        y="1"
                        width="18"
                        height="12"
                        rx="3"
                        fill="none"
                        stroke={active ? T.accent : T.panelLabel}
                        strokeWidth="1.5"
                      />
                    </svg>
                  ),
                },
                {
                  shape: 'diamond' as const,
                  label: t('rightPanel.shapeDiamond'),
                  icon: (active: boolean) => (
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <polygon
                        points="10,1 19,10 10,19 1,10"
                        fill="none"
                        stroke={active ? T.accent : T.panelLabel}
                        strokeWidth="1.5"
                      />
                    </svg>
                  ),
                },
              ] as const
            ).map((s) => {
              const isActive = (s.shape || undefined) === (selTaskData.shape || undefined)
              return (
                <div
                  key={s.label}
                  onClick={() => {
                    setTasks((p2) => ({ ...p2, [selTask]: { ...p2[selTask], shape: s.shape } }))
                    onShapeChange?.(selTask, s.shape)
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    height: 32,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isActive ? `${T.accent}15` : 'transparent',
                    border: `1px solid ${isActive ? T.accent : T.inputBorder}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {s.icon(isActive)}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? T.accent : T.panelLabel,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.memo')}>
          <PanelInput
            value={memos[selTask]?.text || ''}
            placeholder={t('rightPanel.memoPlaceholder')}
            onChange={(v: string) =>
              setMemos((p2) => {
                if (!v) {
                  const n = { ...p2 }
                  delete n[selTask]
                  return n
                }
                return {
                  ...p2,
                  [selTask]: { ...(p2[selTask] || { dx: 50, dy: 46 }), text: v },
                }
              })
            }
          />
        </PanelSection>
        <PanelSection label={t('rightPanel.bgColor')}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {(isDark ? NODE_COLORS_DARK : NODE_COLORS).map((nc) => {
              const isActive = nc.fill === null ? !selTaskData.bg : selTaskData.bg === nc.fill
              return (
                <div
                  key={nc.id}
                  onClick={() =>
                    setTasks((p2) => ({
                      ...p2,
                      [selTask]: { ...p2[selTask], bg: nc.fill || undefined },
                    }))
                  }
                  title={nc.label}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: nc.fill || T.nodeFill,
                    border: isActive ? `2px solid ${T.accent}` : `1.5px solid ${nc.dot}`,
                    transition: 'all 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {nc.fill === null && <span style={{ fontSize: 10, color: T.panelLabel }}>⊘</span>}
                </div>
              )
            })}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.borderColor')}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {LINE_COLORS.map((lc) => {
              const isActive =
                lc.color === null ? !selTaskData.strokeColor : selTaskData.strokeColor === lc.color
              return (
                <div
                  key={lc.id}
                  onClick={() =>
                    setTasks((p2) => ({
                      ...p2,
                      [selTask]: { ...p2[selTask], strokeColor: lc.color || undefined },
                    }))
                  }
                  title={lc.label}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: T.nodeFill,
                    border: isActive
                      ? `2px solid ${T.accent}`
                      : `2px solid ${lc.color || T.nodeStroke}`,
                    transition: 'all 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {lc.color === null && (
                    <span style={{ fontSize: 10, color: T.panelLabel }}>⊘</span>
                  )}
                </div>
              )
            })}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.borderStyle')}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STROKE_STYLES.map((ss) => {
              const isActive = ss.dash === 'none' ? !selTaskData.dash : selTaskData.dash === ss.dash
              return (
                <div
                  key={ss.id}
                  onClick={() =>
                    setTasks((p2) => ({
                      ...p2,
                      [selTask]: {
                        ...p2[selTask],
                        dash: ss.dash === 'none' ? undefined : ss.dash,
                      },
                    }))
                  }
                  title={ss.label}
                  style={{
                    flex: 1,
                    minWidth: 42,
                    height: 30,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isActive ? (isDark ? '#333' : '#F0EBFF') : 'transparent',
                    border: `1px solid ${isActive ? T.accent : T.inputBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}
                >
                  <svg width="32" height="2" viewBox="0 0 32 2">
                    <line
                      x1="0"
                      y1="1"
                      x2="32"
                      y2="1"
                      stroke={isActive ? T.accent : T.panelText}
                      strokeWidth="2"
                      strokeDasharray={ss.dash}
                    />
                  </svg>
                </div>
              )
            })}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.nodeInfo')}>
          <PanelRow label={t('rightPanel.nodeLane')}>
            <span className={styles.panelValueText}>{lane?.name}</span>
          </PanelRow>
          {oi !== -1 && (
            <PanelRow label={t('rightPanel.nodeOrder')}>
              <span className={styles.panelValueText}>{oi + 1}</span>
            </PanelRow>
          )}
        </PanelSection>
        <PanelSection label={t('rightPanel.operations')}>
          <div className={styles.panelActions}>
            <PanelBtn
              label={t('rightPanel.nodeConnect')}
              color={T.accent}
              onClick={() => startConnect(selTask)}
            />
            <PanelBtn
              label={t('rightPanel.nodeDelete')}
              color="#E06060"
              onClick={() => delTask(selTask)}
            />
          </div>
        </PanelSection>
      </>
    )
  }

  // Arrow selected
  if (selArrow && selArrowData) {
    const fromT = tasks[selArrowData.from],
      toT = tasks[selArrowData.to]
    return (
      <>
        <PanelSection label={t('rightPanel.arrow')}>
          <PanelRow label="From">
            <span className={styles.panelValueText}>{fromT?.label || '?'}</span>
          </PanelRow>
          <PanelRow label="To">
            <span className={styles.panelValueText}>{toT?.label || '?'}</span>
          </PanelRow>
        </PanelSection>
        <PanelSection label={t('rightPanel.arrowComment')}>
          <PanelInput
            value={selArrowData.comment || ''}
            placeholder={t('rightPanel.arrowCommentPlaceholder')}
            onChange={(v: string) =>
              setArrows((p) => p.map((a) => (a.id === selArrow ? { ...a, comment: v } : a)))
            }
          />
        </PanelSection>
        <PanelSection label={t('rightPanel.arrowColor')}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {LINE_COLORS.map((lc) => {
              const isActive =
                lc.color === null ? !selArrowData.color : selArrowData.color === lc.color
              return (
                <div
                  key={lc.id}
                  onClick={() =>
                    setArrows((p) =>
                      p.map((a) =>
                        a.id === selArrow ? { ...a, color: lc.color || undefined } : a,
                      ),
                    )
                  }
                  title={lc.label}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: T.nodeFill,
                    border: isActive
                      ? `2px solid ${T.accent}`
                      : `2px solid ${lc.color || T.arrowColor}`,
                    transition: 'all 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {lc.color && (
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: lc.color,
                      }}
                    />
                  )}
                  {lc.color === null && (
                    <span style={{ fontSize: 10, color: T.panelLabel }}>⊘</span>
                  )}
                </div>
              )
            })}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.arrowStyle')}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STROKE_STYLES.map((ss) => {
              const isActive =
                ss.dash === 'none' ? !selArrowData.dash : selArrowData.dash === ss.dash
              return (
                <div
                  key={ss.id}
                  onClick={() =>
                    setArrows((p) =>
                      p.map((a) =>
                        a.id === selArrow
                          ? { ...a, dash: ss.dash === 'none' ? undefined : ss.dash }
                          : a,
                      ),
                    )
                  }
                  title={ss.label}
                  style={{
                    flex: 1,
                    minWidth: 42,
                    height: 30,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isActive ? (isDark ? '#333' : '#F0EBFF') : 'transparent',
                    border: `1px solid ${isActive ? T.accent : T.inputBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}
                >
                  <svg width="32" height="2" viewBox="0 0 32 2">
                    <line
                      x1="0"
                      y1="1"
                      x2="32"
                      y2="1"
                      stroke={isActive ? T.accent : T.panelText}
                      strokeWidth="2"
                      strokeDasharray={ss.dash}
                    />
                  </svg>
                </div>
              )
            })}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.operations')}>
          <div className={styles.panelActions}>
            <PanelBtn
              label={t('rightPanel.arrowReverse')}
              color={T.accent}
              onClick={() =>
                setArrows((p) =>
                  p.map((a) => (a.id === selArrow ? { ...a, from: a.to, to: a.from } : a)),
                )
              }
            />
            <PanelBtn
              label={t('rightPanel.arrowDelete')}
              color="#E06060"
              onClick={() => {
                setArrows((p) => p.filter((a) => a.id !== selArrow))
                setSelArrow(null)
              }}
            />
          </div>
        </PanelSection>
      </>
    )
  }

  // Lane selected
  if (selLane && selLaneData) {
    return (
      <>
        <PanelSection label={t('rightPanel.lane')}>
          <PanelRow label={t('rightPanel.laneName')} />
          <PanelInput
            value={selLaneData.name}
            onChange={(v: string) =>
              setLanes((p) => p.map((l) => (l.id === selLane ? { ...l, name: v } : l)))
            }
          />
        </PanelSection>
        <PanelSection label={t('rightPanel.laneColor')}>
          <div className={styles.panelActions}>
            {PALETTES.map((p, ci) => (
              <div
                key={ci}
                onClick={() =>
                  setLanes((prev) => prev.map((l) => (l.id === selLane ? { ...l, ci } : l)))
                }
                className={styles.colorSwatch}
                style={{
                  background: p.dot,
                  border: selLaneData.ci === ci ? `2px solid ${T.accent}` : '2px solid transparent',
                }}
              />
            ))}
          </div>
        </PanelSection>
        <PanelSection label={t('rightPanel.laneOrder')}>
          <div style={{ display: 'flex', gap: 6 }}>
            <PanelBtn
              label={t('rightPanel.laneMovePrev')}
              color={T.accent}
              onClick={() => moveLane(selLane, -1)}
            />
            <PanelBtn
              label={t('rightPanel.laneMoveNext')}
              color={T.accent}
              onClick={() => moveLane(selLane, 1)}
            />
          </div>
        </PanelSection>
        {selLaneData.groupId && (
          <PanelSection label={t('rightPanel.laneGroup')}>
            <PanelBtn
              label={t('rightPanel.laneUngroup')}
              color={T.accent}
              onClick={() => ungroupLane(selLane)}
              full
            />
          </PanelSection>
        )}
        <PanelSection label={t('rightPanel.operations')}>
          <PanelBtn
            label={t('rightPanel.laneDelete')}
            color="#E06060"
            onClick={() => rmLane(selLane)}
            full
          />
        </PanelSection>
      </>
    )
  }

  // Nothing selected -> Theme & Canvas
  return (
    <>
      <PanelSection label={t('rightPanel.theme')}>
        <div className={styles.themePickerWrapper}>
          <div onClick={() => setShowThemePicker((v) => !v)} className={styles.themePickerTrigger}>
            <span className={styles.themePickerLabel}>
              <span className={styles.themePickerEmoji}>{THEMES[themeId].emoji}</span>
              {THEMES[themeId].name}
            </span>
            <span className={styles.themePickerArrow}>{showThemePicker ? '▲' : '▼'}</span>
          </div>
          {showThemePicker && (
            <div className={styles.themePickerDropdown}>
              {(Object.entries(THEMES) as [ThemeId, Theme][]).map(([id, th]) => (
                <div
                  key={id}
                  onClick={() => {
                    setThemeId(id)
                    setShowThemePicker(false)
                  }}
                  className={styles.themePickerOption}
                  style={{
                    background: themeId === id ? T.sidebarActiveBg : 'transparent',
                    color: themeId === id ? T.accent : T.panelText,
                  }}
                >
                  <span className={styles.themePickerEmoji}>{th.emoji}</span>
                  {th.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </PanelSection>
      <PanelSection label={t('rightPanel.canvas')}>
        <PanelRow label={t('rightPanel.canvasLanes')}>
          <span className={styles.panelValueTextLarge}>{lanes.length}</span>
        </PanelRow>
        <PanelRow label={t('rightPanel.canvasRows')}>
          <span className={styles.panelValueTextLarge}>{rows.length}</span>
        </PanelRow>
        <PanelRow label={t('rightPanel.canvasNodes')}>
          <span className={styles.panelValueTextLarge}>{Object.keys(tasks).length}</span>
        </PanelRow>
        <PanelRow label={t('rightPanel.canvasArrows')}>
          <span className={styles.panelValueTextLarge}>{arrows.length}</span>
        </PanelRow>
      </PanelSection>
      <PanelSection label={t('rightPanel.exportSection')}>
        <PanelBtn
          label={mermaidCopied ? t('rightPanel.mermaidCopied') : t('rightPanel.mermaidCopy')}
          color={T.accent}
          onClick={async () => {
            try {
              if (!navigator.clipboard) return
              await navigator.clipboard.writeText(exportMermaid())
              if (mermaidTimerRef.current) clearTimeout(mermaidTimerRef.current)
              setMermaidCopied(true)
              mermaidTimerRef.current = setTimeout(() => setMermaidCopied(false), 1500)
            } catch {
              // clipboard write failed — do not show feedback
            }
          }}
          full
        />
        <PanelBtn
          label={jsonDownloaded ? t('rightPanel.jsonDownloaded') : t('rightPanel.jsonDownload')}
          color={T.accent}
          onClick={() => {
            downloadJSON()
            if (jsonTimerRef.current) clearTimeout(jsonTimerRef.current)
            setJsonDownloaded(true)
            jsonTimerRef.current = setTimeout(() => setJsonDownloaded(false), 1500)
          }}
          full
        />
        <PanelBtn
          label={
            pngState === 'generating'
              ? t('rightPanel.imagePngGenerating')
              : pngState === 'done'
                ? t('rightPanel.imagePngDownloaded')
                : t('rightPanel.imagePngDownload')
          }
          color={T.accent}
          disabled={pngState === 'generating'}
          onClick={downloadPng}
          full
        />
      </PanelSection>
      <PanelSection label={t('rightPanel.behavior')}>
        {(
          [
            { key: 'copyLabelOnSameRow', label: t('rightPanel.behaviorCopyLabel') },
            { key: 'autoConnect', label: t('rightPanel.behaviorAutoConnect') },
            { key: 'autoAddRow', label: t('rightPanel.behaviorAutoAddRow') },
            { key: 'enterEditOnCreate', label: t('rightPanel.behaviorEditOnCreate') },
            { key: 'autoRepair', label: t('rightPanel.behaviorAutoRepair') },
          ] as const
        ).map((s) => (
          <div
            key={s.key}
            role="checkbox"
            aria-checked={editorSettings[s.key]}
            tabIndex={0}
            className={styles.settingCheckbox}
            onClick={() => updateEditorSetting(s.key, !editorSettings[s.key])}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                updateEditorSetting(s.key, !editorSettings[s.key])
              }
            }}
            data-testid={`setting-${s.key}`}
          >
            <div
              className={`${styles.checkboxBox} ${editorSettings[s.key] ? styles.checkboxBoxChecked : ''}`}
            >
              {editorSettings[s.key] && (
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span className={styles.checkboxLabel}>{s.label}</span>
          </div>
        ))}
      </PanelSection>
      <PanelSection label={t('rightPanel.display')}>
        {(
          [
            { key: 'showDotGrid', label: t('rightPanel.displayDotGrid') },
            { key: 'showOrderBadge', label: t('rightPanel.displayOrderBadge') },
          ] as const
        ).map((s) => (
          <div
            key={s.key}
            role="checkbox"
            aria-checked={editorSettings[s.key]}
            tabIndex={0}
            className={styles.settingCheckbox}
            onClick={() => updateEditorSetting(s.key, !editorSettings[s.key])}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                updateEditorSetting(s.key, !editorSettings[s.key])
              }
            }}
            data-testid={`setting-${s.key}`}
          >
            <div
              className={`${styles.checkboxBox} ${editorSettings[s.key] ? styles.checkboxBoxChecked : ''}`}
            >
              {editorSettings[s.key] && (
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span className={styles.checkboxLabel}>{s.label}</span>
          </div>
        ))}
      </PanelSection>
    </>
  )
}
