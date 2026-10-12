import { format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import type { ProjectFullData } from './pocketbase-api'
import type { Allocation, CustomRowType, Resource, Task } from './types'

export interface CsvLabels {
  taskId: string
  task: string
  parentTaskId: string
  resource: string
  slot: string
  date: string
  percentage: string
  color: string
  taskSuffix: string
  resourceSuffix: string
  weekPrefix: string
}

export interface CsvOptions {
  labels: CsvLabels
  /** ',' for German spreadsheets, '.' otherwise */
  decimalSeparator: ',' | '.'
}

const DELIMITER = ';'
const LINE_BREAK = '\r\n'
const BOM = '\uFEFF'

/** RFC 4180 quoting plus neutralizing spreadsheet formulas (CSV injection). */
function escapeCell(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  if (/[";\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`
  return v
}

function formatNumber(value: number, decimalSeparator: ',' | '.'): string {
  const str = String(Math.round(value * 100) / 100)
  return decimalSeparator === ',' ? str.replace('.', ',') : str
}

/** Slot key → { readable label, ISO start date } (keys: yyyy, yyyy-MM, yyyy-MM-dd). */
function describeSlot(key: string, isWeek: boolean, weekPrefix: string): { label: string; date: string } {
  if (/^\d{4}$/.test(key)) return { label: key, date: `${key}-01-01` }
  if (/^\d{4}-\d{2}$/.test(key)) return { label: key, date: `${key}-01` }
  if (isWeek && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const d = parseISO(key)
    return { label: `${weekPrefix}${getISOWeek(d)}/${getISOWeekYear(d)}`, date: key }
  }
  return { label: key, date: key }
}

/**
 * Long format: one row per allocation. Resources without allocations and tasks
 * without resources still get a row so no planning data is lost.
 */
export function buildProjectCsv(data: ProjectFullData, { labels, decimalSeparator }: CsvOptions): string {
  const { project, tasks, resources, allocations, customColumns, customValues } = data
  const isWeek = project.resolution === 'week'

  const columns = [...customColumns].sort((a, b) => a.sort_order - b.sort_order)
  const valueMap = new Map<string, string>()
  for (const cv of customValues) {
    valueMap.set(`${cv.column_id}:${cv.row_type}:${cv.row_id}`, cv.value)
  }
  const customValue = (columnId: string, rowType: CustomRowType, rowId: string | undefined) =>
    rowId ? valueMap.get(`${columnId}:${rowType}:${rowId}`) ?? '' : ''

  const resourcesByTask = new Map<string, Resource[]>()
  for (const r of resources) {
    const list = resourcesByTask.get(r.task_id) ?? []
    list.push(r)
    resourcesByTask.set(r.task_id, list)
  }
  resourcesByTask.forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order))

  const allocationsByResource = new Map<string, Allocation[]>()
  for (const a of allocations) {
    const list = allocationsByResource.get(a.resource_id) ?? []
    list.push(a)
    allocationsByResource.set(a.resource_id, list)
  }
  allocationsByResource.forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)))

  // Root tasks in order, each followed by its subtasks
  const bySort = (a: Task, b: Task) => a.sort_order - b.sort_order
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const roots = tasks.filter((t) => !t.parent_id || !taskById.has(t.parent_id)).sort(bySort)
  const orderedTasks: Task[] = []
  for (const root of roots) {
    orderedTasks.push(root)
    orderedTasks.push(...tasks.filter((t) => t.parent_id === root.id).sort(bySort))
  }

  const header = [
    labels.taskId,
    labels.task,
    labels.parentTaskId,
    labels.resource,
    labels.slot,
    labels.date,
    labels.percentage,
    labels.color,
    ...columns.flatMap((c) => [
      `${c.name} [${labels.taskSuffix}]`,
      `${c.name} [${labels.resourceSuffix}]`,
    ]),
  ]

  const rows: string[][] = [header]

  const pushRow = (task: Task, resource?: Resource, allocation?: Allocation) => {
    const parent = task.parent_id ? taskById.get(task.parent_id) : undefined
    const slot = allocation ? describeSlot(allocation.date, isWeek, labels.weekPrefix) : null
    rows.push([
      task.display_id,
      task.name,
      parent?.display_id ?? '',
      resource?.name ?? '',
      slot?.label ?? '',
      slot?.date ?? '',
      allocation ? formatNumber(allocation.percentage, decimalSeparator) : '',
      allocation?.color_hex ?? '',
      ...columns.flatMap((c) => [
        customValue(c.id, 'task', task.id),
        customValue(c.id, 'resource', resource?.id),
      ]),
    ])
  }

  for (const task of orderedTasks) {
    const taskResources = resourcesByTask.get(task.id) ?? []
    if (taskResources.length === 0) {
      pushRow(task)
      continue
    }
    for (const resource of taskResources) {
      const resourceAllocations = allocationsByResource.get(resource.id) ?? []
      if (resourceAllocations.length === 0) {
        pushRow(task, resource)
        continue
      }
      for (const allocation of resourceAllocations) {
        pushRow(task, resource, allocation)
      }
    }
  }

  return BOM + rows.map((row) => row.map(escapeCell).join(DELIMITER)).join(LINE_BREAK) + LINE_BREAK
}

export function csvFileName(projectName: string, date = new Date()): string {
  const slug = projectName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${slug || 'project'}_${format(date, 'yyyy-MM-dd')}.csv`
}

export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
