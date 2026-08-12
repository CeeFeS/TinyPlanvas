'use client'

import { memo, useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { Plus, ChevronRight, ChevronLeft, GripVertical, ChevronsUpDown, ChevronsDownUp, Trash2, CornerDownLeft } from 'lucide-react'
import {
  useProjectStore,
  useProjectActions,
  useCanEdit,
  selectCanEdit,
  findResourceInTree,
} from '@/store/project-store'
import { useTranslation } from '@/lib/language-context'
import { 
  cn, 
  generateTimeSlots, 
  formatTimeSlotHeader, 
  formatTimeSlotGroup,
  dateToSlotKey,
  buildSlotKeys,
  percentageToOpacity,
  getContrastTextColor,
  mixAllocationColors,
  computeTaskAggregation,
  mergeTaskComputed,
  flattenTasksWithChildren,
  generateNextDisplayId,
  generateNextSubtaskDisplayId,
} from '@/lib/utils'
import { format, parseISO, addYears, addMonths, startOfYear, startOfMonth, endOfYear, endOfMonth, isAfter, isBefore } from 'date-fns'
import type { TaskWithAggregation, ResourceWithAllocations, Resolution, CustomColumn, CustomRowType } from '@/lib/types'
import {
  CustomColumnCell,
  CustomColumnHeaderCell,
  AddColumnHeader,
  CustomValueEditor,
  type CustomCellEditTarget,
} from './custom-column-cell'
import { ColumnFilter } from './column-filter'

// ==================== Time Window Configuration ====================

// Maximum number of time units per view based on resolution
const TIME_WINDOW_CONFIG: Record<Resolution, { maxSlots: number; stepLabelKey: string }> = {
  year: { maxSlots: 10, stepLabelKey: 'tenYears' },    // 10 years per view
  month: { maxSlots: 12, stepLabelKey: 'oneYear' },     // 12 months (1 year) per view
  week: { maxSlots: 17, stepLabelKey: 'fourMonths' },    // ~17 weeks (4 months) per view
  day: { maxSlots: 31, stepLabelKey: 'oneMonth' },      // Max 31 days (1 month) per view
}

// Calculate time window based on offset and resolution
function calculateTimeWindow(
  projectStart: Date,
  projectEnd: Date,
  resolution: Resolution,
  offset: number // Number of "steps" from project start
): { windowStart: Date; windowEnd: Date } {
  let windowStart: Date
  let windowEnd: Date

  switch (resolution) {
    case 'year':
      // Step = 10 years
      windowStart = addYears(startOfYear(projectStart), offset * 10)
      windowEnd = addYears(windowStart, 9) // 10 years
      windowEnd = endOfYear(windowEnd)
      break
    case 'month':
      // Step = 1 year
      windowStart = addYears(startOfYear(projectStart), offset)
      windowEnd = endOfYear(windowStart)
      break
    case 'week':
      // Step = 4 months
      windowStart = addMonths(startOfMonth(projectStart), offset * 4)
      windowEnd = endOfMonth(addMonths(windowStart, 3))
      break
    case 'day':
      // Step = 1 month
      windowStart = addMonths(startOfMonth(projectStart), offset)
      windowEnd = endOfMonth(windowStart)
      break
  }

  // Limit to project boundaries
  if (isBefore(windowStart, projectStart)) {
    windowStart = projectStart
  }
  if (isAfter(windowEnd, projectEnd)) {
    windowEnd = projectEnd
  }

  return { windowStart, windowEnd }
}

// Calculate maximum number of steps based on project duration
function calculateMaxOffset(
  projectStart: Date,
  projectEnd: Date,
  resolution: Resolution
): number {
  const yearsDiff = projectEnd.getFullYear() - projectStart.getFullYear()
  const monthsDiff = (projectEnd.getFullYear() - projectStart.getFullYear()) * 12 + 
                     (projectEnd.getMonth() - projectStart.getMonth())

  switch (resolution) {
    case 'year':
      return Math.max(0, Math.ceil(yearsDiff / 10))
    case 'month':
      return Math.max(0, yearsDiff)
    case 'week':
      return Math.max(0, Math.ceil(monthsDiff / 4))
    case 'day':
      return Math.max(0, monthsDiff)
  }
}

// ==================== Column Resizer Component ====================

interface ColumnResizerProps {
  onResize: (delta: number) => void
  /** Called once when the drag ends (mouse up) - useful for persisting the width. */
  onResizeEnd?: () => void
}

function ColumnResizer({ onResize, onResizeEnd }: ColumnResizerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  // Keep latest callbacks in refs so the drag effect never resubscribes mid-drag,
  // even if the parent passes new callback identities on every render.
  const onResizeRef = useRef(onResize)
  const onResizeEndRef = useRef(onResizeEnd)
  onResizeRef.current = onResize
  onResizeEndRef.current = onResizeEnd

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    startXRef.current = e.clientX
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current
      if (Math.abs(delta) > 2) {
        onResizeRef.current(delta)
        startXRef.current = e.clientX
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      onResizeEndRef.current?.()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group/resizer z-30',
        'hover:bg-ink-blue/30 transition-colors',
        isDragging && 'bg-ink-blue/50'
      )}
      onMouseDown={handleMouseDown}
    >
      <div 
        className={cn(
          'absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
          'opacity-0 group-hover/resizer:opacity-100 transition-opacity',
          isDragging && 'opacity-100'
        )}
      >
        <GripVertical size={12} className="text-ink-faded" />
      </div>
    </div>
  )
}

// ==================== Main Planning Grid ====================

const ID_COLUMN_WIDTH = 48 // Fixed width for ID column
const MIN_TASK_WIDTH = 40
const MIN_RESOURCE_WIDTH = 40
const DEFAULT_TASK_WIDTH = 180
const DEFAULT_RESOURCE_WIDTH = 160
const START_COLUMN_WIDTH = 88  // Start (yyyy-mm-dd)
const END_COLUMN_WIDTH = 88    // End (yyyy-mm-dd)
const SUM_COLUMN_WIDTH = 56    // Σ (Sum)
const MIN_ALLOCATION_WIDTH = 56 // Min allocation
const MAX_ALLOCATION_WIDTH = 56 // Max allocation
const MIN_SLOT_WIDTH = 28 // Narrowest a time-slot column may get before the grid scrolls
const CUSTOM_COL_WIDTH = 180 // Default custom column width (fallback when unset)
const MIN_CUSTOM_COL_WIDTH = 100 // Min custom column width when resizing
const MAX_CUSTOM_COL_WIDTH = 600 // Max custom column width when resizing
const ADD_COL_WIDTH = 44 // "Add column" control width

/**
 * Frozen columns (task/resource) must not eat the whole screen on small
 * monitors - every pixel they take is one the time slots cannot use, which is
 * what pushes the allocation chips into a horizontal scroll. The widths follow
 * the viewport until the user resizes a column by hand.
 */
function responsiveColumnWidths(viewportWidth: number): { task: number; resource: number } {
  if (viewportWidth < 1024) return { task: 112, resource: 96 }
  if (viewportWidth < 1280) return { task: 132, resource: 112 }
  if (viewportWidth < 1600) return { task: 156, resource: 132 }
  return { task: DEFAULT_TASK_WIDTH, resource: DEFAULT_RESOURCE_WIDTH }
}

