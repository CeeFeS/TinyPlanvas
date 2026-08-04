'use client'

import { forwardRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
}

/**
 * Renders user-provided Markdown safely (no raw HTML) with GFM support and
 * intuitive single-newline line breaks. Styling comes from `.markdown-body`
 * in globals.css so it adapts to the current theme.
 */
export const MarkdownContent = forwardRef<HTMLDivElement, MarkdownContentProps>(
  function MarkdownContent({ content, className }, ref) {
    return (
      <div ref={ref} className={cn('markdown-body', className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            // Open links in a new tab
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }
)
