import { useState, useRef, useEffect } from 'react'
import { useDroppable, useDndContext } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../types'
import { DurationButtons } from './DurationButtons'

interface Props {
  task: Task
  onDurationChange: (duration: number) => void
  onDelete: () => void
  onTitleChange?: (newTitle: string) => void
  isDeleteMode?: boolean
  onDeleteModeClick?: () => void
}

export function TaskBlock({ task, onDurationChange, onDelete, onTitleChange, isDeleteMode, onDeleteModeClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { section: task.section } })

  // Also make this a droppable target for cross-section drops
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `task-drop-${task.id}`,
    data: { taskId: task.id, section: task.section }
  })

  // Get active dragged item and current drop target to check cross-section hover
  const { active, over } = useDndContext()
  const isCalendarEventDrag = active?.data?.current?.type === 'calendar-event'
  const activeSection = active?.data?.current?.section
  const isDifferentSection = active && (isCalendarEventDrag || activeSection !== task.section)

  // Check if this task is being hovered (either sortable or droppable ID)
  const isBeingHoveredOver = over?.id === task.id || over?.id === `task-drop-${task.id}`
  const showCrossSectionHighlight = isBeingHoveredOver && isDifferentSection && !isDragging

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }

  const [editing, setEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(task.title)
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // Sync titleValue when task.title changes externally
  useEffect(() => {
    setTitleValue(task.title)
  }, [task.title])

  // Close menu on click outside or ESC
  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showMenu])

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPosition({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }

  const handleSubmit = () => {
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== task.title && onTitleChange) {
      onTitleChange(trimmed)
    } else {
      setTitleValue(task.title) // Reset if empty or unchanged
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setTitleValue(task.title)
      setEditing(false)
    }
  }

  const handleRename = () => {
    setShowMenu(false)
    setEditing(true)
  }

  const handleDelete = () => {
    setShowMenu(false)
    onDelete()
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

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent text selection on shift+click in delete mode
    if (isDeleteMode && e.shiftKey) {
      e.preventDefault()
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`relative border rounded-lg p-2 shadow-sm cursor-grab ${
          isDragging ? 'opacity-50 shadow-lg' : ''
        } ${isDeleteMode && isHovering ? 'border-red-400 cursor-pointer' : 'bg-white border-neutral-200'} ${
          showCrossSectionHighlight ? 'ring-2 ring-blue-400 bg-blue-50' : ''
        }`}
        onContextMenu={handleRightClick}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        {...attributes}
        {...listeners}
      >
        {/* Delete overlay */}
        {isDeleteMode && isHovering && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-400/50 rounded-lg z-10">
            <span className="text-red-700 font-semibold text-sm">Delete</span>
          </div>
        )}
        <div className="flex items-start gap-2 mb-1.5">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-sm bg-white border border-blue-400 rounded px-1 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <span className="text-sm text-neutral-800 flex-1 line-clamp-3">
              {task.title}
            </span>
          )}
        </div>
        <DurationButtons value={task.duration} onChange={onDurationChange} />
      </div>

      {/* Context Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="fixed bg-white rounded-lg shadow-xl border border-neutral-200 z-[100] py-1 min-w-[120px]"
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          <button
            onClick={handleRename}
            className="w-full text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
          >
            <span>✏️</span> Rename
          </button>
          <button
            onClick={handleDelete}
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <span>🗑️</span> Delete
          </button>
        </div>
      )}
    </>
  )
}
