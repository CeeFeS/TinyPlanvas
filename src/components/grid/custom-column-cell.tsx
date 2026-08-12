'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Trash2, Check, Plus, Pencil, Code2, Eye } from 'lucide-react'
import type { CustomColumn, CustomRowType } from '@/lib/types'
import { useTranslation } from '@/lib/language-context'
import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/ui/markdown-content'

type EditorViewMode = 'markdown' | 'rendered'

// ==================== Editable Cell ====================

export interface CustomCellEditTarget {
  column: CustomColumn
  rowType: CustomRowType
  rowId: string
  value: string
  canEdit: boolean
}

interface CustomColumnCellProps {
  column: CustomColumn
  rowType: CustomRowType
  rowId: string
  value: string
  canEdit: boolean
  width: number
  /** subtle background tint variant for task (parent) rows */
  variant?: 'task' | 'resource'
  onOpen: (target: CustomCellEditTarget) => void
}

export function CustomColumnCell({
  column,
  rowType,
  rowId,
  value,
  canEdit,
  width,
  variant = 'resource',
  onOpen,
}: CustomColumnCellProps) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  const checkTruncation = useCallback(() => {
    const el = contentRef.current
    if (!el || !value) {
      setIsTruncated(false)
      return
    }
    setIsTruncated(el.scrollHeight > el.clientHeight + 1)
  }, [value])

  useEffect(() => {
    checkTruncation()
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => checkTruncation())
    ro.observe(el)
    return () => ro.disconnect()
  }, [checkTruncation])

  const handleOpen = () => {
    onOpen({ column, rowType, rowId, value, canEdit })
  }

  return (
    <td
      className={cn(
        'border-r border-paper-lines align-top p-0',
        variant === 'task' ? 'bg-paper-warm/30' : ''
      )}
      style={{ width }}
    >
      <div
        className={cn(
          'px-2 py-1.5 h-full min-h-[34px]',
          (canEdit || !!value) && 'cursor-pointer hover:bg-ink-blue/5 transition-colors'
        )}
        onClick={() => (canEdit || value) && handleOpen()}
        title={
          canEdit
            ? t('customColumns', 'clickToEdit')
            : value
              ? t('customColumns', 'clickToView')
              : undefined
        }
      >
        {value ? (
          <>
            <MarkdownContent ref={contentRef} content={value} className="markdown-clamp" />
            {isTruncated && (
              <span className="markdown-clamp-more">{t('customColumns', 'clickForMore')}</span>
            )}
          </>
        ) : (
          canEdit && (
            <span className="text-ink-faded/60 text-xs italic inline-flex items-center gap-1">
              <Pencil size={10} /> {t('customColumns', 'empty')}
            </span>
          )
        )}
      </div>
    </td>
  )
}

// ==================== Bottom Split Editor ====================

interface CustomValueEditorProps {
  columnName: string
  initialValue: string
  canEdit: boolean
  onCancel: () => void
  onSave: (value: string) => void
}

