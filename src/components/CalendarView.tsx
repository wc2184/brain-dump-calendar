import { useState, useEffect } from 'react'
import { useDroppable, useDndMonitor } from '@dnd-kit/core'
import type { CalendarEvent as CalendarEventType } from '../types'
import { CalendarEvent } from './CalendarEvent'

interface Props {
  events: CalendarEventType[]
  visibleDates: Date[]
  centerDate: Date
  viewMode: '1day' | '3day'
  onViewChange: (mode: '1day' | '3day') => void
  isCompact: boolean
  onToggleCompact: () => void
  onEventResize?: (eventId: string, startTime: string, duration: number) => void
  onEventContextMenu?: (event: CalendarEventType, position: { x: number; y: number }) => void
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
  isDeleteMode?: boolean
  onDeleteModeClick?: (eventId: string) => void
  draggedDuration?: number // Duration in minutes of item being dragged
}

const HOUR_HEIGHT_NORMAL = 150
const HOUR_HEIGHT_COMPACT = 85
const STORAGE_KEY = 'calendar-hour-range'

// Load saved range from localStorage
function loadSavedRange(): { start: number; end: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const { start, end } = JSON.parse(saved)
      return { start: start ?? 7, end: end ?? 24 }
    }
  } catch {}
  return { start: 7, end: 24 } // Default 7am to 12am
}

// Format date as YYYY-MM-DD for droppable ID
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Check if two dates are the same day
function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

// Get events for a specific date
function getEventsForDate(events: CalendarEventType[], date: Date): CalendarEventType[] {
  return events.filter(event => {
    const eventStart = new Date(event.start)
    return isSameDay(eventStart, date)
  })
}

// Calculate layout for overlapping events
interface EventLayout {
  columnIndex: number
  totalColumns: number
}

function calculateEventLayout(events: CalendarEventType[]): Map<string, EventLayout> {
  if (events.length === 0) return new Map()

  // Sort by start time, then by duration descending (longest first for leftmost)
  const sorted = [...events].sort((a, b) => {
    const startDiff = new Date(a.start).getTime() - new Date(b.start).getTime()
    if (startDiff !== 0) return startDiff
    // Same start → longer duration first (leftmost)
    const durA = new Date(a.end).getTime() - new Date(a.start).getTime()
    const durB = new Date(b.end).getTime() - new Date(b.start).getTime()
    return durB - durA
  })

  // Track which events overlap with each other
  const overlapsWithEvent = new Map<string, Set<string>>()
  sorted.forEach(e => overlapsWithEvent.set(e.id, new Set()))

  // Find all overlapping pairs
  for (let i = 0; i < sorted.length; i++) {
    const eventA = sorted[i]
    const startA = new Date(eventA.start).getTime()
    const endA = new Date(eventA.end).getTime()

    for (let j = i + 1; j < sorted.length; j++) {
      const eventB = sorted[j]
      const startB = new Date(eventB.start).getTime()
      const endB = new Date(eventB.end).getTime()

      // Check if they overlap
      if (startB < endA && startA < endB) {
        overlapsWithEvent.get(eventA.id)!.add(eventB.id)
        overlapsWithEvent.get(eventB.id)!.add(eventA.id)
      }
    }
  }

  // Find connected components (overlap groups)
  const visited = new Set<string>()
  const groups: CalendarEventType[][] = []

  for (const event of sorted) {
    if (visited.has(event.id)) continue

    const group: CalendarEventType[] = []
    const stack = [event]

    while (stack.length > 0) {
      const current = stack.pop()!
      if (visited.has(current.id)) continue
      visited.add(current.id)
      group.push(current)

      for (const overlappingId of overlapsWithEvent.get(current.id)!) {
        const overlappingEvent = sorted.find(e => e.id === overlappingId)
        if (overlappingEvent && !visited.has(overlappingId)) {
          stack.push(overlappingEvent)
        }
      }
    }

    if (group.length > 0) {
      groups.push(group)
    }
  }

  const result = new Map<string, EventLayout>()

  // Assign columns within each group
  for (const group of groups) {
    // Sort group by start time, then duration desc
    group.sort((a, b) => {
      const startDiff = new Date(a.start).getTime() - new Date(b.start).getTime()
      if (startDiff !== 0) return startDiff
      const durA = new Date(a.end).getTime() - new Date(a.start).getTime()
      const durB = new Date(b.end).getTime() - new Date(b.start).getTime()
      return durB - durA
    })

    // Greedy column assignment
    const columns: { end: number }[] = []

    for (const event of group) {
      const eventStart = new Date(event.start).getTime()
      const eventEnd = new Date(event.end).getTime()

      // Find first available column
      let assignedCol = -1
      for (let col = 0; col < columns.length; col++) {
        if (columns[col].end <= eventStart) {
          columns[col].end = eventEnd
          assignedCol = col
          break
        }
      }

      if (assignedCol === -1) {
        assignedCol = columns.length
        columns.push({ end: eventEnd })
      }

      result.set(event.id, { columnIndex: assignedCol, totalColumns: 0 })
    }

    // Set totalColumns for all events in this group
    const totalCols = columns.length
    for (const event of group) {
      const layout = result.get(event.id)!
      layout.totalColumns = totalCols
    }
  }

  return result
}

