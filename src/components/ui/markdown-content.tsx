'use client'

import { forwardRef } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
}

// While the renderer is in flight the raw text is shown, so the cell has its
// content (and roughly its height) immediately instead of flashing empty.
const MarkdownRenderer = dynamic(
  () => import('./markdown-renderer').then((m) => m.MarkdownRenderer),
  {
    ssr: false,
    loading: () => null,
  }
)

/**
 * Renders user-provided Markdown safely (no raw HTML) with GFM support and
 * intuitive single-newline line breaks. Styling comes from `.markdown-body`
 * in globals.css so it adapts to the current theme.
 */
export const MarkdownContent = forwardRef<HTMLDivElement, MarkdownContentProps>(
  function MarkdownContent({ content, className }, ref) {
    return (
      <div ref={ref} className={cn('markdown-body', className)}>
        <MarkdownRenderer content={content} />
      </div>
    )
  }
)
