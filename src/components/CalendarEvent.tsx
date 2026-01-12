import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { CalendarEvent as CalendarEventType } from '../types'
import { GOOGLE_CALENDAR_COLORS } from '../types'

interface Props {
  event: CalendarEventType
  hourHeight: number
  displayStartHour?: number
  columnIndex?: number
  totalColumns?: number
  onResize?: (eventId: string, startTime: string, duration: number) => void
  onContextMenu?: (event: CalendarEventType, position: { x: number; y: number }) => void
  isDeleteMode?: boolean
  onDeleteModeClick?: () => void
}

export function CalendarEvent({ event, hourHeight, displayStartHour = 0, columnIndex = 0, totalColumns = 1, onResize, onContextMenu, isDeleteMode, onDeleteModeClick }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-${event.id}`,
    data: { type: 'calendar-event', event }
  })

  const start = new Date(event.start)
  const end = new Date(event.end)
  const durationMins = (end.getTime() - start.getTime()) / 60000
  const startHour = start.getHours() + start.getMinutes() / 60

  const baseTop = (startHour - displayStartHour) * hourHeight
  // True height based on duration with 2px gap at bottom
  const baseHeight = (durationMins / 60) * hourHeight - 2

  const [isHovering, setIsHovering] = useState(false)

  // Real-time resize preview state
  const [resizePreview, setResizePreview] = useState<{
    top: number
    height: number
    edge: 'top' | 'bottom'
    initialY: number
    initialTop: number
    initialHeight: number
  } | null>(null)

  // Use preview values when resizing, otherwise use base values
  const displayTop = resizePreview?.top ?? baseTop
  const displayHeight = resizePreview?.height ?? baseHeight

  // Get event color - default to Peacock (#039BE5)
  const getEventStyle = () => {
    if (event.colorId) {
      const color = GOOGLE_CALENDAR_COLORS.find(c => c.id === event.colorId)
      return {
        backgroundColor: color?.hex || '#039BE5',
        color: '#FFFFFF'
      }
    }
    // Default to Peacock for all events
    return { backgroundColor: '#039BE5', color: '#FFFFFF' }
  }

  const eventStyle = getEventStyle()

  // Calculate horizontal position for overlapping events
  const leftOffset = 4 // small padding, time labels in separate column
  const gap = 2 // gap between overlapping events
  const horizontalStyle = totalColumns > 1
    ? {
        width: `calc((100% - 8px) / ${totalColumns} - ${gap}px)`,
        left: `calc(${leftOffset}px + ${columnIndex} * (100% - 8px) / ${totalColumns})`
      }
    : {
        left: `${leftOffset}px`,
        right: '4px'
      }

  const handleMouseDown = (e: React.MouseEvent, edge: 'top' | 'bottom') => {
    if (!onResize) return
    e.preventDefault()
    e.stopPropagation()

    const initialY = e.clientY
    const actualBaseHeight = (durationMins / 60) * hourHeight - 2

    // Initialize preview with current position
    setResizePreview({
      top: baseTop,
      height: actualBaseHeight,
      edge,
      initialY,
      initialTop: baseTop,
      initialHeight: actualBaseHeight
    })

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - initialY
      const deltaHours = delta / hourHeight
      const deltaMins = Math.round(deltaHours * 60 / 15) * 15
      const deltaPx = (deltaMins / 60) * hourHeight

      let newTop = baseTop
      let newHeight = actualBaseHeight

      if (edge === 'top') {
        newTop = baseTop + deltaPx
        newHeight = actualBaseHeight - deltaPx
      } else {
        newHeight = actualBaseHeight + deltaPx
      }

      // Ensure minimum height of 15 minutes (minus 2px gap)
      const minHeight = (15 / 60) * hourHeight - 2
      if (newHeight >= minHeight) {
        setResizePreview(prev => prev ? {
          ...prev,
          top: newTop,
          height: newHeight
        } : null)
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      const delta = e.clientY - initialY
      const deltaHours = delta / hourHeight
      const deltaMins = Math.round(deltaHours * 60 / 15) * 15

      if (deltaMins !== 0) {
        let newStart = new Date(event.start)
        let newDuration = durationMins

        if (edge === 'top') {
          newStart = new Date(start.getTime() + deltaMins * 60000)
          newDuration = durationMins - deltaMins
        } else {
          newDuration = durationMins + deltaMins
        }

        if (newDuration >= 15) {
          onResize(event.id, newStart.toISOString(), newDuration)
        }
      }

      cleanup()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup()
      }
    }

    const cleanup = () => {
      setResizePreview(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
  }

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (onContextMenu) {
      onContextMenu(event, { x: e.clientX, y: e.clientY })
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isDeleteMode && onDeleteModeClick) {
      e.preventDefault()
      e.stopPropagation()
      // Clear any text selection caused by shift+click
      window.getSelection()?.removeAllRanges()
      onDeleteModeClick()
    }
  }

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // Prevent text selection on shift+click in delete mode
    if (isDeleteMode && e.shiftKey) {
      e.preventDefault()
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`absolute rounded-md px-2 py-1 text-xs overflow-hidden hover:opacity-90 ${
        resizePreview ? 'opacity-80 shadow-lg' : ''
      } ${isDragging ? 'opacity-50 shadow-xl z-50' : ''} ${isDeleteMode ? 'cursor-pointer' : 'cursor-grab'}`}
      style={{
        top: `${displayTop}px`,
        height: `${displayHeight}px`,
        backgroundColor: isDeleteMode && isHovering ? '#ef4444' : eventStyle.backgroundColor,
        color: eventStyle.color,
        ...horizontalStyle
      }}
      onContextMenu={handleRightClick}
      onClick={handleClick}
      onMouseDown={handleContainerMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      {...attributes}
      {...listeners}
    >
      {/* Delete overlay */}
      {isDeleteMode && isHovering && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500 rounded-md z-10">
          <span className="text-white font-semibold text-xs">Delete</span>
        </div>
      )}
      {/* Resize handles - now available for ALL events */}
      {onResize && (
        <div
          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10"
          onMouseDown={(e) => handleMouseDown(e, 'top')}
        />
      )}
      <div className="font-medium truncate">{event.title}</div>
      <div className="text-[10px] opacity-75">
        {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        {' - '}
        {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </div>
      {onResize && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10"
          onMouseDown={(e) => handleMouseDown(e, 'bottom')}
        />
      )}
    </div>
  )
}