export function CustomValueEditor({
  columnName,
  initialValue,
  canEdit,
  onCancel,
  onSave,
}: CustomValueEditorProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(initialValue)
  // Edit: start in Markdown source; view-only: start rendered for reading
  const [viewMode, setViewMode] = useState<EditorViewMode>(canEdit ? 'markdown' : 'rendered')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setText(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (canEdit && viewMode === 'markdown') {
      textareaRef.current?.focus()
    }
  }, [canEdit, viewMode])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (canEdit && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSave(text)
    }
  }

  const displayValue = canEdit ? text : initialValue

  return (
    <div
      className="flex-none border-t border-paper-lines bg-surface flex flex-col shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      style={{ height: 'min(42vh, 420px)' }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-paper-lines bg-paper-warm/50 flex-none gap-3">
        <div className="min-w-0">
          <h2 className="font-hand text-lg text-ink truncate">{columnName}</h2>
          <p className="text-xs text-ink-faded">
            {canEdit ? t('customColumns', 'markdownHint') : t('customColumns', 'viewOnlyHint')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canEdit ? (
            <>
              <button onClick={onCancel} className="btn-notebook text-sm">
                {t('common', 'cancel')}
              </button>
              <button onClick={() => onSave(text)} className="btn-notebook btn-notebook-primary text-sm">
                <Check size={16} />
                {t('common', 'save')}
              </button>
            </>
          ) : (
            <button onClick={onCancel} className="btn-notebook text-sm">
              {t('common', 'close')}
            </button>
          )}
          <button onClick={onCancel} className="btn-icon hover:bg-red-50 hover:text-red-500" aria-label={t('common', 'close')}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 px-4 border-b border-paper-lines flex-none">
        <button
          type="button"
          onClick={() => setViewMode('markdown')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
            viewMode === 'markdown'
              ? 'border-ink-blue text-ink font-medium'
              : 'border-transparent text-ink-faded hover:text-ink'
          )}
        >
          <Code2 size={14} />
          {t('customColumns', 'modeEdit')}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('rendered')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
            viewMode === 'rendered'
              ? 'border-ink-blue text-ink font-medium'
              : 'border-transparent text-ink-faded hover:text-ink'
          )}
        >
          <Eye size={14} />
          {t('customColumns', 'modeView')}
        </button>
      </div>

      {/* Single pane: Markdown source or rendered view */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {viewMode === 'markdown' ? (
          canEdit ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('customColumns', 'placeholder')}
              className="flex-1 w-full min-h-0 resize-none bg-transparent px-4 py-3 text-sm font-mono text-ink outline-none leading-relaxed"
              spellCheck={false}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              {displayValue.trim() ? (
                <pre className="text-sm font-mono text-ink whitespace-pre-wrap break-words leading-relaxed">
                  {displayValue}
                </pre>
              ) : (
                <span className="text-ink-faded text-sm italic">{t('customColumns', 'emptyContent')}</span>
              )}
            </div>
          )
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            {displayValue.trim() ? (
              <MarkdownContent content={displayValue} />
            ) : (
              <span className="text-ink-faded text-sm italic">{t('customColumns', 'emptyContent')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Header Cell ====================

interface CustomColumnHeaderCellProps {
  column: CustomColumn
  canEdit: boolean
  width: number
  onRename: (name: string) => void
  onDelete: () => void
  /** Optional resize handle rendered at the right edge (drag to change width). */
  resizer?: React.ReactNode
}

export function CustomColumnHeaderCell({ column, canEdit, width, onRename, onDelete, resizer }: CustomColumnHeaderCellProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(column.name)

  useEffect(() => {
    setName(column.name)
  }, [column.name])

  const handleSave = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== column.name) {
      onRename(trimmed)
    } else {
      setName(column.name)
    }
    setEditing(false)
  }

  return (
    <th
      className="bg-paper-cream z-10 border-r border-paper-lines text-left px-2 py-2 align-middle group/col relative"
      style={{ width }}
    >
      <div className="flex items-center gap-1 min-w-0 pr-1">
        {editing && canEdit ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') { setName(column.name); setEditing(false) }
            }}
            className="input-notebook text-xs font-hand min-w-0 flex-1"
            autoFocus
          />
        ) : (
          <button
            onClick={() => canEdit && setEditing(true)}
            className={cn(
              'font-hand text-xs text-ink-light truncate min-w-0 flex-1 text-left',
              canEdit && 'editable-text'
            )}
            title={canEdit ? t('customColumns', 'renameColumn') : column.name}
            disabled={!canEdit}
          >
            {column.name}
          </button>
        )}

        {canEdit && (
          <button
            onClick={() => {
              if (confirm(t('customColumns', 'deleteConfirm').replace('{name}', column.name))) {
                onDelete()
              }
            }}
            className="p-0.5 rounded opacity-0 group-hover/col:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0"
            title={t('customColumns', 'deleteColumn')}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {resizer}
    </th>
  )
}

// ==================== Add Column Button (header) ====================

interface AddColumnHeaderProps {
  width: number
  onAdd: () => void
}

export function AddColumnHeader({ width, onAdd }: AddColumnHeaderProps) {
  const { t } = useTranslation()
  return (
    <th
      className="bg-paper-cream z-10 border-l border-paper-lines text-center align-middle p-0"
      style={{ width }}
    >
      <button
        onClick={onAdd}
        className="w-full h-full flex items-center justify-center py-2 text-ink-faded hover:text-ink-blue hover:bg-paper-warm transition-colors"
        title={t('customColumns', 'addColumn')}
      >
        <Plus size={16} />
      </button>
    </th>
  )
}