export function PlanningGrid() {
  const { t, dateLocale, language } = useTranslation()

  // Subscribe to individual slices only: painting a cell must not re-render the
  // grid because of unrelated state (presence heartbeats, brush changes, …).
  const project = useProjectStore((s) => s.project)
  const tasksWithData = useProjectStore((s) => s.tasksWithData)
  const customColumns = useProjectStore((s) => s.customColumns)
  const customValues = useProjectStore((s) => s.customValues)
  const hasEditPermission = useCanEdit()
  const projectId = project?.id

  // Actions never change identity, so reading them costs no subscription.
  const {
    createTaskAsync,
    createResourceAsync,
    updateTask,
    updateTaskAsync,
    moveTaskAsync,
    updateResource,
    updateResourceAsync,
    deleteTaskAsync,
    deleteResourceAsync,
    createCustomColumnAsync,
    updateCustomColumnAsync,
    deleteCustomColumnAsync,
    setCustomValueAsync,
  } = useProjectActions()

  // ==================== Custom Columns ====================
  const sortedCustomColumns = useMemo(
    () => [...customColumns].sort((a, b) => a.sort_order - b.sort_order),
    [customColumns]
  )
  const showAddColumn = hasEditPermission
  const extraColCount = sortedCustomColumns.length + (showAddColumn ? 1 : 0)

  // Live width override for the custom column currently being dragged.
  // Only the actively-resized column lives here; everything else reads the
  // persisted `col.width`. This keeps the drag smooth without touching the DB
  // on every mouse move (persist happens once on drag end).
  const [resizingCol, setResizingCol] = useState<{ id: string; width: number } | null>(null)

  const getColWidth = useCallback(
    (col: CustomColumn) =>
      resizingCol?.id === col.id ? resizingCol.width : (col.width ?? CUSTOM_COL_WIDTH),
    [resizingCol]
  )

  const handleCustomColResize = useCallback(
    (col: CustomColumn) => (delta: number) => {
      setResizingCol((prev) => {
        const base = prev?.id === col.id ? prev.width : (col.width ?? CUSTOM_COL_WIDTH)
        const next = Math.min(MAX_CUSTOM_COL_WIDTH, Math.max(MIN_CUSTOM_COL_WIDTH, base + delta))
        return { id: col.id, width: next }
      })
    },
    []
  )

  const handleCustomColResizeEnd = useCallback(
    (col: CustomColumn) => () => {
      setResizingCol((prev) => {
        if (prev && prev.id === col.id) {
          const finalWidth = Math.round(prev.width)
          if (finalWidth !== (col.width ?? CUSTOM_COL_WIDTH)) {
            updateCustomColumnAsync(col.id, { width: finalWidth }).catch(console.error)
          }
        }
        return null
      })
    },
    [updateCustomColumnAsync]
  )

  // Fast lookup map for custom values: `${columnId}:${rowType}:${rowId}` -> value
  const customValueMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cv of customValues) {
      map.set(`${cv.column_id}:${cv.row_type}:${cv.row_id}`, cv.value)
    }
    return map
  }, [customValues])

  const getCustomValue = useCallback(
    (columnId: string, rowType: CustomRowType, rowId: string) =>
      customValueMap.get(`${columnId}:${rowType}:${rowId}`) ?? '',
    [customValueMap]
  )

  const handleSetCustomValue = useCallback(
    (columnId: string, rowType: CustomRowType, rowId: string, value: string) => {
      setCustomValueAsync(columnId, rowType, rowId, value).catch(console.error)
    },
    [setCustomValueAsync]
  )

  // Bottom-split custom column editor (replaces modal)
  const [editingCustomCell, setEditingCustomCell] = useState<CustomCellEditTarget | null>(null)

  const handleOpenCustomCell = useCallback((target: CustomCellEditTarget) => {
    setEditingCustomCell(target)
  }, [])

  const handleSaveCustomCell = useCallback(
    (value: string) => {
      if (!editingCustomCell) return
      const { column, rowType, rowId } = editingCustomCell
      handleSetCustomValue(column.id, rowType, rowId, value)
      setEditingCustomCell(null)
    },
    [editingCustomCell, handleSetCustomValue]
  )

  const extraColsWidth =
    sortedCustomColumns.reduce((sum, col) => sum + getColWidth(col), 0) +
    (showAddColumn ? ADD_COL_WIDTH : 0)

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [newTaskName, setNewTaskName] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  // The shared scroll region (both axes) that grid + summary live in. The grid
  // header sticks to its top and the frozen columns to its left.
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasInitializedExpand = useRef(false)
  const [showResourceSummary, setShowResourceSummary] = useState(true)

  // Measure the first header row (month/year) of each sticky table so its second
  // (day/week) row can stick *directly* below it. The height is published on the
  // owning <table> element as `--row1-h`, consumed by the sticky thead rules in
  // globals.css. Measuring per-table keeps the main grid and the summary table
  // aligned even when their first rows differ in height.
  const gridHeadRow1Ref = useRef<HTMLTableRowElement>(null)
  const summaryHeadRow1Ref = useRef<HTMLTableRowElement>(null)

  // Per-column filters (empty set = no filter for that column). Custom columns
  // are intentionally not filterable.
  const [taskFilter, setTaskFilter] = useState<Set<string>>(new Set())
  const [resourceFilter, setResourceFilter] = useState<Set<string>>(new Set())
  
  // Time window navigation offset (0 = first window)
  const [timeWindowOffset, setTimeWindowOffset] = useState(0)
  
  // Max allocation per resource name (default 100%)
  const [maxAllocationByResource, setMaxAllocationByResource] = useState<Map<string, number>>(new Map())
  // Min allocation per resource name (default 0%)
  const [minAllocationByResource, setMinAllocationByResource] = useState<Map<string, number>>(new Map())
  
  // Column widths state - start at the desktop defaults (SSR-safe) and adapt to
  // the actual viewport in the effect below.
  const [taskColumnWidth, setTaskColumnWidth] = useState(DEFAULT_TASK_WIDTH)
  const [resourceColumnWidth, setResourceColumnWidth] = useState(DEFAULT_RESOURCE_WIDTH)
  // Once a column was dragged, the user's width wins over the responsive one.
  const hasManualColumnWidth = useRef(false)

  useEffect(() => {
    const applyResponsiveWidths = () => {
      if (hasManualColumnWidth.current) return
      const { task, resource } = responsiveColumnWidths(window.innerWidth)
      setTaskColumnWidth(task)
      setResourceColumnWidth(resource)
    }
    applyResponsiveWidths()
    window.addEventListener('resize', applyResponsiveWidths)
    return () => window.removeEventListener('resize', applyResponsiveWidths)
  }, [])

  // Calculate sticky positions
  const taskColumnLeft = ID_COLUMN_WIDTH
  const resourceColumnLeft = ID_COLUMN_WIDTH + taskColumnWidth

  // Calculate time window boundaries
  const { windowStart, windowEnd, maxOffset } = useMemo(() => {
    if (!project) return { windowStart: new Date(), windowEnd: new Date(), maxOffset: 0 }
    
    const projectStart = parseISO(project.start_date)
    const projectEnd = parseISO(project.end_date)
    const max = calculateMaxOffset(projectStart, projectEnd, project.resolution)
    const { windowStart, windowEnd } = calculateTimeWindow(
      projectStart, 
      projectEnd, 
      project.resolution, 
      timeWindowOffset
    )
    
    return { windowStart, windowEnd, maxOffset: max }
  }, [project, timeWindowOffset])

  // Generate time slots for current window
  const timeSlots = useMemo(() => {
    if (!project) return []
    return generateTimeSlots(
      format(windowStart, 'yyyy-MM-dd'),
      format(windowEnd, 'yyyy-MM-dd'),
      project.resolution
    )
  }, [project, windowStart, windowEnd])

  // Slot keys are the hottest value in the grid - every cell of every row needs
  // one. Deriving them once per window keeps them out of the render path.
  const slotKeys = useMemo(
    () => (project ? buildSlotKeys(timeSlots, project.resolution) : []),
    [timeSlots, project]
  )

  // Navigation handlers
  const canGoBack = timeWindowOffset > 0
  const canGoForward = timeWindowOffset < maxOffset

  const handlePrevWindow = useCallback(() => {
    if (canGoBack) {
      setTimeWindowOffset(prev => prev - 1)
    }
  }, [canGoBack])

  const handleNextWindow = useCallback(() => {
    if (canGoForward) {
      setTimeWindowOffset(prev => prev + 1)
    }
  }, [canGoForward])

  // Reset offset when resolution changes
  useEffect(() => {
    setTimeWindowOffset(0)
  }, [project?.resolution])

  // Group slots by month/year for header
  const slotGroups = useMemo(() => {
    if (!project) return []
    
    const groups: { label: string; slots: Date[] }[] = []
    let currentGroup: { label: string; slots: Date[] } | null = null

    for (const slot of timeSlots) {
      const groupLabel = formatTimeSlotGroup(slot, project.resolution, dateLocale)
      
      if (!currentGroup || currentGroup.label !== groupLabel) {
        if (currentGroup) groups.push(currentGroup)
        currentGroup = { label: groupLabel, slots: [slot] }
      } else {
        currentGroup.slots.push(slot)
      }
    }
    
    if (currentGroup) groups.push(currentGroup)
    return groups
  }, [timeSlots, project, dateLocale])

  // Aggregate resources by name for summary view
  const resourceSummaryByName = useMemo(() => {
    if (!project) return []

    // Collect all resources from root tasks and subtasks
    const allResources = flattenTasksWithChildren(tasksWithData).flatMap(t => t.resources)
    
    // Group by resource name
    const groupedByName = new Map<string, {
      name: string
      allocationsBySlot: Map<string, { total: number; colorData: { color: string; percentage: number }[] }>
      totalEffort: number
      startDate: string | null
      endDate: string | null
    }>()

    for (const resource of allResources) {
      let group = groupedByName.get(resource.name)
      
      if (!group) {
        group = {
          name: resource.name,
          allocationsBySlot: new Map(),
          totalEffort: 0,
          startDate: null,
          endDate: null,
        }
        groupedByName.set(resource.name, group)
      }

      // Add allocations
      for (const allocation of resource.allocations) {
        const slotKey = allocation.date
        const existing = group.allocationsBySlot.get(slotKey)
        
        if (existing) {
          existing.total += allocation.percentage
          existing.colorData.push({ color: allocation.color_hex, percentage: allocation.percentage })
        } else {
          group.allocationsBySlot.set(slotKey, {
            total: allocation.percentage,
            colorData: [{ color: allocation.color_hex, percentage: allocation.percentage }],
          })
        }

        group.totalEffort += allocation.percentage

        // Update start/end dates
        if (!group.startDate || allocation.date < group.startDate) {
          group.startDate = allocation.date
        }
        if (!group.endDate || allocation.date > group.endDate) {
          group.endDate = allocation.date
        }
      }
    }

    const all = Array.from(groupedByName.values()).sort((a, b) => a.name.localeCompare(b.name))
    // Apply resource filter (empty set = show all)
    if (resourceFilter.size === 0) return all
    return all.filter((g) => resourceFilter.has(g.name))
  }, [project, tasksWithData, resourceFilter])

  // The observer itself reacts to height changes, so this only needs to re-run
  // when a header row is (un)mounted - not on every data change.
  const hasSummaryRows = resourceSummaryByName.length > 0
  useEffect(() => {
    const rows = [gridHeadRow1Ref.current, summaryHeadRow1Ref.current].filter(
      (r): r is HTMLTableRowElement => r != null
    )
    if (rows.length === 0) return
    const observers: ResizeObserver[] = []
    for (const row of rows) {
      const table = row.closest('table') as HTMLElement | null
      if (!table) continue
      const update = () =>
        table.style.setProperty(
          '--row1-h',
          `${Math.round(row.getBoundingClientRect().height)}px`
        )
      update()
      const ro = new ResizeObserver(update)
      ro.observe(row)
      observers.push(ro)
    }
    return () => observers.forEach((o) => o.disconnect())
  }, [projectId, showResourceSummary, hasSummaryRows])

  // Slot key of "today" - used to highlight the current time column
  const currentSlotKey = useMemo(
    () => (project ? dateToSlotKey(new Date(), project.resolution) : ''),
    [project]
  )

  // Distinct values per filterable (standard) column - populate the dropdowns.
  const filterValues = useMemo(() => {
    const tasks = new Set<string>()
    const resources = new Set<string>()
    for (const task of flattenTasksWithChildren(tasksWithData)) {
      tasks.add(task.name)
      for (const r of task.resources) {
        resources.add(r.name)
      }
    }
    const byStr = (a: string, b: string) => a.localeCompare(b)
    return {
      task: Array.from(tasks).sort(byStr),
      resource: Array.from(resources).sort(byStr),
    }
  }, [tasksWithData])

  const anyResourceLevelFilter = resourceFilter.size > 0

  // Tasks with all active column filters applied. Resource-level filters reduce
  // each task's resources (aggregates recomputed); tasks without any remaining
  // resource - or not matching the task filter - are hidden.
  // Parent matches if itself or any child matches the task name filter.
  const filteredTasks = useMemo(() => {
    if (taskFilter.size === 0 && !anyResourceLevelFilter) return tasksWithData

    const applyResourceFilter = (task: TaskWithAggregation): TaskWithAggregation | null => {
      if (!anyResourceLevelFilter) return task
      const resources = task.resources.filter((r) => resourceFilter.has(r.name))
      if (resources.length === 0 && task.children.length === 0) return null
      const filteredChildren: TaskWithAggregation[] = []
      for (const child of task.children) {
        const childResources = child.resources.filter((r) => resourceFilter.has(r.name))
        if (childResources.length === 0) continue
        filteredChildren.push({
          ...child,
          resources: childResources,
          children: [],
          computed: computeTaskAggregation(childResources),
        })
      }

      if (resources.length === 0 && filteredChildren.length === 0) return null

      let computed = computeTaskAggregation(resources)
      for (const child of filteredChildren) {
        computed = mergeTaskComputed(computed, child.computed)
      }
      return { ...task, resources, children: filteredChildren, computed }
    }

    const result: TaskWithAggregation[] = []
    for (const task of tasksWithData) {
      const selfMatch = taskFilter.size === 0 || taskFilter.has(task.name)
      const matchingChildren =
        taskFilter.size === 0
          ? task.children
          : task.children.filter((c) => taskFilter.has(c.name))

      if (!selfMatch && matchingChildren.length === 0) continue

      const scoped: TaskWithAggregation =
        selfMatch
          ? task
          : {
              ...task,
              children: matchingChildren,
              // Parent row still shown as container; rollup from matching children (+ own resources)
              computed: matchingChildren.reduce(
                (acc, c) => mergeTaskComputed(acc, c.computed),
                computeTaskAggregation(task.resources)
              ),
            }

      const filtered = applyResourceFilter(scoped)
      if (filtered) result.push(filtered)
    }
    return result
  }, [tasksWithData, taskFilter, resourceFilter, anyResourceLevelFilter])

  // Handle column resize
  const handleTaskColumnResize = useCallback((delta: number) => {
    hasManualColumnWidth.current = true
    setTaskColumnWidth(w => Math.max(MIN_TASK_WIDTH, w + delta))
  }, [])

  const handleResourceColumnResize = useCallback((delta: number) => {
    hasManualColumnWidth.current = true
    setResourceColumnWidth(w => Math.max(MIN_RESOURCE_WIDTH, w + delta))
  }, [])

  // Toggle task expansion
  const toggleTask = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }, [])

  const allExpandableIds = useMemo(
    () => flattenTasksWithChildren(tasksWithData).map(t => t.id),
    [tasksWithData]
  )

  // Expand all tasks (roots + subtasks)
  const expandAll = useCallback(() => {
    setExpandedTasks(new Set(allExpandableIds))
  }, [allExpandableIds])

  // Collapse all tasks
  const collapseAll = useCallback(() => {
    setExpandedTasks(new Set())
  }, [])

  // Drop ids of deleted tasks so the expand/collapse state stays truthful
  useEffect(() => {
    setExpandedTasks(prev => {
      if (prev.size === 0) return prev
      const valid = new Set(allExpandableIds)
      const next = new Set<string>()
      for (const id of prev) {
        if (valid.has(id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [allExpandableIds])

  // Check if all are expanded or collapsed
  const allExpanded =
    allExpandableIds.length > 0 && allExpandableIds.every(id => expandedTasks.has(id))
  const allCollapsed = expandedTasks.size === 0

  // Track last clicked cell to detect double-click on same cell
  const lastClickedCell = useRef<{ resourceId: string; slotKey: string } | null>(null)

  // Painting reads the live store instead of closing over it, so the handlers
  // keep a stable identity while dragging across cells. Otherwise every painted
  // cell would hand new callbacks to all rows and defeat their memoization.
  const handleCellClick = useCallback((resourceId: string, slotKey: string) => {
    const store = useProjectStore.getState()
    const { project, activeBrush, tasksWithData } = store
    if (!project || !selectCanEdit(store)) return

    const resource = findResourceInTree(tasksWithData, resourceId)
    const existingAllocation = resource?.allocationMap.get(slotKey)
    const isSameCell = lastClickedCell.current?.resourceId === resourceId && 
                       lastClickedCell.current?.slotKey === slotKey

    const remove = () => {
      store.removeAllocation(resourceId, slotKey)
      store.removeAllocationAsync(resourceId, slotKey).catch(console.error)
    }
    const paint = () => {
      store.setAllocation(resourceId, slotKey, activeBrush.percentage, activeBrush.colorHex)
      store
        .setAllocationAsync(resourceId, slotKey, activeBrush.percentage, activeBrush.colorHex)
        .catch(console.error)
    }

    if (!existingAllocation) {
      // Empty cell -> set brush value
      paint()
      lastClickedCell.current = { resourceId, slotKey }
      return
    }

    if (isSameCell) {
      // Second click on same cell -> delete
      remove()
      lastClickedCell.current = null
      return
    }

    if (
      existingAllocation.percentage === activeBrush.percentage &&
      existingAllocation.color_hex === activeBrush.colorHex
    ) {
      // Same value as brush -> delete
      remove()
    } else {
      // Different value -> replace with brush
      paint()
    }
    lastClickedCell.current = { resourceId, slotKey }
  }, [])

  // Handle mouse events for painting. Rows delegate `mouseover`, which can fire
  // several times within one cell, so the last painted cell is tracked to keep a
  // drag from toggling the same cell twice.
  const lastPaintedCell = useRef<string | null>(null)

  const handleMouseDown = useCallback((resourceId: string, slotKey: string) => {
    const store = useProjectStore.getState()
    if (!selectCanEdit(store)) return
    lastPaintedCell.current = `${resourceId}|${slotKey}`
    store.setIsPainting(true)
    handleCellClick(resourceId, slotKey)
  }, [handleCellClick])

  const handleMouseEnter = useCallback((resourceId: string, slotKey: string) => {
    if (!useProjectStore.getState().isPainting) return
    const cell = `${resourceId}|${slotKey}`
    if (lastPaintedCell.current === cell) return
    lastPaintedCell.current = cell
    handleCellClick(resourceId, slotKey)
  }, [handleCellClick])

  const handleMouseUp = useCallback(() => {
    useProjectStore.getState().setIsPainting(false)
  }, [])

  // Calculate fixed columns width (before time slots) - includes custom columns
  const fixedColumnsWidth = ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth + START_COLUMN_WIDTH + END_COLUMN_WIDTH + SUM_COLUMN_WIDTH + extraColsWidth

  const handleGridMouseLeave = useCallback(() => {
    useProjectStore.getState().setIsPainting(false)
  }, [])

  // Add new root task (with async persistence)
  const handleAddTask = async () => {
    if (!newTaskName.trim() || !project || !hasEditPermission) return
    
    const newDisplayId = generateNextDisplayId(tasksWithData.map(t => t.display_id))
    const taskName = newTaskName.trim()
    setNewTaskName('')
    
    try {
      const newTask = await createTaskAsync(project.id, newDisplayId, taskName)
      // Auto-expand new task
      setExpandedTasks(prev => new Set([...prev, newTask.id]))
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  // Add subtask under a root task
  const handleAddSubtask = useCallback(async (parentId: string, name: string) => {
    const store = useProjectStore.getState()
    if (!name.trim() || !store.project || !selectCanEdit(store)) return

    const parent = store.tasksWithData.find(t => t.id === parentId)
    if (!parent) return

    const displayId = generateNextSubtaskDisplayId(
      parent.display_id,
      parent.children.map(c => c.display_id)
    )

    try {
      const newTask = await store.createTaskAsync(store.project.id, displayId, name.trim(), parentId)
      setExpandedTasks(prev => new Set([...prev, parentId, newTask.id]))
    } catch (error) {
      console.error('Failed to create subtask:', error)
    }
  }, [])

  // Tab: make the task a subtask of the root task above it
  const handleIndentTask = useCallback(async (taskId: string) => {
    const { tasksWithData: tasks, moveTaskAsync: move } = useProjectStore.getState()
    const index = tasks.findIndex(t => t.id === taskId)
    if (index < 1) return // subtask, unknown, or no preceding sibling
    if (tasks[index].children.length > 0) return // only one nesting level

    const previous = tasks[index - 1]
    const moved = await move(taskId, previous.id)
    if (moved) {
      setExpandedTasks(prev => new Set([...prev, previous.id]))
    }
  }, [])

  // Shift+Tab: lift a subtask back to root level
  const handleOutdentTask = useCallback(async (taskId: string) => {
    const { tasksWithData: tasks, moveTaskAsync: move } = useProjectStore.getState()
    const isSubtask = tasks.some(root => root.children.some(c => c.id === taskId))
    if (!isSubtask) return
    await move(taskId, null)
  }, [])

  // Add new resource to task (with async persistence)
  const handleAddResource = useCallback(async (taskId: string, name: string) => {
    const store = useProjectStore.getState()
    if (!name.trim() || !selectCanEdit(store)) return

    try {
      await store.createResourceAsync(taskId, name.trim())
    } catch (error) {
      console.error('Failed to create resource:', error)
    }
  }, [])

  // Add new custom column
  const handleAddColumn = async () => {
    if (!project || !hasEditPermission) return
    try {
      await createCustomColumnAsync(project.id, t('customColumns', 'newColumnName'))
    } catch (error) {
      console.error('Failed to create custom column:', error)
    }
  }

  // Min/max thresholds are keyed by resource name, so one stable handler pair
  // serves every summary row.
  const handleMinAllocationChange = useCallback((name: string, value: number) => {
    setMinAllocationByResource(prev => new Map(prev).set(name, value))
  }, [])

  const handleMaxAllocationChange = useCallback((name: string, value: number) => {
    setMaxAllocationByResource(prev => new Map(prev).set(name, value))
  }, [])

  // Row mutation handlers - kept stable so memoized rows only re-render when
  // their own data changes.
  const handleUpdateTask = useCallback(
    (id: string, updates: Partial<TaskWithAggregation>) => {
      updateTask(id, updates)
      updateTaskAsync(id, updates).catch(console.error)
    },
    [updateTask, updateTaskAsync]
  )

  const handleUpdateResource = useCallback(
    (id: string, updates: Partial<ResourceWithAllocations>) => {
      updateResource(id, updates)
      updateResourceAsync(id, updates).catch(console.error)
    },
    [updateResource, updateResourceAsync]
  )

  const handleDeleteTask = useCallback(
    (id: string) => {
      deleteTaskAsync(id).catch(console.error)
    },
    [deleteTaskAsync]
  )

  const handleDeleteResource = useCallback(
    (id: string) => {
      deleteResourceAsync(id).catch(console.error)
    },
    [deleteResourceAsync]
  )

  // On first load: expand leaf roots (show resources); keep parents with subtasks collapsed
  useEffect(() => {
    if (!hasInitializedExpand.current && tasksWithData.length > 0) {
      setExpandedTasks(
        new Set(tasksWithData.filter(t => t.children.length === 0).map(t => t.id))
      )
      hasInitializedExpand.current = true
    }
  }, [tasksWithData])

  if (!project) return null

  const stepLabel = t('grid', TIME_WINDOW_CONFIG[project.resolution].stepLabelKey)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Cursor Follower - brush preview only when editing is allowed */}
      {hasEditPermission && (
        <BrushCursor scrollRef={scrollRef} fixedColumnsWidth={fixedColumnsWidth} />
      )}
      
      <div ref={scrollRef} className="planvas-scroll flex-1 min-h-0 overflow-auto">
      <div 
        ref={gridRef}
        className="paper-card planvas-grid-card"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleGridMouseLeave}
      >
        {/* 
          Table uses full width with minimum based on content.
          Fixed columns (ID, Task, Resource, Start, End, Σ) have explicit widths.
          Time slots share remaining space evenly.
          `planvas-sticky-head` enables the sticky (top) column header.
        */}
        <table 
          className="planvas-sticky-head w-full"
          style={{ 
            tableLayout: 'fixed',
            minWidth: ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth + START_COLUMN_WIDTH + END_COLUMN_WIDTH + SUM_COLUMN_WIDTH + extraColsWidth + (timeSlots.length * MIN_SLOT_WIDTH)
          }}
        >
          {/* Colgroup for column widths */}
          <colgroup>
            <col style={{ width: ID_COLUMN_WIDTH }} />
            <col style={{ width: taskColumnWidth }} />
            <col style={{ width: resourceColumnWidth }} />
            <col style={{ width: START_COLUMN_WIDTH }} />
            <col style={{ width: END_COLUMN_WIDTH }} />
            <col style={{ width: SUM_COLUMN_WIDTH }} />
            {/* Custom columns */}
            {sortedCustomColumns.map((col) => (
              <col key={col.id} style={{ width: getColWidth(col) }} />
            ))}
            {showAddColumn && <col style={{ width: ADD_COL_WIDTH }} />}
            {/* Time slots: fill remaining space evenly (no fixed width) */}
            {timeSlots.map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>

          {/* Header */}
          <thead>
            {/* Month/Year row */}
            <tr ref={gridHeadRow1Ref} className="border-b border-paper-lines">
              <th 
                className="sticky bg-paper-cream z-30 border-r border-paper-lines"
                style={{ left: 0, width: ID_COLUMN_WIDTH }}
              />
              <th 
                className="sticky bg-paper-cream z-30 border-r border-paper-lines text-left px-3 py-2 relative"
                style={{ left: taskColumnLeft, width: taskColumnWidth }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-hand text-ink-light">{t('grid', 'task')}</span>
                  <ColumnFilter
                    title={t('grid', 'task')}
                    values={filterValues.task}
                    selected={taskFilter}
                    onChange={setTaskFilter}
                  />
                  <div className="flex items-center gap-1 ml-auto mr-2">
                    <button
                      onClick={expandAll}
                      disabled={allExpanded}
                      className={cn(
                        'p-1 rounded transition-colors',
                        allExpanded 
                          ? 'text-ink-faded/40 cursor-not-allowed' 
                          : 'text-ink-faded hover:text-ink hover:bg-paper-warm'
                      )}
                      title={t('grid', 'expandAll')}
                      aria-label={t('grid', 'expandAll')}
                    >
                      <ChevronsUpDown size={14} />
                    </button>
                    <button
                      onClick={collapseAll}
                      disabled={allCollapsed}
                      className={cn(
                        'p-1 rounded transition-colors',
                        allCollapsed 
                          ? 'text-ink-faded/40 cursor-not-allowed' 
                          : 'text-ink-faded hover:text-ink hover:bg-paper-warm'
                      )}
                      title={t('grid', 'collapseAll')}
                      aria-label={t('grid', 'collapseAll')}
                    >
                      <ChevronsDownUp size={14} />
                    </button>
                  </div>
                </div>
                <ColumnResizer onResize={handleTaskColumnResize} />
              </th>
              <th 
                className="planvas-freeze-edge sticky bg-paper-cream z-30 border-r border-paper-lines text-left px-3 py-2 relative"
                style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-hand text-ink-light">{t('grid', 'resource')}</span>
                  <ColumnFilter
                    title={t('grid', 'resource')}
                    values={filterValues.resource}
                    selected={resourceFilter}
                    onChange={setResourceFilter}
                  />
                </div>
                <ColumnResizer onResize={handleResourceColumnResize} />
              </th>
              <th className="bg-paper-cream z-10 border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap">
                <span className="font-hand text-xs text-ink-faded">{t('grid', 'start')}</span>
              </th>
              <th className="bg-paper-cream z-10 border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap">
                <span className="font-hand text-xs text-ink-faded">{t('grid', 'end')}</span>
              </th>
              <th className="bg-paper-cream z-10 border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap">
                <span className="font-hand text-xs text-ink-faded">{t('grid', 'total')}</span>
              </th>

              {/* Custom column headers */}
              {sortedCustomColumns.map((col) => (
                <CustomColumnHeaderCell
                  key={col.id}
                  column={col}
                  canEdit={hasEditPermission}
                  width={getColWidth(col)}
                  onRename={(name) => updateCustomColumnAsync(col.id, { name }).catch(console.error)}
                  onDelete={() => deleteCustomColumnAsync(col.id).catch(console.error)}
                  resizer={
                    hasEditPermission ? (
                      <ColumnResizer
                        onResize={handleCustomColResize(col)}
                        onResizeEnd={handleCustomColResizeEnd(col)}
                      />
                    ) : undefined
                  }
                />
              ))}
              {showAddColumn && <AddColumnHeader width={ADD_COL_WIDTH} onAdd={handleAddColumn} />}
              
              {/* Time slots grouped by month/year with navigation */}
              {slotGroups.map((group, groupIndex) => (
                <th 
                  key={groupIndex}
                  colSpan={group.slots.length}
                  className="bg-paper-cream z-10 text-left px-1 py-1 border-l border-paper-lines overflow-hidden"
                >
                  <div className="flex items-center gap-1">
                    {/* Navigation Back - only on first group */}
                    {groupIndex === 0 && (
                      <button
                        onClick={handlePrevWindow}
                        disabled={!canGoBack}
                        className={cn(
                          'p-0.5 rounded transition-colors flex-shrink-0',
                          canGoBack 
                            ? 'text-ink hover:bg-paper-warm' 
                            : 'text-ink-faded/30 cursor-not-allowed'
                        )}
                        title={canGoBack ? `${t('grid', 'backTime')} (${stepLabel})` : t('grid', 'atStart')}
                      >
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    
                    <span className="font-hand text-xs text-ink-light flex-1 min-w-0 truncate">
                      {group.label}
                    </span>
                    
                    {/* Navigation Forward - only on last group */}
                    {groupIndex === slotGroups.length - 1 && (
                      <button
                        onClick={handleNextWindow}
                        disabled={!canGoForward}
                        className={cn(
                          'p-0.5 rounded transition-colors flex-shrink-0',
                          canGoForward 
                            ? 'text-ink hover:bg-paper-warm' 
                            : 'text-ink-faded/30 cursor-not-allowed'
                        )}
                        title={canGoForward ? `${t('grid', 'forwardTime')} (${stepLabel})` : t('grid', 'atEnd')}
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            
            {/* Day/Week numbers row */}
            <tr className="border-b-2 border-paper-lines">
              <th 
                className="sticky bg-paper-cream z-30 border-r border-paper-lines"
                style={{ left: 0, width: ID_COLUMN_WIDTH }}
              />
              <th 
                className="sticky bg-paper-cream z-30 border-r border-paper-lines"
                style={{ left: taskColumnLeft, width: taskColumnWidth }}
              />
              <th 
                className="planvas-freeze-edge sticky bg-paper-cream z-30 border-r border-paper-lines"
                style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
              />
              <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
              <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
              <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>

              {/* Custom columns (empty sub-header) */}
              {sortedCustomColumns.map((col) => (
                <th key={col.id} className="bg-paper-cream z-10 border-r border-paper-lines"></th>
              ))}
              {showAddColumn && <th className="bg-paper-cream z-10 border-l border-paper-lines"></th>}
              
              {timeSlots.map((slot, i) => (
                <th 
                  key={i}
                  className={cn(
                    'time-slot-header bg-paper-cream z-10',
                    slotKeys[i] === currentSlotKey && 'time-slot-current'
                  )}
                >
                  <div className="time-slot-label">
                    <span>{formatTimeSlotHeader(slot, project.resolution, dateLocale, language)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredTasks.map((task) => (
              <TaskRows
                key={task.id}
                task={task}
                isExpanded={expandedTasks.has(task.id)}
                expandedTaskIds={expandedTasks}
                onToggleTask={toggleTask}
                slotKeys={slotKeys}
                currentSlotKey={currentSlotKey}
                onCellMouseDown={handleMouseDown}
                onCellMouseEnter={handleMouseEnter}
                onAddResource={handleAddResource}
                onAddSubtask={handleAddSubtask}
                onIndentTask={handleIndentTask}
                onOutdentTask={handleOutdentTask}
                onUpdateTask={handleUpdateTask}
                onUpdateResource={handleUpdateResource}
                onDeleteTask={handleDeleteTask}
                onDeleteResource={handleDeleteResource}
                taskColumnLeft={taskColumnLeft}
                taskColumnWidth={taskColumnWidth}
                resourceColumnLeft={resourceColumnLeft}
                resourceColumnWidth={resourceColumnWidth}
                canEdit={hasEditPermission}
                customColumns={sortedCustomColumns}
                showAddColumn={showAddColumn}
                getCustomValue={getCustomValue}
                onOpenCustomCell={handleOpenCustomCell}
              />
            ))}
            
            {/* New Task Row - only show if user can edit */}
            {hasEditPermission && (
              <tr className="planvas-row-top hover:bg-paper-warm/50">
                <td 
                  className="sticky bg-surface z-20 border-r border-paper-lines"
                  style={{ left: 0, width: ID_COLUMN_WIDTH }}
                />
                <td 
                  colSpan={2}
                  className="planvas-freeze-edge sticky bg-surface z-20 border-r border-paper-lines px-3 py-2"
                  style={{ left: taskColumnLeft }}
                >
                  <div className="flex items-center gap-2">
                    <Plus size={14} className="text-ink-faded flex-shrink-0" />
                    <input
                      type="text"
                      value={newTaskName}
                      onChange={e => setNewTaskName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTask()
                        if (e.key === 'Escape') setNewTaskName('')
                      }}
                      placeholder={t('grid', 'newTask')}
                      className="input-notebook text-sm italic min-w-0 flex-1"
                    />
                    {newTaskName.trim() && (
                      <InlineAddConfirm
                        onSubmit={handleAddTask}
                        label={t('grid', 'pressEnterToAdd')}
                      />
                    )}
                  </div>
                </td>
                <td colSpan={3 + extraColCount} className="border-r border-paper-lines"></td>
                {slotKeys.map((slotKey, i) => (
                  <td
                    key={i}
                    className={cn('time-slot-cell p-0', slotKey === currentSlotKey && 'time-slot-current')}
                  />
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

    {/* Resource Summary Section */}
    {resourceSummaryByName.length > 0 && (
      <div className="paper-card planvas-grid-card">
        <div 
          className="flex items-center justify-between px-4 py-2 bg-paper-warm/50 border-b border-paper-lines cursor-pointer"
          onClick={() => setShowResourceSummary(!showResourceSummary)}
        >
          <div className="flex items-center gap-2">
            <ChevronRight 
              size={16} 
              className={cn(
                'text-ink-light transition-transform',
                showResourceSummary && 'rotate-90'
              )} 
            />
            <span className="font-hand text-ink font-medium">{t('grid', 'resourceSummary')}</span>
            <span className="text-xs text-ink-faded">({resourceSummaryByName.length} {t('grid', 'resources')})</span>
          </div>
        </div>
        
        {showResourceSummary && (
          <div>
            <table 
              className="planvas-sticky-head w-full"
              style={{ 
                tableLayout: 'fixed',
                minWidth: ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth + START_COLUMN_WIDTH + END_COLUMN_WIDTH + SUM_COLUMN_WIDTH + extraColsWidth + (timeSlots.length * MIN_SLOT_WIDTH)
              }}
            >
              {/* Colgroup must match main table exactly for column alignment.
                  Custom columns + the add-column control are mirrored as empty
                  placeholder columns so the time slots stay flush with the table above. */}
              <colgroup>
                <col style={{ width: ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth - MIN_ALLOCATION_WIDTH - MAX_ALLOCATION_WIDTH }} />
                <col style={{ width: MIN_ALLOCATION_WIDTH }} />
                <col style={{ width: MAX_ALLOCATION_WIDTH }} />
                <col style={{ width: START_COLUMN_WIDTH }} />
                <col style={{ width: END_COLUMN_WIDTH }} />
                <col style={{ width: SUM_COLUMN_WIDTH }} />
                {/* Placeholder columns mirroring the main table's custom columns */}
                {sortedCustomColumns.map((col) => (
                  <col key={col.id} style={{ width: getColWidth(col) }} />
                ))}
                {showAddColumn && <col style={{ width: ADD_COL_WIDTH }} />}
                {timeSlots.map((_, i) => (
                  <col key={i} />
                ))}
              </colgroup>

              <thead>
                <tr ref={summaryHeadRow1Ref} className="border-b border-paper-lines">
                  <th 
                    className="planvas-freeze-edge sticky bg-paper-cream z-30 border-r border-paper-lines text-left px-3 py-2"
                    style={{ left: 0 }}
                  >
                    <span className="font-hand text-ink-light">{t('grid', 'resourceSum')}</span>
                  </th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines text-center px-2 py-2">
                    <span className="font-hand text-xs text-ink-faded">{t('grid', 'minPercent')}</span>
                  </th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines text-center px-2 py-2">
                    <span className="font-hand text-xs text-ink-faded">{t('grid', 'maxPercent')}</span>
                  </th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines text-center px-2 py-2">
                    <span className="font-hand text-xs text-ink-faded">{t('grid', 'start')}</span>
                  </th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines text-center px-2 py-2">
                    <span className="font-hand text-xs text-ink-faded">{t('grid', 'end')}</span>
                  </th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines text-center px-2 py-2">
                    <span className="font-hand text-xs text-ink-faded">{t('grid', 'total')}</span>
                  </th>
                  {/* Empty placeholder headers to mirror custom columns of the table above */}
                  {sortedCustomColumns.map((col) => (
                    <th key={col.id} className="bg-paper-cream z-10 border-r border-paper-lines" />
                  ))}
                  {showAddColumn && <th className="bg-paper-cream z-10 border-l border-paper-lines" />}
                  {/* Time slots grouped by month/year with navigation */}
                  {slotGroups.map((group, groupIndex) => (
                    <th 
                      key={groupIndex}
                      colSpan={group.slots.length}
                      className="bg-paper-cream z-10 text-left px-1 py-1 border-l border-paper-lines overflow-hidden"
                    >
                      <div className="flex items-center gap-1">
                        {/* Navigation Back - only on first group */}
                        {groupIndex === 0 && (
                          <button
                            onClick={handlePrevWindow}
                            disabled={!canGoBack}
                            className={cn(
                              'p-0.5 rounded transition-colors flex-shrink-0',
                              canGoBack 
                                ? 'text-ink hover:bg-paper-warm' 
                                : 'text-ink-faded/30 cursor-not-allowed'
                            )}
                            title={canGoBack ? `${t('grid', 'backTime')} (${stepLabel})` : t('grid', 'atStart')}
                          >
                            <ChevronLeft size={14} />
                          </button>
                        )}
                        
                        <span className="font-hand text-xs text-ink-light flex-1 min-w-0 truncate">
                          {group.label}
                        </span>
                        
                        {/* Navigation Forward - only on last group */}
                        {groupIndex === slotGroups.length - 1 && (
                          <button
                            onClick={handleNextWindow}
                            disabled={!canGoForward}
                            className={cn(
                              'p-0.5 rounded transition-colors flex-shrink-0',
                              canGoForward 
                                ? 'text-ink hover:bg-paper-warm' 
                                : 'text-ink-faded/30 cursor-not-allowed'
                            )}
                            title={canGoForward ? `${t('grid', 'forwardTime')} (${stepLabel})` : t('grid', 'atEnd')}
                          >
                            <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b-2 border-paper-lines">
                  <th 
                    className="planvas-freeze-edge sticky bg-paper-cream z-30 border-r border-paper-lines"
                    style={{ left: 0 }}
                  />
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  {/* Empty placeholder sub-headers mirroring custom columns */}
                  {sortedCustomColumns.map((col) => (
                    <th key={col.id} className="bg-paper-cream z-10 border-r border-paper-lines" />
                  ))}
                  {showAddColumn && <th className="bg-paper-cream z-10 border-l border-paper-lines" />}
                  {timeSlots.map((slot, i) => (
                    <th 
                      key={i}
                      className={cn(
                        'time-slot-header bg-paper-cream z-10',
                        slotKeys[i] === currentSlotKey && 'time-slot-current'
                      )}
                    >
                      <div className="time-slot-label">
                        <span>{formatTimeSlotHeader(slot, project.resolution, dateLocale, language)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {resourceSummaryByName.map((summary) => (
                  <ResourceSummaryRow
                    key={summary.name}
                    summary={summary}
                    slotKeys={slotKeys}
                    currentSlotKey={currentSlotKey}
                    customColumns={sortedCustomColumns}
                    showAddColumn={showAddColumn}
                    summaryColumnWidth={ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth - MIN_ALLOCATION_WIDTH - MAX_ALLOCATION_WIDTH}
                    minAllocation={minAllocationByResource.get(summary.name) ?? 0}
                    maxAllocation={maxAllocationByResource.get(summary.name) ?? 100}
                    onMinAllocationChange={handleMinAllocationChange}
                    onMaxAllocationChange={handleMaxAllocationChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}
      </div>

      {editingCustomCell && (
        <CustomValueEditor
          columnName={editingCustomCell.column.name}
          initialValue={editingCustomCell.value}
          canEdit={editingCustomCell.canEdit}
          onCancel={() => setEditingCustomCell(null)}
          onSave={handleSaveCustomCell}
        />
      )}
    </div>
  )
}

// ==================== Brush Cursor ====================

/**
 * Brush preview that follows the pointer over the paint area.
 *
 * Deliberately bypasses React state: routing `mousemove` through `useState`
 * re-rendered the entire grid on every pointer movement. Position and
 * visibility are written straight to the node inside one animation frame, so
 * the whole interaction stays off the reconciler.
 */
function BrushCursor({
  scrollRef,
  fixedColumnsWidth,
}: {
  scrollRef: React.RefObject<HTMLDivElement>
  fixedColumnsWidth: number
}) {
  const activeBrush = useProjectStore((s) => s.activeBrush)
  const elRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(fixedColumnsWidth)
  widthRef.current = fixedColumnsWidth

  useEffect(() => {
    const container = scrollRef.current
    const el = elRef.current
    if (!container || !el) return

    let frame = 0
    let clientX = 0
    let clientY = 0
    let inside = false

    // Single read-then-write per frame keeps this out of layout thrashing.
    const paint = () => {
      frame = 0
      const overPaintArea =
        inside &&
        clientX - container.getBoundingClientRect().left + container.scrollLeft >=
          widthRef.current
      el.style.transform = `translate3d(${clientX + 16}px, ${clientY + 16}px, 0)`
      el.style.opacity = overPaintArea ? '1' : '0'
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }

    const handleMove = (e: MouseEvent) => {
      clientX = e.clientX
      clientY = e.clientY
      inside = true
      schedule()
    }

    const handleLeave = () => {
      inside = false
      schedule()
    }

    container.addEventListener('mousemove', handleMove, { passive: true })
    container.addEventListener('mouseleave', handleLeave)

    return () => {
      container.removeEventListener('mousemove', handleMove)
      container.removeEventListener('mouseleave', handleLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scrollRef])

  return (
    <div
      ref={elRef}
      aria-hidden
      className="fixed left-0 top-0 pointer-events-none z-50 flex items-center gap-1.5 opacity-0"
    >
      <div
        className="w-5 h-5 rounded shadow-md border border-white/50"
        style={{
          backgroundColor: activeBrush.colorHex,
          opacity: percentageToOpacity(activeBrush.percentage),
        }}
      />
      <span className="text-xs font-mono bg-surface/90 px-1.5 py-0.5 rounded shadow-sm text-ink-light">
        {activeBrush.percentage}%
      </span>
    </div>
  )
}

// ==================== Inline Add Helpers ====================

/**
 * Commit affordance for the inline "add" inputs. Creating a record always
 * requires an explicit confirmation (Enter or this button) - clicking away
 * never creates anything, it only keeps the typed draft.
 */
function InlineAddConfirm({ onSubmit, label }: { onSubmit: () => void; label: string }) {
  return (
    <button
      type="button"
      // Prevents the input from losing focus before the click is handled
      onMouseDown={e => e.preventDefault()}
      onClick={onSubmit}
      className="p-0.5 rounded text-ink-faded hover:text-ink hover:bg-paper-lines transition-colors flex-shrink-0"
      title={label}
      aria-label={label}
    >
      <CornerDownLeft size={12} />
    </button>
  )
}

// ==================== Task Rows Component ====================

interface TaskRowsProps {
  task: TaskWithAggregation
  isExpanded: boolean
  expandedTaskIds: Set<string>
  onToggleTask: (taskId: string) => void
  /** Pre-computed slot key per visible column (shared by all rows). */
  slotKeys: string[]
  currentSlotKey: string
  onCellMouseDown: (resourceId: string, slotKey: string) => void
  onCellMouseEnter: (resourceId: string, slotKey: string) => void
  onAddResource: (taskId: string, name: string) => void
  onAddSubtask: (parentId: string, name: string) => void
  onIndentTask: (taskId: string) => void
  onOutdentTask: (taskId: string) => void
  onUpdateTask: (id: string, updates: Partial<TaskWithAggregation>) => void
  onUpdateResource: (id: string, updates: Partial<ResourceWithAllocations>) => void
  onDeleteTask: (id: string) => void
  onDeleteResource: (id: string) => void
  taskColumnLeft: number
  taskColumnWidth: number
  resourceColumnLeft: number
  resourceColumnWidth: number
  canEdit: boolean
  customColumns: CustomColumn[]
  showAddColumn: boolean
  getCustomValue: (columnId: string, rowType: CustomRowType, rowId: string) => string
  onOpenCustomCell: (target: CustomCellEditTarget) => void
  /** When true, render as nested subtask row (no further nesting). */
  isSubtask?: boolean
}

function TaskRowsComponent({
  task,
  isExpanded,
  expandedTaskIds,
  onToggleTask,
  slotKeys,
  currentSlotKey,
  onCellMouseDown,
  onCellMouseEnter,
  onAddResource,
  onAddSubtask,
  onIndentTask,
  onOutdentTask,
  onUpdateTask,
  onUpdateResource,
  onDeleteTask,
  onDeleteResource,
  taskColumnLeft,
  taskColumnWidth,
  resourceColumnLeft,
  resourceColumnWidth,
  canEdit,
  customColumns,
  showAddColumn,
  getCustomValue,
  onOpenCustomCell,
  isSubtask = false,
}: TaskRowsProps) {
  const { t } = useTranslation()
  const extraColCount = customColumns.length + (showAddColumn ? 1 : 0)
  const [newResourceName, setNewResourceName] = useState('')
  const [newSubtaskName, setNewSubtaskName] = useState('')
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  const [editingTaskName, setEditingTaskName] = useState(false)
  const [editingDisplayId, setEditingDisplayId] = useState(false)
  const [taskName, setTaskName] = useState(task.name)
  const [displayId, setDisplayId] = useState(task.display_id)

  const hasChildren = !isSubtask && task.children.length > 0
  // Task rows share the warm band; nesting is carried by indent guide + weight,
  // resources stay on the plain surface. Sticky cells must be fully opaque.
  const rowBg = 'bg-paper-warm'
  const rowBgSoft = isSubtask ? 'bg-paper-warm/20' : 'bg-paper-warm/30'

  // Aggregate allocation data: own resources + (for parents) children resources
  const taskAllocationBySlot = useMemo(() => {
    const map = new Map<string, { total: number; colorData: { color: string; percentage: number }[]; mixedColor: string }>()
    const resources = [
      ...task.resources,
      ...(!isSubtask ? task.children.flatMap(c => c.resources) : []),
    ]

    for (const resource of resources) {
      for (const [date, alloc] of resource.allocationMap) {
        const existing = map.get(date)
        if (existing) {
          existing.total += alloc.percentage
          existing.colorData.push({ color: alloc.color_hex, percentage: alloc.percentage })
        } else {
          map.set(date, {
            total: alloc.percentage,
            colorData: [{ color: alloc.color_hex, percentage: alloc.percentage }],
            mixedColor: '',
          })
        }
      }
    }

    for (const [, data] of map) {
      data.mixedColor = mixAllocationColors(data.colorData)
    }

    return map
  }, [task.resources, task.children, isSubtask])

  // Adopt remote changes, but never yank the text out from under an active edit
  useEffect(() => {
    if (!editingTaskName) setTaskName(task.name)
  }, [task.name, editingTaskName])

  useEffect(() => {
    if (!editingDisplayId) setDisplayId(task.display_id)
  }, [task.display_id, editingDisplayId])

  const handleSaveTaskName = () => {
    if (taskName.trim() && taskName !== task.name) {
      onUpdateTask(task.id, { name: taskName.trim() })
    } else {
      setTaskName(task.name)
    }
    setEditingTaskName(false)
  }

  const handleSaveDisplayId = () => {
    if (displayId.trim() && displayId !== task.display_id) {
      onUpdateTask(task.id, { display_id: displayId.trim() })
    } else {
      setDisplayId(task.display_id)
    }
    setEditingDisplayId(false)
  }

  const handleAddResourceSubmit = () => {
    if (newResourceName.trim()) {
      onAddResource(task.id, newResourceName.trim())
      setNewResourceName('')
    }
  }

  const handleToggle = useCallback(() => onToggleTask(task.id), [onToggleTask, task.id])

  // Enter commits and keeps the field open for the next entry, so several
  // subtasks can be typed in a row.
  const handleAddSubtaskSubmit = () => {
    if (!newSubtaskName.trim()) return
    onAddSubtask(task.id, newSubtaskName.trim())
    setNewSubtaskName('')
    if (!isExpanded) handleToggle()
  }

  const openSubtaskInput = () => {
    if (!isExpanded) handleToggle()
    setShowSubtaskInput(true)
    requestAnimationFrame(() => subtaskInputRef.current?.focus())
  }

  const handleTaskNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTaskName()
      return
    }
    if (e.key === 'Escape') {
      setTaskName(task.name)
      setEditingTaskName(false)
      return
    }
    // Outliner convention: Tab indents, Shift+Tab outdents
    if (e.key === 'Tab') {
      e.preventDefault()
      handleSaveTaskName()
      if (e.shiftKey) {
        onOutdentTask(task.id)
      } else {
        onIndentTask(task.id)
      }
    }
  }

  const deleteConfirmKey = hasChildren ? 'deleteTaskWithSubtasksConfirm' : 'deleteTaskConfirm'

  return (
    <>
      {/* Task / Subtask header row */}
      <tr className={cn('group', isSubtask ? 'planvas-row-subtask' : 'planvas-row-top', rowBgSoft)}>
        {/* ID Column */}
        <td
          className={cn('sticky z-20 border-r border-paper-lines px-1 py-2 text-center', rowBg)}
          style={{ left: 0, width: ID_COLUMN_WIDTH }}
        >
          {isSubtask ? (
            // Subtask ids are derived from the parent + position, so they stay
            // consistent when tasks are renamed, moved or deleted.
            <span
              className="font-mono text-xs text-ink-light block truncate"
              title={`${task.display_id} · ${t('grid', 'autoNumbered')}`}
            >
              {task.display_id}
            </span>
          ) : editingDisplayId && canEdit ? (
            <input
              type="text"
              value={displayId}
              onChange={e => setDisplayId(e.target.value)}
              onBlur={handleSaveDisplayId}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveDisplayId()
                if (e.key === 'Escape') {
                  setDisplayId(task.display_id)
                  setEditingDisplayId(false)
                }
              }}
              className="input-notebook w-full text-center font-mono text-xs"
              autoFocus
            />
          ) : (
            <button
              onClick={() => canEdit && setEditingDisplayId(true)}
              className={cn(
                'font-mono text-xs text-ink-light w-full truncate',
                canEdit && 'editable-text'
              )}
              title={canEdit ? t('grid', 'clickToEdit') : task.display_id}
              disabled={!canEdit}
            >
              {task.display_id}
            </button>
          )}
        </td>

        {/* Task Name */}
        <td
          className={cn('sticky z-20 border-r border-paper-lines px-2 py-2 overflow-hidden', rowBg)}
          style={{ left: taskColumnLeft, width: taskColumnWidth }}
        >
          <div className={cn('flex items-center gap-1 min-w-0', isSubtask && 'pl-1.5')}>
            {isSubtask && (
              <span
                className="w-0.5 self-stretch rounded-full bg-ink-faded/40 mr-1.5 flex-shrink-0"
                aria-hidden
              />
            )}
            <button
              onClick={handleToggle}
              aria-expanded={isExpanded}
              aria-label={`${task.display_id} ${task.name}`}
              className="p-0.5 hover:bg-paper-lines rounded transition-colors flex-shrink-0"
            >
              <ChevronRight
                size={isSubtask ? 14 : 16}
                className={cn(
                  'text-ink-light transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>

            {editingTaskName && canEdit ? (
              <input
                type="text"
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                onBlur={handleSaveTaskName}
                onKeyDown={handleTaskNameKeyDown}
                className={cn('input-notebook min-w-0 flex-1', !isSubtask && 'font-medium')}
                autoFocus
              />
            ) : (
              <button
                onClick={() => canEdit && setEditingTaskName(true)}
                className={cn(
                  'text-ink text-left truncate min-w-0 flex-1',
                  !isSubtask && 'font-medium',
                  isSubtask && 'text-sm',
                  canEdit && 'editable-text'
                )}
                title={canEdit ? `${t('grid', 'clickToEdit')} · ${t('grid', 'indentHint')}` : task.name}
                disabled={!canEdit}
              >
                {task.name}
              </button>
            )}

            {/* Add subtask (roots only) — expands and reveals the inline input */}
            {canEdit && !isSubtask && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openSubtaskInput()
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-paper-lines text-ink-light transition-all flex-shrink-0"
                title={t('grid', 'addSubtask')}
                aria-label={t('grid', 'addSubtask')}
              >
                <Plus size={14} />
              </button>
            )}

            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`${t('grid', 'task')} "${task.name}" ${t('grid', deleteConfirmKey)}`)) {
                    onDeleteTask(task.id)
                  }
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0"
                title={t('grid', 'deleteTask')}
                aria-label={`${t('grid', 'deleteTask')}: ${task.name}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>

        {/* Empty resource cell for task row */}
        <td
          className={cn('planvas-freeze-edge sticky z-20 border-r border-paper-lines', rowBg)}
          style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
        />

        {/* Aggregated Start Date */}
        <td className={cn('border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap', rowBgSoft)}>
          <span className="font-mono text-xs text-ink-light">
            {task.computed.startDate || '—'}
          </span>
        </td>

        {/* Aggregated End Date */}
        <td className={cn('border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap', rowBgSoft)}>
          <span className="font-mono text-xs text-ink-light">
            {task.computed.endDate || '—'}
          </span>
        </td>

        {/* Total Effort */}
        <td className={cn('border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap', rowBgSoft)}>
          <span className="font-mono text-xs font-medium text-ink">
            {task.computed.totalEffort > 0 ? `${task.computed.totalEffort}%` : '—'}
          </span>
        </td>

        {/* Custom column cells (task level) */}
        {customColumns.map((col) => (
          <CustomColumnCell
            key={col.id}
            column={col}
            rowType="task"
            rowId={task.id}
            value={getCustomValue(col.id, 'task', task.id)}
            canEdit={canEdit}
            width={col.width ?? CUSTOM_COL_WIDTH}
            variant={isSubtask ? 'resource' : 'task'}
            onOpen={onOpenCustomCell}
          />
        ))}
        {showAddColumn && <td className={cn('border-l border-paper-lines', rowBgSoft)} />}

        {/* Aggregated Time Cells */}
        {slotKeys.map((slotKey, i) => {
          const slotData = taskAllocationBySlot.get(slotKey)
          const hasValue = slotData && slotData.total > 0
          const isCurrent = slotKey === currentSlotKey

          return (
            <td key={i} className={cn('time-slot-cell p-0', isCurrent && 'time-slot-current')}>
              <div className="allocation-cell">
                <div
                  className={cn(
                    'allocation-chip relative',
                    hasValue ? 'has-value' : 'empty'
                  )}
                  style={hasValue && slotData.mixedColor ? {
                    '--chip-color': slotData.mixedColor,
                    '--chip-opacity': Math.min(0.9, Math.max(0.45, slotData.total / 200)),
                  } as React.CSSProperties : undefined}
                  title={hasValue ? `${slotData.total}% (${slotData.colorData.length} ${t('grid', 'resources')})` : undefined}
                >
                  {hasValue && (
                    <span
                      className="chip-label"
                      style={{ color: getContrastTextColor(slotData.mixedColor || '#40C463') }}
                    >
                      {slotData.total}
                    </span>
                  )}
                </div>
              </div>
            </td>
          )
        })}
      </tr>

      {/* Expanded: subtasks (roots only) + own resources */}
      {isExpanded && (
        <>
          {!isSubtask &&
            task.children.map((child) => (
              <TaskRows
                key={child.id}
                task={child}
                isSubtask
                isExpanded={expandedTaskIds.has(child.id)}
                expandedTaskIds={expandedTaskIds}
                onToggleTask={onToggleTask}
                slotKeys={slotKeys}
                currentSlotKey={currentSlotKey}
                onCellMouseDown={onCellMouseDown}
                onCellMouseEnter={onCellMouseEnter}
                onAddResource={onAddResource}
                onAddSubtask={onAddSubtask}
                onIndentTask={onIndentTask}
                onOutdentTask={onOutdentTask}
                onUpdateTask={onUpdateTask}
                onUpdateResource={onUpdateResource}
                onDeleteTask={onDeleteTask}
                onDeleteResource={onDeleteResource}
                taskColumnLeft={taskColumnLeft}
                taskColumnWidth={taskColumnWidth}
                resourceColumnLeft={resourceColumnLeft}
                resourceColumnWidth={resourceColumnWidth}
                canEdit={canEdit}
                customColumns={customColumns}
                showAddColumn={showAddColumn}
                getCustomValue={getCustomValue}
                onOpenCustomCell={onOpenCustomCell}
              />
            ))}

          {/* Inline new subtask input - only while adding, so no row is wasted */}
          {canEdit && !isSubtask && showSubtaskInput && (
            <tr className="planvas-row-subtask bg-paper-warm/20">
              <td
                className="sticky bg-paper-warm z-20 border-r border-paper-lines"
                style={{ left: 0, width: ID_COLUMN_WIDTH }}
              />
              <td
                className="sticky bg-paper-warm z-20 border-r border-paper-lines px-2 py-1 overflow-hidden"
                style={{ left: taskColumnLeft, width: taskColumnWidth }}
              >
                <div className="flex items-center gap-1 min-w-0 pl-1.5">
                  <span className="w-0.5 self-stretch rounded-full bg-ink-faded/40 mr-1.5 flex-shrink-0" aria-hidden />
                  <Plus size={12} className="text-ink-faded flex-shrink-0" />
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    value={newSubtaskName}
                    onChange={e => setNewSubtaskName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSubtaskSubmit()
                      if (e.key === 'Escape') {
                        setNewSubtaskName('')
                        setShowSubtaskInput(false)
                      }
                    }}
                    // Clicking away never creates anything - it only closes the
                    // field when nothing was typed, so drafts are never lost.
                    onBlur={() => {
                      if (!newSubtaskName.trim()) setShowSubtaskInput(false)
                    }}
                    placeholder={t('grid', 'newSubtask')}
                    aria-label={t('grid', 'addSubtask')}
                    className="input-notebook text-sm italic text-ink-faded min-w-0 flex-1"
                  />
                  {newSubtaskName.trim() && (
                    <InlineAddConfirm
                      onSubmit={handleAddSubtaskSubmit}
                      label={t('grid', 'pressEnterToAdd')}
                    />
                  )}
                </div>
              </td>
              <td
                className="planvas-freeze-edge sticky bg-paper-warm z-20 border-r border-paper-lines"
                style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
              />
              <td colSpan={3 + extraColCount}></td>
              {slotKeys.map((slotKey, i) => (
                <td
                  key={i}
                  className={cn('time-slot-cell p-0', slotKey === currentSlotKey && 'time-slot-current')}
                />
              ))}
            </tr>
          )}

          {task.resources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              slotKeys={slotKeys}
              currentSlotKey={currentSlotKey}
              onCellMouseDown={onCellMouseDown}
              onCellMouseEnter={onCellMouseEnter}
              onUpdateResource={onUpdateResource}
              onDeleteResource={onDeleteResource}
              taskColumnLeft={taskColumnLeft}
              taskColumnWidth={taskColumnWidth}
              resourceColumnLeft={resourceColumnLeft}
              resourceColumnWidth={resourceColumnWidth}
              canEdit={canEdit}
              customColumns={customColumns}
              showAddColumn={showAddColumn}
              getCustomValue={getCustomValue}
              onOpenCustomCell={onOpenCustomCell}
              indent={isSubtask}
            />
          ))}

          {/* Add Resource Row */}
          {canEdit && (
            <tr className="hover:bg-paper-warm/30">
              <td
                className="sticky bg-surface z-20 border-r border-paper-lines"
                style={{ left: 0, width: ID_COLUMN_WIDTH }}
              />
              <td
                className="sticky bg-surface z-20 border-r border-paper-lines"
                style={{ left: taskColumnLeft, width: taskColumnWidth }}
              />
              <td
                className="planvas-freeze-edge sticky bg-surface z-20 border-r border-paper-lines px-3 py-1 overflow-hidden"
                style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
              >
                <div className={cn('flex items-center gap-2 min-w-0', isSubtask ? 'pl-6' : 'pl-4')}>
                  <Plus size={12} className="text-ink-faded flex-shrink-0" />
                  <input
                    type="text"
                    value={newResourceName}
                    onChange={e => setNewResourceName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddResourceSubmit()
                      if (e.key === 'Escape') setNewResourceName('')
                    }}
                    placeholder={t('grid', 'newResource')}
                    className="input-notebook text-sm italic text-ink-faded min-w-0 flex-1"
                  />
                  {newResourceName.trim() && (
                    <InlineAddConfirm
                      onSubmit={handleAddResourceSubmit}
                      label={t('grid', 'pressEnterToAdd')}
                    />
                  )}
                </div>
              </td>
              <td colSpan={3 + extraColCount}></td>
              {slotKeys.map((slotKey, i) => (
                <td
                  key={i}
                  className={cn('time-slot-cell p-0', slotKey === currentSlotKey && 'time-slot-current')}
                />
              ))}
            </tr>
          )}
        </>
      )}
    </>
  )
}

/**
 * Rows are memoized because the store hands out a fresh tree on every paint
 * stroke while leaving untouched task objects referentially stable.
 */
const TaskRows = memo(TaskRowsComponent)

// ==================== Resource Row Component ====================

interface ResourceRowProps {
  resource: ResourceWithAllocations
  slotKeys: string[]
  currentSlotKey: string
  onCellMouseDown: (resourceId: string, slotKey: string) => void
  onCellMouseEnter: (resourceId: string, slotKey: string) => void
  onUpdateResource: (id: string, updates: Partial<ResourceWithAllocations>) => void
  onDeleteResource: (id: string) => void
  taskColumnLeft: number
  taskColumnWidth: number
  resourceColumnLeft: number
  resourceColumnWidth: number
  canEdit: boolean
  customColumns: CustomColumn[]
  showAddColumn: boolean
  getCustomValue: (columnId: string, rowType: CustomRowType, rowId: string) => string
  onOpenCustomCell: (target: CustomCellEditTarget) => void
  /** Extra indent when resource belongs to a subtask */
  indent?: boolean
}

function ResourceRowComponent({
  resource,
  slotKeys,
  currentSlotKey,
  onCellMouseDown,
  onCellMouseEnter,
  onUpdateResource,
  onDeleteResource,
  taskColumnLeft,
  taskColumnWidth,
  resourceColumnLeft,
  resourceColumnWidth,
  canEdit,
  customColumns,
  showAddColumn,
  getCustomValue,
  onOpenCustomCell,
  indent = false,
}: ResourceRowProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(resource.name)

  // Calculate resource totals
  const { startDate, endDate, totalEffort } = useMemo(() => {
    if (resource.allocations.length === 0) {
      return { startDate: null, endDate: null, totalEffort: 0 }
    }

    const dates = resource.allocations.map(a => a.date).sort()
    const total = resource.allocations.reduce((sum, a) => sum + a.percentage, 0)

    return {
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      totalEffort: total,
    }
  }, [resource.allocations])

  const handleSaveName = () => {
    if (name.trim() && name !== resource.name) {
      onUpdateResource(resource.id, { name: name.trim() })
    } else {
      setName(resource.name)
    }
    setIsEditing(false)
  }

  // Paint events are delegated from the row instead of bound per cell: a wide
  // window would otherwise allocate two closures for every one of its cells.
  const slotFromEvent = (e: React.MouseEvent) =>
    (e.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot

  const handleRowMouseDown = canEdit
    ? (e: React.MouseEvent) => {
        const slotKey = slotFromEvent(e)
        if (slotKey) onCellMouseDown(resource.id, slotKey)
      }
    : undefined

  const handleRowMouseOver = canEdit
    ? (e: React.MouseEvent) => {
        const slotKey = slotFromEvent(e)
        if (slotKey) onCellMouseEnter(resource.id, slotKey)
      }
    : undefined

  return (
    <tr
      className="hover:bg-paper-warm/20 group"
      onMouseDown={handleRowMouseDown}
      onMouseOver={handleRowMouseOver}
    >
      {/* Empty ID cell */}
      <td 
        className="sticky bg-surface z-20 border-r border-paper-lines"
        style={{ left: 0, width: ID_COLUMN_WIDTH }}
      />
      
      {/* Empty task cell */}
      <td 
        className="sticky bg-surface z-20 border-r border-paper-lines"
        style={{ left: taskColumnLeft, width: taskColumnWidth }}
      />
      
      {/* Resource Name */}
      <td 
        className="planvas-freeze-edge sticky bg-surface z-20 border-r border-paper-lines px-3 py-1.5 overflow-hidden"
        style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
      >
        <div className={cn('flex items-center gap-2 min-w-0', indent ? 'pl-6' : 'pl-4')}>
          {isEditing && canEdit ? (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              className="input-notebook text-sm min-w-0 flex-1"
              autoFocus
            />
          ) : (
            <button 
              onClick={() => canEdit && setIsEditing(true)}
              className={cn(
                "text-sm text-ink text-left truncate min-w-0 flex-1",
                canEdit && "editable-text"
              )}
              title={canEdit ? t('grid', 'clickToEdit') : resource.name}
              disabled={!canEdit}
            >
              {resource.name}
            </button>
          )}
          
          {/* Delete Resource Button - only show if user can edit */}
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`${t('grid', 'resource')} "${resource.name}" ${t('grid', 'deleteResourceConfirm')}`)) {
                  onDeleteResource(resource.id)
                }
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0"
              title={t('grid', 'deleteResource')}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </td>
      
      {/* Start Date */}
      <td className="border-r border-paper-lines text-center px-2 py-1.5 whitespace-nowrap">
        <span className="font-mono text-xs text-ink-faded">
          {startDate || '—'}
        </span>
      </td>
      
      {/* End Date */}
      <td className="border-r border-paper-lines text-center px-2 py-1.5 whitespace-nowrap">
        <span className="font-mono text-xs text-ink-faded">
          {endDate || '—'}
        </span>
      </td>
      
      {/* Total */}
      <td className="border-r border-paper-lines text-center px-2 py-1.5 whitespace-nowrap">
        <span className="font-mono text-xs text-ink-faded">
          {totalEffort > 0 ? totalEffort : '—'}
        </span>
      </td>

      {/* Custom column cells (resource level) */}
      {customColumns.map((col) => (
        <CustomColumnCell
          key={col.id}
          column={col}
          rowType="resource"
          rowId={resource.id}
          value={getCustomValue(col.id, 'resource', resource.id)}
          canEdit={canEdit}
          width={col.width ?? CUSTOM_COL_WIDTH}
          variant="resource"
          onOpen={onOpenCustomCell}
        />
      ))}
      {showAddColumn && <td className="border-l border-paper-lines" />}
      
      {/* Allocation Cells (paintable) */}
      {slotKeys.map((slotKey, i) => {
        const allocation = resource.allocationMap.get(slotKey)
        
        return (
          <td
            key={i}
            data-slot={slotKey}
            className={cn('time-slot-cell p-0', slotKey === currentSlotKey && 'time-slot-current')}
          >
            <div className="allocation-cell">
              <div
                className={cn(
                  'allocation-chip',
                  canEdit && 'paintable',
                  allocation ? 'has-value' : 'empty'
                )}
                style={allocation ? {
                  '--chip-color': allocation.color_hex,
                  '--chip-opacity': percentageToOpacity(allocation.percentage),
                } as React.CSSProperties : undefined}
                title={allocation ? `${allocation.percentage}%` : (canEdit ? t('grid', 'clickToAssign') : '')}
              >
                {allocation && (
                  <span
                    className="chip-label"
                    style={{ color: getContrastTextColor(allocation.color_hex) }}
                  >
                    {allocation.percentage}
                  </span>
                )}
              </div>
            </div>
          </td>
        )
      })}
    </tr>
  )
}

const ResourceRow = memo(ResourceRowComponent)

// ==================== Resource Summary Row Component ====================

interface ResourceSummaryRowProps {
  summary: {
    name: string
    allocationsBySlot: Map<string, { total: number; colorData: { color: string; percentage: number }[] }>
    totalEffort: number
    startDate: string | null
    endDate: string | null
  }
  slotKeys: string[]
  currentSlotKey: string
  customColumns: CustomColumn[]
  showAddColumn: boolean
  summaryColumnWidth: number
  minAllocation: number
  maxAllocation: number
  onMinAllocationChange: (name: string, value: number) => void
  onMaxAllocationChange: (name: string, value: number) => void
}

function ResourceSummaryRowComponent({
  summary,
  slotKeys,
  currentSlotKey,
  customColumns,
  showAddColumn,
  summaryColumnWidth,
  minAllocation,
  maxAllocation,
  onMinAllocationChange,
  onMaxAllocationChange,
}: ResourceSummaryRowProps) {
  const { t } = useTranslation()
  const [isEditingMin, setIsEditingMin] = useState(false)
  const [isEditingMax, setIsEditingMax] = useState(false)
  const [minInputValue, setMinInputValue] = useState(String(minAllocation))
  const [maxInputValue, setMaxInputValue] = useState(String(maxAllocation))

  // Blended color per slot - only depends on the allocation data, so it must not
  // be recomputed when the user merely edits a threshold.
  const mixedColorBySlot = useMemo(() => {
    const map = new Map<string, string>()
    for (const [slotKey, data] of summary.allocationsBySlot) {
      map.set(slotKey, mixAllocationColors(data.colorData))
    }
    return map
  }, [summary.allocationsBySlot])

  // Check if any slot exceeds maxAllocation or is below minAllocation (only if minAllocation > 0 and slot has a value)
  const { hasOverallocation, hasUnderallocation } = useMemo(() => {
    let over = false
    let under = false
    for (const slot of summary.allocationsBySlot.values()) {
      if (slot.total > maxAllocation) over = true
      if (minAllocation > 0 && slot.total > 0 && slot.total < minAllocation) under = true
      if (over && under) break
    }
    return { hasOverallocation: over, hasUnderallocation: under }
  }, [summary.allocationsBySlot, maxAllocation, minAllocation])

  const handleSaveMin = () => {
    const parsed = parseInt(minInputValue, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onMinAllocationChange(summary.name, parsed)
    } else {
      setMinInputValue(String(minAllocation))
    }
    setIsEditingMin(false)
  }

  const handleSaveMax = () => {
    const parsed = parseInt(maxInputValue, 10)
    if (!isNaN(parsed) && parsed > 0) {
      onMaxAllocationChange(summary.name, parsed)
    } else {
      setMaxInputValue(String(maxAllocation))
    }
    setIsEditingMax(false)
  }

  return (
    <tr className={cn(
      'hover:bg-paper-warm/20',
      hasOverallocation && 'bg-red-50/30',
      hasUnderallocation && !hasOverallocation && 'bg-amber-50/30'
    )}>
      {/* Resource Name - first column */}
      <td 
        className="planvas-freeze-edge sticky bg-surface z-20 border-r border-paper-lines px-3 py-1.5 overflow-hidden"
        style={{ left: 0, width: summaryColumnWidth }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'text-sm font-medium truncate',
            hasOverallocation ? 'text-red-600' : hasUnderallocation ? 'text-amber-600' : 'text-ink'
          )}>
            {summary.name}
          </span>
          {hasOverallocation && (
            <span className="text-[10px] text-red-500 font-mono flex-shrink-0" title={t('grid', 'overload')}>⚠ ↑</span>
          )}
          {hasUnderallocation && !hasOverallocation && (
            <span className="text-[10px] text-amber-500 font-mono flex-shrink-0" title={t('grid', 'underload')}>⚠ ↓</span>
          )}
        </div>
      </td>
      
      {/* Min Allocation */}
      <td className="border-r border-paper-lines text-center px-1 py-1.5 whitespace-nowrap">
        {isEditingMin ? (
          <input
            type="number"
            value={minInputValue}
            onChange={e => setMinInputValue(e.target.value)}
            onBlur={handleSaveMin}
            onKeyDown={e => e.key === 'Enter' && handleSaveMin()}
            className="input-notebook w-full text-center font-mono text-xs"
            autoFocus
            min={0}
          />
        ) : (
          <button
            onClick={() => {
              setMinInputValue(String(minAllocation))
              setIsEditingMin(true)
            }}
            className="editable-number font-mono text-xs text-ink-faded w-full"
            title={t('grid', 'editMinAllocation')}
          >
            {minAllocation}%
          </button>
        )}
      </td>
      
      {/* Max Allocation */}
      <td className="border-r border-paper-lines text-center px-1 py-1.5 whitespace-nowrap">
        {isEditingMax ? (
          <input
            type="number"
            value={maxInputValue}
            onChange={e => setMaxInputValue(e.target.value)}
            onBlur={handleSaveMax}
            onKeyDown={e => e.key === 'Enter' && handleSaveMax()}
            className="input-notebook w-full text-center font-mono text-xs"
            autoFocus
            min={1}
          />
        ) : (
          <button
            onClick={() => {
              setMaxInputValue(String(maxAllocation))
              setIsEditingMax(true)
            }}
            className="editable-number font-mono text-xs text-ink-faded w-full"
            title={t('grid', 'editMaxAllocation')}
          >
            {maxAllocation}%
          </button>
        )}
      </td>
      
      {/* Start Date */}
      <td className="border-r border-paper-lines text-center px-2 py-1.5 whitespace-nowrap">
        <span className="font-mono text-xs text-ink-faded">
          {summary.startDate || '—'}
        </span>
      </td>
      
      {/* End Date */}
      <td className="border-r border-paper-lines text-center px-2 py-1.5 whitespace-nowrap">
        <span className="font-mono text-xs text-ink-faded">
          {summary.endDate || '—'}
        </span>
      </td>
      
      {/* Total */}
      <td className="border-r border-paper-lines text-center px-2 py-1.5 whitespace-nowrap">
        <span className={cn(
          'font-mono text-xs font-medium',
          summary.totalEffort > 0 ? 'text-ink' : 'text-ink-faded'
        )}>
          {summary.totalEffort > 0 ? `${summary.totalEffort}%` : '—'}
        </span>
      </td>

      {/* Empty placeholder cells mirroring the custom columns of the table above */}
      {customColumns.map((col) => (
        <td key={col.id} className="border-r border-paper-lines" />
      ))}
      {showAddColumn && <td className="border-l border-paper-lines" />}
      
      {/* Allocation Cells */}
      {slotKeys.map((slotKey, i) => {
        const slotData = summary.allocationsBySlot.get(slotKey)
        const hasValue = slotData && slotData.total > 0
        const isOverallocated = slotData && slotData.total > maxAllocation
        const isUnderallocated = minAllocation > 0 && slotData && slotData.total > 0 && slotData.total < minAllocation
        const mixedColor = mixedColorBySlot.get(slotKey)
        const isCurrent = slotKey === currentSlotKey
        
        return (
          <td key={i} className={cn('time-slot-cell p-0', isCurrent && 'time-slot-current')}>
            <div className="allocation-cell">
              <div
                className={cn(
                  'allocation-chip relative',
                  hasValue ? 'has-value' : 'empty',
                  isOverallocated && 'ring-2 ring-red-400 ring-inset',
                  isUnderallocated && !isOverallocated && 'ring-2 ring-amber-400 ring-inset'
                )}
                style={hasValue && mixedColor ? {
                  '--chip-color': isOverallocated ? '#EF4444' : isUnderallocated ? '#F59E0B' : mixedColor,
                  '--chip-opacity': Math.min(0.95, Math.max(0.45, (slotData?.total || 0) / (maxAllocation * 1.5))),
                } as React.CSSProperties : undefined}
                title={hasValue ? `${slotData?.total}%${isOverallocated ? ` (${t('grid', 'overload')}! Max: ${maxAllocation}%)` : isUnderallocated ? ` (${t('grid', 'underload')}! Min: ${minAllocation}%)` : ''}` : undefined}
              >
                {hasValue && (
                  <span
                    className="chip-label"
                    style={{ color: getContrastTextColor(isOverallocated ? '#EF4444' : isUnderallocated ? '#F59E0B' : (mixedColor || '#40C463')) }}
                  >
                    {slotData?.total}
                  </span>
                )}
              </div>
            </div>
          </td>
        )
      })}
    </tr>
  )
}

const ResourceSummaryRow = memo(ResourceSummaryRowComponent)