// Format day header
function formatDayHeader(date: Date, today: Date): string {
  if (isSameDay(date, today)) {
    return `Today — ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
  }
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(date, yesterday)) {
    return `Yesterday — ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
  }
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (isSameDay(date, tomorrow)) {
    return `Tomorrow — ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function CalendarView({
  events,
  visibleDates,
  centerDate,
  viewMode,
  onViewChange,
  isCompact,
  onToggleCompact,
  onEventResize,
  onEventContextMenu,
  onPrevDay,
  onNextDay,
  onToday,
  isDeleteMode,
  onDeleteModeClick,
  draggedDuration
}: Props) {
  const [hourRange, setHourRange] = useState(loadSavedRange)
  const [currentTime, setCurrentTime] = useState(() => new Date())

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Save to localStorage when range changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ start: hourRange.start, end: hourRange.end }))
  }, [hourRange])

  const HOUR_HEIGHT = isCompact ? HOUR_HEIGHT_COMPACT : HOUR_HEIGHT_NORMAL
  const hours = Array.from({ length: hourRange.end - hourRange.start }, (_, i) => hourRange.start + i)
  const today = new Date()
  const isViewingToday = isSameDay(centerDate, today)

  // Hour options for dropdowns
  const hourOptions = Array.from({ length: 24 }, (_, i) => i)

  // Track hovered timeslot for duration preview
  const [hoveredSlot, setHoveredSlot] = useState<{ dateKey: string; hour: number; minute: number } | null>(null)

  useDndMonitor({
    onDragOver(event) {
      const overId = event.over?.id?.toString()
      if (overId?.startsWith('timeslot-')) {
        // Parse: timeslot-YYYY-MM-DD-HH-MM
        const parts = overId.split('-')
        const dateKey = `${parts[1]}-${parts[2]}-${parts[3]}`
        const hour = parseInt(parts[4])
        const minute = parseInt(parts[5])
        setHoveredSlot({ dateKey, hour, minute })
      } else {
        setHoveredSlot(null)
      }
    },
    onDragEnd() {
      setHoveredSlot(null)
    },
    onDragCancel() {
      setHoveredSlot(null)
    }
  })

  return (
    <div className="flex-1 bg-white flex flex-col overflow-hidden">
      {/* Navigation Header */}
      <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-2 z-10 flex items-center justify-between">
        <button
          onClick={onPrevDay}
          className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600"
          title="Previous day"
        >
          ◀
        </button>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex gap-1 bg-neutral-100 rounded-lg p-0.5">
            <button
              onClick={() => onViewChange('1day')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === '1day' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => onViewChange('3day')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === '3day' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              3 Day
            </button>
          </div>

          {!isViewingToday && (
            <button
              onClick={onToday}
              className="px-3 py-1 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-700"
            >
              Today
            </button>
          )}

          {/* Hour Range Selector */}
          <div className="flex items-center gap-1 text-sm text-neutral-600">
            <select
              value={hourRange.start}
              onChange={(e) => setHourRange(prev => ({ ...prev, start: parseInt(e.target.value) }))}
              className="px-2 py-1 bg-neutral-100 rounded border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {hourOptions.filter(h => h < hourRange.end).map(h => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
            <span>-</span>
            <select
              value={hourRange.end}
              onChange={(e) => setHourRange(prev => ({ ...prev, end: parseInt(e.target.value) }))}
              className="px-2 py-1 bg-neutral-100 rounded border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {hourOptions.filter(h => h > hourRange.start).map(h => (
                <option key={h} value={h}>{h === 24 ? '12am' : formatHour(h)}</option>
              ))}
              <option value={24}>12am</option>
            </select>
          </div>

          {/* Compact Toggle */}
          <button
            onClick={onToggleCompact}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              isCompact ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
            title="Toggle compact view (c)"
          >
            {isCompact ? 'Expand' : 'Compact'}
          </button>
        </div>

        <button
          onClick={onNextDay}
          className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600"
          title="Next day"
        >
          ▶
        </button>
      </div>

      {/* Day Headers */}
      <div className="flex border-b border-neutral-200">
        <div className="w-12 shrink-0" /> {/* Spacer for time column */}
        {visibleDates.map((date) => (
          <div
            key={formatDateKey(date)}
            className={`flex-1 text-center py-2 text-sm font-medium border-l border-neutral-100 first:border-l-0 ${
              isSameDay(date, today) ? 'bg-blue-50 text-blue-700' : 'text-neutral-600'
            }`}
          >
            {formatDayHeader(date, today)}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Time Labels Column */}
        <div className="w-12 shrink-0 relative" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
          {hours.map(hour => (
            <div
              key={hour}
              className="absolute left-0 right-0"
              style={{ top: `${(hour - hourRange.start) * HOUR_HEIGHT}px` }}
            >
              <span className="absolute right-2 top-0 -translate-y-1/2 text-xs text-neutral-400 bg-white px-1">
                {formatHour(hour)}
              </span>
            </div>
          ))}
          {/* Current time indicator label */}
          {(() => {
            const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60
            if (currentHour >= hourRange.start && currentHour < hourRange.end) {
              const top = (currentHour - hourRange.start) * HOUR_HEIGHT
              const timeStr = currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              return (
                <div
                  className="absolute left-0 right-0 z-20"
                  style={{ top: `${top}px` }}
                >
                  <span className="absolute right-1 top-0 -translate-y-1/2 text-[10px] text-red-500 bg-white px-0.5 font-medium">
                    {timeStr}
                  </span>
                </div>
              )
            }
            return null
          })()}
        </div>

        {/* Day Columns */}
        {visibleDates.map((date) => {
          const dateKey = formatDateKey(date)
          const dayEvents = getEventsForDate(events, date)
          const eventLayout = calculateEventLayout(dayEvents)

          return (
            <div
              key={dateKey}
              className="flex-1 relative border-l border-neutral-100 first:border-l-0"
              style={{ height: `${hours.length * HOUR_HEIGHT}px` }}
            >
              {/* Time Slots - 15 min increments */}
              {hours.map(hour => (
                [0, 15, 30, 45].map(minute => (
                  <TimeSlot
                    key={`${dateKey}-${hour}-${minute}`}
                    dateKey={dateKey}
                    hour={hour}
                    minute={minute}
                    hourHeight={HOUR_HEIGHT}
                    displayStartHour={hourRange.start}
                    hideDragHighlight={!!draggedDuration}
                  />
                ))
              ))}

              {/* Events */}
              {dayEvents.map(event => {
                const layout = eventLayout.get(event.id) || { columnIndex: 0, totalColumns: 1 }
                return (
                  <CalendarEvent
                    key={event.id}
                    event={event}
                    hourHeight={HOUR_HEIGHT}
                    displayStartHour={hourRange.start}
                    columnIndex={layout.columnIndex}
                    totalColumns={layout.totalColumns}
                    onResize={onEventResize}
                    onContextMenu={onEventContextMenu}
                    isDeleteMode={isDeleteMode}
                    onDeleteModeClick={() => onDeleteModeClick?.(event.id)}
                  />
                )
              })}

              {/* Current time line for today */}
              {isSameDay(date, currentTime) && (() => {
                const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60
                if (currentHour >= hourRange.start && currentHour < hourRange.end) {
                  const top = (currentHour - hourRange.start) * HOUR_HEIGHT
                  return (
                    <div
                      className="absolute left-0 right-0 h-1 bg-red-300/40 z-10 pointer-events-none"
                      style={{ top: `${top}px` }}
                    />
                  )
                }
                return null
              })()}

              {/* Duration preview overlay when dragging */}
              {hoveredSlot && hoveredSlot.dateKey === dateKey && draggedDuration && (() => {
                const startHour = hoveredSlot.hour + hoveredSlot.minute / 60
                const top = (startHour - hourRange.start) * HOUR_HEIGHT
                const height = (draggedDuration / 60) * HOUR_HEIGHT
                return (
                  <div
                    className="absolute left-1 right-1 bg-blue-400/30 border-2 border-blue-400 rounded-md pointer-events-none z-20"
                    style={{ top: `${top}px`, height: `${height}px` }}
                  />
                )
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 || 12
  return `${hour12}${ampm}`
}

function TimeSlot({ dateKey, hour, minute, hourHeight, displayStartHour, hideDragHighlight }: { dateKey: string; hour: number; minute: number; hourHeight: number; displayStartHour: number; hideDragHighlight?: boolean }) {
  // Droppable ID format: timeslot-YYYY-MM-DD-HH-MM
  const { setNodeRef, isOver } = useDroppable({ id: `timeslot-${dateKey}-${hour}-${minute}` })

  const slotHeight = hourHeight / 4 // 15 minutes = 1/4 hour
  // Only show default highlight if duration preview isn't active
  const showHighlight = isOver && !hideDragHighlight

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 transition-colors ${
        minute === 0 ? 'border-t border-neutral-100' : ''
      } ${showHighlight ? 'bg-blue-200 ring-2 ring-blue-400 ring-inset' : ''}`}
      style={{
        top: `${(hour - displayStartHour) * hourHeight + (minute / 60) * hourHeight}px`,
        height: `${slotHeight}px`
      }}
    />
  )
}

