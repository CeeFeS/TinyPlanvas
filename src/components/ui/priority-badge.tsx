'use client'

import { Flag } from 'lucide-react'
import type { Priority } from '@/lib/types'
import { getPriorityMeta, getPriorityBadgeStyle } from '@/lib/priority'
import { useTranslation } from '@/lib/language-context'
import { cn } from '@/lib/utils'

interface PriorityBadgeProps {
  priority?: Priority | null
  size?: 'sm' | 'md'
  className?: string
  showIcon?: boolean
}

export function PriorityBadge({ priority, size = 'sm', className, showIcon = true }: PriorityBadgeProps) {
  const { t } = useTranslation()
  const meta = getPriorityMeta(priority)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className
      )}
      style={getPriorityBadgeStyle(priority)}
    >
      {showIcon ? (
        <Flag size={size === 'sm' ? 11 : 13} />
      ) : (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: meta.color }}
        />
      )}
      {t('priorities', meta.labelKey)}
    </span>
  )
}
