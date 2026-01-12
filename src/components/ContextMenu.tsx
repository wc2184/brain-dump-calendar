import { useState, useEffect, useRef } from 'react'
import type { CalendarEvent } from '../types'
import { GOOGLE_CALENDAR_COLORS, DURATIONS } from '../types'

// Helper to format time for input
function formatTimeInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

interface Props {
  isOpen: boolean
  position: { x: number; y: number }
  event: CalendarEvent | null
  hasLinkedTask: boolean
  onClose: () => void
  onColorChange: (colorId: string) => void
  onRename: (newTitle: string) => void
  onDurationChange: (duration: number) => void
  onTimeChange?: (startTime: string, endTime: string) => void
  onReturnToInbox: () => void
}

export function ContextMenu({
  isOpen,
  position,
  event,
  hasLinkedTask,
  onClose,
  onColorChange,
  onRename,
  onDurationChange,
  onTimeChange,
  onReturnToInbox,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [customStartTime, setCustomStartTime] = useState('')
  const [customEndTime, setCustomEndTime] = useState('')

  // Position adjustment to keep menu in viewport
  const adjustedPosition = (() => {
    const menuWidth = 260
    const menuHeight = 320 // Increased for custom time section

    let x = position.x
    let y = position.y

    // Clamp to right edge
    if (x + menuWidth > window.innerWidth - 10) {
      x = window.innerWidth - menuWidth - 10
    }

    // Clamp to left edge
    if (x < 10) x = 10

    // Clamp to bottom edge - flip upward if needed
    if (y + menuHeight > window.innerHeight - 10) {
      y = position.y - menuHeight // Show above cursor
      if (y < 10) y = 10 // But don't go off top
    }

    return { x, y }
  })()

  // Reset editing state when menu opens/closes or event changes
  useEffect(() => {
    if (isOpen && event) {
      setTitleValue(event.title)
      setEditingTitle(false)
      setCustomStartTime(formatTimeInput(event.start))
      setCustomEndTime(formatTimeInput(event.end))
    }
  }, [isOpen, event])

  // Focus input when editing starts
  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTitle])

  // Close on ESC or click outside
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTitle) {
          setEditingTitle(false)
        } else {
          onClose()
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, editingTitle, onClose])

  if (!isOpen || !event) return null

  const handleTitleSubmit = () => {
    if (titleValue.trim() && titleValue !== event.title) {
      onRename(titleValue.trim())
    }
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleSubmit()
    }
  }

  // Calculate current duration in minutes
  const currentDuration = event ? Math.round(
    (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
  ) : 30

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-xl border border-neutral-200 z-[100] w-[260px]"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {/* Color Picker */}
      <div className="p-3 border-b border-neutral-100">
        <div className="flex flex-wrap gap-2">
          {GOOGLE_CALENDAR_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => onColorChange(color.id)}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
              style={{ backgroundColor: color.hex }}
              title={color.name}
            >
              {event.colorId === color.id && (
                <span className="text-white text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Title Editor */}
      <div className="p-3 border-b border-neutral-100">
        {editingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={handleTitleKeyDown}
            className="w-full px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="w-full text-left text-sm text-neutral-700 hover:bg-neutral-50 px-2 py-1 rounded truncate"
          >
            {event.title}
          </button>
        )}
      </div>

      {/* Duration Picker */}
      <div className="p-3 border-b border-neutral-100">
        <label className="text-xs text-neutral-500 block mb-1">Duration</label>
        <select
          value={currentDuration}
          onChange={(e) => onDurationChange(parseInt(e.target.value))}
          className="w-full px-2 py-1 text-sm border border-neutral-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DURATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label} min
            </option>
          ))}
        </select>
      </div>

      {/* Custom Time */}
      {onTimeChange && (
        <div className="p-3 border-b border-neutral-100">
          <label className="text-xs text-neutral-500 block mb-1">Custom Time</label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={customStartTime}
              onChange={(e) => setCustomStartTime(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-neutral-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-neutral-400 text-sm">→</span>
            <input
              type="time"
              value={customEndTime}
              onChange={(e) => setCustomEndTime(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-neutral-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                onTimeChange(customStartTime, customEndTime)
                onClose()
              }}
              className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Set
            </button>
          </div>
        </div>
      )}

      {/* Return to Inbox - only if linked to task */}
      {hasLinkedTask && (
        <div className="p-2">
          <button
            onClick={onReturnToInbox}
            className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded flex items-center gap-2"
          >
            <span>📥</span>
            <span>Return to Inbox</span>
          </button>
        </div>
      )}
    </div>
  )
}
