'use client'

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { Plus, ChevronRight, ChevronLeft, GripVertical, ChevronsUpDown, ChevronsDownUp, Trash2 } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import { useTranslation } from '@/lib/language-context'
import { 
  cn, 
  generateTimeSlots, 
  formatTimeSlotHeader, 
  formatTimeSlotGroup,
  dateToSlotKey,
  percentageToOpacity,
} from '@/lib/utils'
import { format, parseISO, addYears, addMonths, startOfYear, startOfMonth, endOfYear, endOfMonth, isAfter, isBefore } from 'date-fns'
import type { TaskWithAggregation, ResourceWithAllocations, Resolution } from '@/lib/types'

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
}

function ColumnResizer({ onResize }: ColumnResizerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)

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
        onResize(delta)
        startXRef.current = e.clientX
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onResize])

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

export function PlanningGrid() {
  const { t, dateLocale } = useTranslation()
  const {
    project,
    tasksWithData,
    activeBrush,
    isPainting,
    setIsPainting,
    setAllocation,
    setAllocationAsync,
    removeAllocation,
    removeAllocationAsync,
    createTaskAsync,
    createResourceAsync,
    updateTask,
    updateTaskAsync,
    updateResource,
    updateResourceAsync,
    deleteTaskAsync,
    deleteResourceAsync,
    canEdit,
  } = useProjectStore()
  
  // Check if user has edit permission
  const hasEditPermission = canEdit()

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [newTaskName, setNewTaskName] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const hasInitializedExpand = useRef(false)
  const [showResourceSummary, setShowResourceSummary] = useState(true)
  
  // Time window navigation offset (0 = first window)
  const [timeWindowOffset, setTimeWindowOffset] = useState(0)
  
  // Max allocation per resource name (default 100%)
  const [maxAllocationByResource, setMaxAllocationByResource] = useState<Map<string, number>>(new Map())
  // Min allocation per resource name (default 0%)
  const [minAllocationByResource, setMinAllocationByResource] = useState<Map<string, number>>(new Map())
  
  // Cursor follower state - only visible over paint area (time slots)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [isOverPaintArea, setIsOverPaintArea] = useState(false)

  // Column widths state
  const [taskColumnWidth, setTaskColumnWidth] = useState(DEFAULT_TASK_WIDTH)
  const [resourceColumnWidth, setResourceColumnWidth] = useState(DEFAULT_RESOURCE_WIDTH)

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

    // Collect all resources from all tasks
    const allResources = tasksWithData.flatMap(t => t.resources)
    
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

    return Array.from(groupedByName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [project, tasksWithData])

  // Handle column resize
  const handleTaskColumnResize = useCallback((delta: number) => {
    setTaskColumnWidth(w => Math.max(MIN_TASK_WIDTH, w + delta))
  }, [])

  const handleResourceColumnResize = useCallback((delta: number) => {
    setResourceColumnWidth(w => Math.max(MIN_RESOURCE_WIDTH, w + delta))
  }, [])

  // Toggle task expansion
  const toggleTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  // Expand all tasks
  const expandAll = useCallback(() => {
    setExpandedTasks(new Set(tasksWithData.map(t => t.id)))
  }, [tasksWithData])

  // Collapse all tasks
  const collapseAll = useCallback(() => {
    setExpandedTasks(new Set())
  }, [])

  // Check if all are expanded or collapsed
  const allExpanded = tasksWithData.length > 0 && expandedTasks.size === tasksWithData.length
  const allCollapsed = expandedTasks.size === 0

  // Track last clicked cell to detect double-click on same cell
  const lastClickedCell = useRef<{ resourceId: string; slotKey: string } | null>(null)

  // Handle allocation click (paint mode) - with async persistence
  const handleCellClick = useCallback((resourceId: string, date: Date) => {
    if (!project || !hasEditPermission) return
    
    const slotKey = dateToSlotKey(date, project.resolution)
    
    const resource = tasksWithData
      .flatMap(t => t.resources)
      .find(r => r.id === resourceId)
    
    const existingAllocation = resource?.allocationMap.get(slotKey)
    const isSameCell = lastClickedCell.current?.resourceId === resourceId && 
                       lastClickedCell.current?.slotKey === slotKey
    
    if (existingAllocation) {
      // Cell has a value
      if (isSameCell) {
        // Second click on same cell -> delete
        removeAllocation(resourceId, slotKey)
        removeAllocationAsync(resourceId, slotKey).catch(console.error)
        lastClickedCell.current = null
      } else if (existingAllocation.percentage === activeBrush.percentage &&
                 existingAllocation.color_hex === activeBrush.colorHex) {
        // Same value as brush -> delete
        removeAllocation(resourceId, slotKey)
        removeAllocationAsync(resourceId, slotKey).catch(console.error)
        lastClickedCell.current = { resourceId, slotKey }
      } else {
        // Different value -> replace with brush
        setAllocation(resourceId, slotKey, activeBrush.percentage, activeBrush.colorHex)
        setAllocationAsync(resourceId, slotKey, activeBrush.percentage, activeBrush.colorHex).catch(console.error)
        lastClickedCell.current = { resourceId, slotKey }
      }
    } else {
      // Empty cell -> set brush value
      setAllocation(resourceId, slotKey, activeBrush.percentage, activeBrush.colorHex)
      setAllocationAsync(resourceId, slotKey, activeBrush.percentage, activeBrush.colorHex).catch(console.error)
      lastClickedCell.current = { resourceId, slotKey }
    }
  }, [project, tasksWithData, activeBrush, setAllocation, setAllocationAsync, removeAllocation, removeAllocationAsync, hasEditPermission])

  // Handle mouse events for painting
  const handleMouseDown = useCallback((resourceId: string, date: Date) => {
    if (!hasEditPermission) return
    setIsPainting(true)
    handleCellClick(resourceId, date)
  }, [setIsPainting, handleCellClick, hasEditPermission])

  const handleMouseEnter = useCallback((resourceId: string, date: Date) => {
    if (isPainting) {
      handleCellClick(resourceId, date)
    }
  }, [isPainting, handleCellClick])

  const handleMouseUp = useCallback(() => {
    setIsPainting(false)
  }, [setIsPainting])

  // Calculate fixed columns width (before time slots)
  const fixedColumnsWidth = ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth + START_COLUMN_WIDTH + END_COLUMN_WIDTH + SUM_COLUMN_WIDTH

  // Cursor follower handlers - only for paint area (time slots from column 7)
  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY })
    
    // Check if mouse is over time slot area (from column 7)
    const gridElement = gridRef.current
    if (gridElement) {
      const scrollContainer = gridElement.querySelector('.overflow-x-auto')
      if (scrollContainer) {
        const scrollRect = scrollContainer.getBoundingClientRect()
        const scrollLeft = scrollContainer.scrollLeft
        const relativeX = e.clientX - scrollRect.left + scrollLeft
        setIsOverPaintArea(relativeX >= fixedColumnsWidth)
      }
    }
  }, [fixedColumnsWidth])

  const handleGridMouseLeave = useCallback(() => {
    setIsOverPaintArea(false)
    setIsPainting(false)
  }, [setIsPainting])

  // Add new task (with async persistence)
  const handleAddTask = async () => {
    if (!newTaskName.trim() || !project || !hasEditPermission) return
    
    const newDisplayId = String(tasksWithData.length + 1)
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

  // Add new resource to task (with async persistence)
  const handleAddResource = async (taskId: string, name: string) => {
    if (!name.trim() || !hasEditPermission) return
    
    try {
      await createResourceAsync(taskId, name.trim())
    } catch (error) {
      console.error('Failed to create resource:', error)
    }
  }

  // Expand all tasks by default on first render only
  useEffect(() => {
    if (!hasInitializedExpand.current && tasksWithData.length > 0) {
      setExpandedTasks(new Set(tasksWithData.map(t => t.id)))
      hasInitializedExpand.current = true
    }
  }, [tasksWithData])

  if (!project) return null

  const stepLabel = t('grid', TIME_WINDOW_CONFIG[project.resolution].stepLabelKey)

  return (
    <>
      {/* Cursor Follower - shows current brush color (only over paint area) */}
      {isOverPaintArea && cursorPos && (
        <div
          className="fixed pointer-events-none z-50 flex items-center gap-1.5"
          style={{
            left: cursorPos.x + 16,
            top: cursorPos.y + 16,
          }}
        >
          <div
            className="w-5 h-5 rounded shadow-md border border-white/50"
            style={{
              backgroundColor: activeBrush.colorHex,
              opacity: percentageToOpacity(activeBrush.percentage),
            }}
          />
          <span className="text-xs font-mono bg-white/90 px-1.5 py-0.5 rounded shadow-sm text-ink-light">
            {activeBrush.percentage}%
          </span>
        </div>
      )}
      
      <div 
        ref={gridRef}
        className="paper-card overflow-hidden"
        onMouseUp={handleMouseUp}
        onMouseMove={handleGridMouseMove}
        onMouseLeave={handleGridMouseLeave}
      >
      <div className="overflow-x-auto">
        {/* 
          Table uses full width with minimum based on content.
          Fixed columns (ID, Task, Resource, Start, End, Σ) have explicit widths.
          Time slots share remaining space evenly.
        */}
        <table 
          className="border-collapse w-full"
          style={{ 
            tableLayout: 'fixed',
            minWidth: ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth + START_COLUMN_WIDTH + END_COLUMN_WIDTH + SUM_COLUMN_WIDTH + (timeSlots.length * 28)
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
            {/* Time slots: fill remaining space evenly (no fixed width) */}
            {timeSlots.map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>

          {/* Header */}
          <thead>
            {/* Month/Year row */}
            <tr className="border-b border-paper-lines">
              <th 
                className="sticky bg-paper-cream z-20 border-r border-paper-lines"
                style={{ left: 0, width: ID_COLUMN_WIDTH }}
              />
              <th 
                className="sticky bg-paper-cream z-20 border-r border-paper-lines text-left px-3 py-2 relative"
                style={{ left: taskColumnLeft, width: taskColumnWidth }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-hand text-ink-light">{t('grid', 'task')}</span>
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
                    >
                      <ChevronsDownUp size={14} />
                    </button>
                  </div>
                </div>
                <ColumnResizer onResize={handleTaskColumnResize} />
              </th>
              <th 
                className="sticky bg-paper-cream z-20 border-r border-paper-lines text-left px-3 py-2 relative"
                style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
              >
                <span className="font-hand text-ink-light">{t('grid', 'resource')}</span>
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
              
              {/* Time slots grouped by month/year with navigation */}
              {slotGroups.map((group, groupIndex) => (
                <th 
                  key={groupIndex}
                  colSpan={group.slots.length}
                  className="bg-paper-cream z-10 text-left px-1 py-1 border-l border-paper-lines"
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
                    
                    <span className="font-hand text-xs text-ink-light flex-1">
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
                className="sticky bg-paper-cream z-20 border-r border-paper-lines"
                style={{ left: 0, width: ID_COLUMN_WIDTH }}
              />
              <th 
                className="sticky bg-paper-cream z-20 border-r border-paper-lines"
                style={{ left: taskColumnLeft, width: taskColumnWidth }}
              />
              <th 
                className="sticky bg-paper-cream z-20 border-r border-paper-lines"
                style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
              />
              <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
              <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
              <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
              
              {timeSlots.map((slot, i) => (
                <th 
                  key={i}
                  className="time-slot-header bg-paper-cream z-10"
                >
                  <span className="font-mono text-[10px] text-ink-faded">
                    {formatTimeSlotHeader(slot, project.resolution)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {tasksWithData.map((task) => (
              <TaskRows
                key={task.id}
                task={task}
                isExpanded={expandedTasks.has(task.id)}
                onToggle={() => toggleTask(task.id)}
                timeSlots={timeSlots}
                resolution={project.resolution}
                onCellMouseDown={handleMouseDown}
                onCellMouseEnter={handleMouseEnter}
                onAddResource={handleAddResource}
                onUpdateTask={(updates) => {
                  updateTask(task.id, updates)
                  updateTaskAsync(task.id, updates).catch(console.error)
                }}
                onUpdateResource={(id, updates) => {
                  updateResource(id, updates)
                  updateResourceAsync(id, updates).catch(console.error)
                }}
                onDeleteTask={() => {
                  deleteTaskAsync(task.id).catch(console.error)
                }}
                onDeleteResource={(id) => {
                  deleteResourceAsync(id).catch(console.error)
                }}
                taskColumnLeft={taskColumnLeft}
                taskColumnWidth={taskColumnWidth}
                resourceColumnLeft={resourceColumnLeft}
                resourceColumnWidth={resourceColumnWidth}
                canEdit={hasEditPermission}
              />
            ))}
            
            {/* New Task Row - only show if user can edit */}
            {hasEditPermission && (
              <tr className="border-t border-paper-lines hover:bg-paper-warm/50">
                <td 
                  className="sticky bg-white z-20 border-r border-paper-lines"
                  style={{ left: 0, width: ID_COLUMN_WIDTH }}
                />
                <td 
                  colSpan={2}
                  className="sticky bg-white z-20 border-r border-paper-lines px-3 py-2"
                  style={{ left: taskColumnLeft }}
                >
                  <div className="flex items-center gap-2">
                    <Plus size={14} className="text-ink-faded flex-shrink-0" />
                    <input
                      type="text"
                      value={newTaskName}
                      onChange={e => setNewTaskName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                      onBlur={() => newTaskName && handleAddTask()}
                      placeholder={t('grid', 'newTask')}
                      className="input-notebook text-sm italic min-w-0 flex-1"
                    />
                  </div>
                </td>
                <td colSpan={3 + timeSlots.length} className="border-r border-paper-lines"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Resource Summary Section */}
    {resourceSummaryByName.length > 0 && (
      <div className="paper-card overflow-hidden mt-4">
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
          <div className="overflow-x-auto">
            <table 
              className="border-collapse w-full"
              style={{ 
                tableLayout: 'fixed',
                minWidth: ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth + START_COLUMN_WIDTH + END_COLUMN_WIDTH + SUM_COLUMN_WIDTH + (timeSlots.length * 28)
              }}
            >
              {/* Colgroup must match main table exactly for column alignment */}
              <colgroup>
                <col style={{ width: ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth - MIN_ALLOCATION_WIDTH - MAX_ALLOCATION_WIDTH }} />
                <col style={{ width: MIN_ALLOCATION_WIDTH }} />
                <col style={{ width: MAX_ALLOCATION_WIDTH }} />
                <col style={{ width: START_COLUMN_WIDTH }} />
                <col style={{ width: END_COLUMN_WIDTH }} />
                <col style={{ width: SUM_COLUMN_WIDTH }} />
                {timeSlots.map((_, i) => (
                  <col key={i} />
                ))}
              </colgroup>

              <thead>
                <tr className="border-b border-paper-lines">
                  <th 
                    className="sticky bg-paper-cream z-20 border-r border-paper-lines text-left px-3 py-2"
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
                  {/* Time slots grouped by month/year with navigation */}
                  {slotGroups.map((group, groupIndex) => (
                    <th 
                      key={groupIndex}
                      colSpan={group.slots.length}
                      className="bg-paper-cream z-10 text-left px-1 py-1 border-l border-paper-lines"
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
                        
                        <span className="font-hand text-xs text-ink-light flex-1">
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
                    className="sticky bg-paper-cream z-20 border-r border-paper-lines"
                    style={{ left: 0 }}
                  />
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  <th className="bg-paper-cream z-10 border-r border-paper-lines"></th>
                  {timeSlots.map((slot, i) => (
                    <th 
                      key={i}
                      className="time-slot-header bg-paper-cream z-10"
                    >
                      <span className="font-mono text-[10px] text-ink-faded">
                        {formatTimeSlotHeader(slot, project.resolution)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {resourceSummaryByName.map((summary) => (
                  <ResourceSummaryRow
                    key={summary.name}
                    summary={summary}
                    timeSlots={timeSlots}
                    resolution={project.resolution}
                    summaryColumnWidth={ID_COLUMN_WIDTH + taskColumnWidth + resourceColumnWidth - MIN_ALLOCATION_WIDTH - MAX_ALLOCATION_WIDTH}
                    minAllocation={minAllocationByResource.get(summary.name) ?? 0}
                    maxAllocation={maxAllocationByResource.get(summary.name) ?? 100}
                    onMinAllocationChange={(value) => {
                      setMinAllocationByResource(prev => {
                        const next = new Map(prev)
                        next.set(summary.name, value)
                        return next
                      })
                    }}
                    onMaxAllocationChange={(value) => {
                      setMaxAllocationByResource(prev => {
                        const next = new Map(prev)
                        next.set(summary.name, value)
                        return next
                      })
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}
    </>
  )
}

// ==================== Task Rows Component ====================

interface TaskRowsProps {
  task: TaskWithAggregation
  isExpanded: boolean
  onToggle: () => void
  timeSlots: Date[]
  resolution: 'day' | 'week' | 'month' | 'year'
  onCellMouseDown: (resourceId: string, date: Date) => void
  onCellMouseEnter: (resourceId: string, date: Date) => void
  onAddResource: (taskId: string, name: string) => void
  onUpdateTask: (updates: Partial<TaskWithAggregation>) => void
  onUpdateResource: (id: string, updates: Partial<ResourceWithAllocations>) => void
  onDeleteTask: () => void
  onDeleteResource: (id: string) => void
  taskColumnLeft: number
  taskColumnWidth: number
  resourceColumnLeft: number
  resourceColumnWidth: number
  canEdit: boolean
}

function TaskRows({
  task,
  isExpanded,
  onToggle,
  timeSlots,
  resolution,
  onCellMouseDown,
  onCellMouseEnter,
  onAddResource,
  onUpdateTask,
  onUpdateResource,
  onDeleteTask,
  onDeleteResource,
  taskColumnLeft,
  taskColumnWidth,
  resourceColumnLeft,
  resourceColumnWidth,
  canEdit,
}: TaskRowsProps) {
  const { t } = useTranslation()
  const [newResourceName, setNewResourceName] = useState('')
  const [editingTaskName, setEditingTaskName] = useState(false)
  const [editingDisplayId, setEditingDisplayId] = useState(false)
  const [taskName, setTaskName] = useState(task.name)
  const [displayId, setDisplayId] = useState(task.display_id)

  // Helper function to mix colors based on percentages
  const mixColors = (colorData: { color: string; percentage: number }[]): string => {
    if (colorData.length === 0) return '#E8E4DD'
    if (colorData.length === 1) return colorData[0].color
    
    // Calculate weighted average of RGB values
    let totalWeight = 0
    let r = 0, g = 0, b = 0
    
    for (const { color, percentage } of colorData) {
      const hex = color.replace('#', '')
      const cr = parseInt(hex.slice(0, 2), 16)
      const cg = parseInt(hex.slice(2, 4), 16)
      const cb = parseInt(hex.slice(4, 6), 16)
      
      r += cr * percentage
      g += cg * percentage
      b += cb * percentage
      totalWeight += percentage
    }
    
    if (totalWeight === 0) return '#E8E4DD'
    
    r = Math.round(r / totalWeight)
    g = Math.round(g / totalWeight)
    b = Math.round(b / totalWeight)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Aggregate allocation data for task row visualization
  const taskAllocationBySlot = useMemo(() => {
    const map = new Map<string, { total: number; colorData: { color: string; percentage: number }[]; mixedColor: string }>()
    
    for (const resource of task.resources) {
      for (const [date, alloc] of resource.allocationMap) {
        const existing = map.get(date)
        if (existing) {
          existing.total += alloc.percentage
          existing.colorData.push({ color: alloc.color_hex, percentage: alloc.percentage })
        } else {
          map.set(date, { 
            total: alloc.percentage, 
            colorData: [{ color: alloc.color_hex, percentage: alloc.percentage }],
            mixedColor: ''
          })
        }
      }
    }
    
    // Calculate mixed colors for each slot
    for (const [date, data] of map) {
      data.mixedColor = mixColors(data.colorData)
    }
    
    return map
  }, [task.resources])

  const handleSaveTaskName = () => {
    if (taskName.trim() && taskName !== task.name) {
      onUpdateTask({ name: taskName.trim() })
    } else {
      setTaskName(task.name)
    }
    setEditingTaskName(false)
  }

  const handleSaveDisplayId = () => {
    if (displayId.trim() && displayId !== task.display_id) {
      onUpdateTask({ display_id: displayId.trim() })
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

  return (
    <>
      {/* Task Row (Parent/Header) */}
      <tr className="bg-paper-warm/30 border-t border-paper-lines group">
        {/* ID Column */}
        <td 
          className="sticky bg-paper-warm/50 z-20 border-r border-paper-lines px-2 py-2 text-center"
          style={{ left: 0, width: ID_COLUMN_WIDTH }}
        >
          {editingDisplayId && canEdit ? (
            <input
              type="text"
              value={displayId}
              onChange={e => setDisplayId(e.target.value)}
              onBlur={handleSaveDisplayId}
              onKeyDown={e => e.key === 'Enter' && handleSaveDisplayId()}
              className="input-notebook w-full text-center font-mono text-sm"
              autoFocus
            />
          ) : (
            <button 
              onClick={() => canEdit && setEditingDisplayId(true)}
              className={cn(
                "font-mono text-sm text-ink-light w-full truncate",
                canEdit && "editable-text"
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
          className="sticky bg-paper-warm/50 z-20 border-r border-paper-lines px-3 py-2 overflow-hidden"
          style={{ left: taskColumnLeft, width: taskColumnWidth }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button 
              onClick={onToggle}
              className="p-0.5 hover:bg-paper-lines rounded transition-colors flex-shrink-0"
            >
              <ChevronRight 
                size={16} 
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
                onKeyDown={e => e.key === 'Enter' && handleSaveTaskName()}
                className="input-notebook font-medium min-w-0 flex-1"
                autoFocus
              />
            ) : (
              <button 
                onClick={() => canEdit && setEditingTaskName(true)}
                className={cn(
                  "font-medium text-ink text-left truncate min-w-0 flex-1",
                  canEdit && "editable-text"
                )}
                title={canEdit ? t('grid', 'clickToEdit') : task.name}
                disabled={!canEdit}
              >
                {task.name}
              </button>
            )}
            
            {/* Delete Task Button - only show if user can edit */}
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`${t('grid', 'task')} "${task.name}" ${t('grid', 'deleteTaskConfirm')}`)) {
                    onDeleteTask()
                  }
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0"
                title={t('grid', 'deleteTask')}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
        
        {/* Empty resource cell for task row */}
        <td 
          className="sticky bg-paper-warm/50 z-20 border-r border-paper-lines"
          style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
        />
        
        {/* Aggregated Start Date */}
        <td className="bg-paper-warm/30 border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap">
          <span className="font-mono text-xs text-ink-light">
            {task.computed.startDate || '—'}
          </span>
        </td>
        
        {/* Aggregated End Date */}
        <td className="bg-paper-warm/30 border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap">
          <span className="font-mono text-xs text-ink-light">
            {task.computed.endDate || '—'}
          </span>
        </td>
        
        {/* Total Effort */}
        <td className="bg-paper-warm/30 border-r border-paper-lines text-center px-2 py-2 whitespace-nowrap">
          <span className="font-mono text-xs font-medium text-ink">
            {task.computed.totalEffort > 0 ? `${task.computed.totalEffort}%` : '—'}
          </span>
        </td>
        
        {/* Aggregated Time Cells - with chips and values like resources */}
        {timeSlots.map((slot, i) => {
          const slotKey = dateToSlotKey(slot, resolution)
          const slotData = taskAllocationBySlot.get(slotKey)
          const hasValue = slotData && slotData.total > 0
          
          return (
            <td key={i} className="time-slot-cell p-0">
              <div className="allocation-cell">
                <div
                  className={cn(
                    'allocation-chip relative',
                    hasValue ? 'has-value' : 'empty'
                  )}
                  style={hasValue && slotData.mixedColor ? {
                    '--chip-color': slotData.mixedColor,
                    '--chip-opacity': Math.min(0.9, Math.max(0.3, slotData.total / 200)),
                  } as React.CSSProperties : undefined}
                  title={hasValue ? `${slotData.total}% (${slotData.colorData.length} ${t('grid', 'resources')})` : undefined}
                >
                  {hasValue && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90 drop-shadow-sm">
                      {slotData.total}
                    </span>
                  )}
                </div>
              </div>
            </td>
          )
        })}
      </tr>

      {/* Resource Rows (Children) */}
      {isExpanded && (
        <>
          {task.resources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              timeSlots={timeSlots}
              resolution={resolution}
              onCellMouseDown={onCellMouseDown}
              onCellMouseEnter={onCellMouseEnter}
              onUpdateResource={(updates) => onUpdateResource(resource.id, updates)}
              onDeleteResource={() => onDeleteResource(resource.id)}
              taskColumnLeft={taskColumnLeft}
              taskColumnWidth={taskColumnWidth}
              resourceColumnLeft={resourceColumnLeft}
              resourceColumnWidth={resourceColumnWidth}
              canEdit={canEdit}
            />
          ))}
          
          {/* Add Resource Row - only show if user can edit */}
          {canEdit && (
            <tr className="hover:bg-paper-warm/30">
              <td 
                className="sticky bg-white z-20 border-r border-paper-lines"
                style={{ left: 0, width: ID_COLUMN_WIDTH }}
              />
              <td 
                className="sticky bg-white z-20 border-r border-paper-lines"
                style={{ left: taskColumnLeft, width: taskColumnWidth }}
              />
              <td 
                className="sticky bg-white z-20 border-r border-paper-lines px-3 py-1 overflow-hidden"
                style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
              >
                <div className="flex items-center gap-2 pl-4 min-w-0">
                  <Plus size={12} className="text-ink-faded flex-shrink-0" />
                  <input
                    type="text"
                    value={newResourceName}
                    onChange={e => setNewResourceName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddResourceSubmit()}
                    onBlur={handleAddResourceSubmit}
                    placeholder={t('grid', 'newResource')}
                    className="input-notebook text-sm italic text-ink-faded min-w-0 flex-1"
                  />
                </div>
              </td>
              <td colSpan={3 + timeSlots.length}></td>
            </tr>
          )}
        </>
      )}
    </>
  )
}

// ==================== Resource Row Component ====================

interface ResourceRowProps {
  resource: ResourceWithAllocations
  timeSlots: Date[]
  resolution: 'day' | 'week' | 'month' | 'year'
  onCellMouseDown: (resourceId: string, date: Date) => void
  onCellMouseEnter: (resourceId: string, date: Date) => void
  onUpdateResource: (updates: Partial<ResourceWithAllocations>) => void
  onDeleteResource: () => void
  taskColumnLeft: number
  taskColumnWidth: number
  resourceColumnLeft: number
  resourceColumnWidth: number
  canEdit: boolean
}

function ResourceRow({
  resource,
  timeSlots,
  resolution,
  onCellMouseDown,
  onCellMouseEnter,
  onUpdateResource,
  onDeleteResource,
  taskColumnLeft,
  taskColumnWidth,
  resourceColumnLeft,
  resourceColumnWidth,
  canEdit,
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
      onUpdateResource({ name: name.trim() })
    } else {
      setName(resource.name)
    }
    setIsEditing(false)
  }

  return (
    <tr className="hover:bg-paper-warm/20 group">
      {/* Empty ID cell */}
      <td 
        className="sticky bg-white z-20 border-r border-paper-lines"
        style={{ left: 0, width: ID_COLUMN_WIDTH }}
      />
      
      {/* Empty task cell */}
      <td 
        className="sticky bg-white z-20 border-r border-paper-lines"
        style={{ left: taskColumnLeft, width: taskColumnWidth }}
      />
      
      {/* Resource Name */}
      <td 
        className="sticky bg-white z-20 border-r border-paper-lines px-3 py-1.5 overflow-hidden"
        style={{ left: resourceColumnLeft, width: resourceColumnWidth }}
      >
        <div className="flex items-center gap-2 pl-4 min-w-0">
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
                  onDeleteResource()
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
      
      {/* Allocation Cells (paintable) */}
      {timeSlots.map((slot, i) => {
        const slotKey = dateToSlotKey(slot, resolution)
        const allocation = resource.allocationMap.get(slotKey)
        
        return (
          <td key={i} className="time-slot-cell p-0">
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
                onMouseDown={canEdit ? () => onCellMouseDown(resource.id, slot) : undefined}
                onMouseEnter={canEdit ? () => onCellMouseEnter(resource.id, slot) : undefined}
                title={allocation ? `${allocation.percentage}%` : (canEdit ? t('grid', 'clickToAssign') : '')}
              />
            </div>
          </td>
        )
      })}
    </tr>
  )
}

// ==================== Resource Summary Row Component ====================

interface ResourceSummaryRowProps {
  summary: {
    name: string
    allocationsBySlot: Map<string, { total: number; colorData: { color: string; percentage: number }[] }>
    totalEffort: number
    startDate: string | null
    endDate: string | null
  }
  timeSlots: Date[]
  resolution: 'day' | 'week' | 'month' | 'year'
  summaryColumnWidth: number
  minAllocation: number
  maxAllocation: number
  onMinAllocationChange: (value: number) => void
  onMaxAllocationChange: (value: number) => void
}

function ResourceSummaryRow({
  summary,
  timeSlots,
  resolution,
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

  // Helper function to mix colors based on percentages
  const mixColors = (colorData: { color: string; percentage: number }[]): string => {
    if (colorData.length === 0) return '#E8E4DD'
    if (colorData.length === 1) return colorData[0].color
    
    let totalWeight = 0
    let r = 0, g = 0, b = 0
    
    for (const { color, percentage } of colorData) {
      const hex = color.replace('#', '')
      const cr = parseInt(hex.slice(0, 2), 16)
      const cg = parseInt(hex.slice(2, 4), 16)
      const cb = parseInt(hex.slice(4, 6), 16)
      
      r += cr * percentage
      g += cg * percentage
      b += cb * percentage
      totalWeight += percentage
    }
    
    if (totalWeight === 0) return '#E8E4DD'
    
    r = Math.round(r / totalWeight)
    g = Math.round(g / totalWeight)
    b = Math.round(b / totalWeight)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Check if any slot exceeds maxAllocation or is below minAllocation (only if minAllocation > 0 and slot has a value)
  const hasOverallocation = Array.from(summary.allocationsBySlot.values()).some(s => s.total > maxAllocation)
  const hasUnderallocation = minAllocation > 0 && Array.from(summary.allocationsBySlot.values()).some(s => s.total > 0 && s.total < minAllocation)
  const hasWarning = hasOverallocation || hasUnderallocation

  const handleSaveMin = () => {
    const parsed = parseInt(minInputValue, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onMinAllocationChange(parsed)
    } else {
      setMinInputValue(String(minAllocation))
    }
    setIsEditingMin(false)
  }

  const handleSaveMax = () => {
    const parsed = parseInt(maxInputValue, 10)
    if (!isNaN(parsed) && parsed > 0) {
      onMaxAllocationChange(parsed)
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
        className="sticky bg-white z-20 border-r border-paper-lines px-3 py-1.5 overflow-hidden"
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
      
      {/* Allocation Cells */}
      {timeSlots.map((slot, i) => {
        const slotKey = dateToSlotKey(slot, resolution)
        const slotData = summary.allocationsBySlot.get(slotKey)
        const hasValue = slotData && slotData.total > 0
        const isOverallocated = slotData && slotData.total > maxAllocation
        const isUnderallocated = minAllocation > 0 && slotData && slotData.total > 0 && slotData.total < minAllocation
        const mixedColor = slotData ? mixColors(slotData.colorData) : undefined
        
        return (
          <td key={i} className="time-slot-cell p-0">
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
                  '--chip-opacity': Math.min(0.95, Math.max(0.3, (slotData?.total || 0) / (maxAllocation * 1.5))),
                } as React.CSSProperties : undefined}
                title={hasValue ? `${slotData?.total}%${isOverallocated ? ` (${t('grid', 'overload')}! Max: ${maxAllocation}%)` : isUnderallocated ? ` (${t('grid', 'underload')}! Min: ${minAllocation}%)` : ''}` : undefined}
              >
                {hasValue && (
                  <span className={cn(
                    'absolute inset-0 flex items-center justify-center text-[9px] font-bold',
                    (isOverallocated || isUnderallocated) ? 'text-white' : 'text-white/90 drop-shadow-sm'
                  )}>
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
