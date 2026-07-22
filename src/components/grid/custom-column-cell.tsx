'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Check, Plus, Pencil } from 'lucide-react'
import type { CustomColumn, CustomRowType } from '@/lib/types'
import { useTranslation } from '@/lib/language-context'
import { cn } from '@/lib/utils'
import { MarkdownContent } from '@/components/ui/markdown-content'

// ==================== Editable Cell ====================

interface CustomColumnCellProps {
  column: CustomColumn
  rowType: CustomRowType
  rowId: string
  value: string
  canEdit: boolean
  width: number
  /** subtle background tint variant for task (parent) rows */
  variant?: 'task' | 'resource'
  onSave: (value: string) => void
}

export function CustomColumnCell({
  column,
  rowType,
  rowId,
  value,
  canEdit,
  width,
  variant = 'resource',
  onSave,
}: CustomColumnCellProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)

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
          canEdit && 'cursor-text hover:bg-ink-blue/5 transition-colors'
        )}
        onClick={() => canEdit && setEditing(true)}
        title={canEdit ? t('customColumns', 'clickToEdit') : undefined}
      >
        {value ? (
          <MarkdownContent content={value} className="markdown-clamp" />
        ) : (
          canEdit && (
            <span className="text-ink-faded/60 text-xs italic inline-flex items-center gap-1">
              <Pencil size={10} /> {t('customColumns', 'empty')}
            </span>
          )
        )}
      </div>

      {editing && (
        <CustomValueEditor
          columnName={column.name}
          initialValue={value}
          onCancel={() => setEditing(false)}
          onSave={(v) => {
            onSave(v)
            setEditing(false)
          }}
        />
      )}
    </td>
  )
}

// ==================== Modal Editor ====================

interface CustomValueEditorProps {
  columnName: string
  initialValue: string
  onCancel: () => void
  onSave: (value: string) => void
}

function CustomValueEditor({ columnName, initialValue, onCancel, onSave }: CustomValueEditorProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSave(text)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="bg-surface rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.2s ease' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-paper-lines bg-paper-warm/50">
          <div>
            <h2 className="font-hand text-lg text-ink">{columnName}</h2>
            <p className="text-xs text-ink-faded">{t('customColumns', 'markdownHint')}</p>
          </div>
          <button onClick={onCancel} className="btn-icon hover:bg-red-50 hover:text-red-500">
            <X size={18} />
          </button>
        </div>

        {/* Editor + Preview */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[300px]">
          <div className="flex flex-col border-r border-paper-lines">
            <span className="px-4 py-1.5 text-[11px] uppercase tracking-wide text-ink-faded border-b border-paper-lines">
              {t('customColumns', 'editor')}
            </span>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('customColumns', 'placeholder')}
              className="flex-1 w-full resize-none bg-transparent px-4 py-3 text-sm font-mono text-ink outline-none leading-relaxed"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="px-4 py-1.5 text-[11px] uppercase tracking-wide text-ink-faded border-b border-paper-lines">
              {t('customColumns', 'preview')}
            </span>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {text.trim() ? (
                <MarkdownContent content={text} />
              ) : (
                <span className="text-ink-faded text-sm italic">{t('customColumns', 'previewEmpty')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-paper-lines bg-paper-warm/30">
          <button onClick={onCancel} className="btn-notebook text-sm">
            {t('common', 'cancel')}
          </button>
          <button onClick={() => onSave(text)} className="btn-notebook btn-notebook-primary text-sm">
            <Check size={16} />
            {t('common', 'save')}
          </button>
        </div>
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
