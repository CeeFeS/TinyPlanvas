'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  isBefore,
  isAfter,
  parseISO,
} from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/language-context'

interface DatePickerProps {
  value: string // ISO date string (yyyy-MM-dd)
  onChange: (value: string) => void
  label?: string
  minDate?: string
  maxDate?: string
  placeholder?: string
}

export function DatePicker({ 
  value, 
  onChange, 
  label,
  minDate,
  maxDate,
  placeholder
}: DatePickerProps) {
  const { t, dateLocale } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    return value ? parseISO(value) : new Date()
  })
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse dates
  const selectedDate = value ? parseISO(value) : null
  const minDateParsed = minDate ? parseISO(minDate) : null
  const maxDateParsed = maxDate ? parseISO(maxDate) : null

  // Weekday labels
  const weekDays = [
    t('datePicker', 'mon'),
    t('datePicker', 'tue'),
    t('datePicker', 'wed'),
    t('datePicker', 'thu'),
    t('datePicker', 'fri'),
    t('datePicker', 'sat'),
    t('datePicker', 'sun'),
  ]

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Update view date when value changes
  useEffect(() => {
    if (value) {
      setViewDate(parseISO(value))
    }
  }, [value])

  // Generate calendar days
  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const handleDayClick = (day: Date) => {
    // Check if day is within allowed range
    if (minDateParsed && isBefore(day, minDateParsed)) return
    if (maxDateParsed && isAfter(day, maxDateParsed)) return

    onChange(format(day, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  const handlePrevMonth = () => {
    setViewDate(subMonths(viewDate, 1))
  }

  const handleNextMonth = () => {
    setViewDate(addMonths(viewDate, 1))
  }

  const handlePrevYear = () => {
    setViewDate(subMonths(viewDate, 12))
  }

  const handleNextYear = () => {
    setViewDate(addMonths(viewDate, 12))
  }

  const isDayDisabled = (day: Date) => {
    if (minDateParsed && isBefore(day, minDateParsed)) return true
    if (maxDateParsed && isAfter(day, maxDateParsed)) return true
    return false
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <span className="text-xs text-ink-faded mb-1 block">{label}</span>
      )}
      
      {/* Input Field */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border-2 border-paper-lines bg-white',
          'flex items-center justify-between gap-2',
          'hover:border-ink-faded/50 focus:outline-none focus:border-ink-blue',
          'transition-colors text-left',
          isOpen && 'border-ink-blue'
        )}
      >
        <span className={cn(
          'font-mono text-sm',
          selectedDate ? 'text-ink' : 'text-ink-faded'
        )}>
          {selectedDate 
            ? format(selectedDate, 'dd.MM.yyyy', { locale: dateLocale })
            : placeholder || t('datePicker', 'selectDate')
          }
        </span>
        <Calendar size={16} className="text-ink-faded flex-shrink-0" />
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div className="bg-white rounded-lg border-2 border-paper-lines shadow-lg p-3">
            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevYear}
                  className="p-1 rounded hover:bg-paper-warm text-ink-faded hover:text-ink transition-colors"
                  title={t('datePicker', 'prevYear')}
                >
                  <ChevronLeft size={14} />
                  <ChevronLeft size={14} className="-ml-2" />
                </button>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded hover:bg-paper-warm text-ink-faded hover:text-ink transition-colors"
                  title={t('datePicker', 'prevMonth')}
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              
              <span className="font-hand text-sm text-ink font-medium">
                {format(viewDate, 'MMMM yyyy', { locale: dateLocale })}
              </span>
              
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded hover:bg-paper-warm text-ink-faded hover:text-ink transition-colors"
                  title={t('datePicker', 'nextMonth')}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleNextYear}
                  className="p-1 rounded hover:bg-paper-warm text-ink-faded hover:text-ink transition-colors"
                  title={t('datePicker', 'nextYear')}
                >
                  <ChevronRight size={14} />
                  <ChevronRight size={14} className="-ml-2" />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map((day) => (
                <div 
                  key={day} 
                  className="text-center text-[10px] font-medium text-ink-faded py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, viewDate)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isTodayDate = isToday(day)
                const isDisabled = isDayDisabled(day)

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => !isDisabled && handleDayClick(day)}
                    disabled={isDisabled}
                    className={cn(
                      'w-8 h-8 rounded-md text-xs font-mono transition-all',
                      'flex items-center justify-center',
                      !isCurrentMonth && 'text-ink-faded/40',
                      isCurrentMonth && !isSelected && !isDisabled && 'text-ink hover:bg-paper-warm',
                      isSelected && 'bg-chip-green-400 text-white font-medium',
                      isTodayDate && !isSelected && 'ring-1 ring-ink-blue ring-inset',
                      isDisabled && 'opacity-30 cursor-not-allowed'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-paper-lines">
              <button
                type="button"
                onClick={() => {
                  onChange(format(new Date(), 'yyyy-MM-dd'))
                  setIsOpen(false)
                }}
                className="text-xs text-ink-blue hover:text-ink-blue/70 transition-colors"
              >
                {t('datePicker', 'today')}
              </button>
              
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-ink-faded hover:text-ink transition-colors"
              >
                {t('datePicker', 'close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
