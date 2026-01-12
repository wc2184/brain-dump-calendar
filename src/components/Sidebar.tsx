import { useState } from 'react'
import { SECTIONS } from '../types'
import { Section } from './Section'
import { useTasks } from '../hooks/useTasks'

interface Props {
  taskHook: ReturnType<typeof useTasks>
  onBrainDump: () => void
  width: number
  onResize: (width: number) => void
  isDeleteMode?: boolean
  onDeleteModeClick?: (taskId: string) => void
}

export function Sidebar({ taskHook, onBrainDump, width, onResize, isDeleteMode, onDeleteModeClick }: Props) {
  const { getTasksBySection, updateTaskDuration, removeTask, updateTaskTitle, addTask } = taskHook
  const [showAddInput, setShowAddInput] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      addTask(newTaskTitle.trim(), 30) // Default 30 min
      setNewTaskTitle('')
      setShowAddInput(false)
    }
  }

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask()
    }
    if (e.key === 'Escape') {
      setNewTaskTitle('')
      setShowAddInput(false)
    }
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(500, startWidth + e.clientX - startX))
      onResize(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div className="relative border-r border-neutral-200 bg-neutral-50 p-4 overflow-y-auto" style={{ width: `${width}px` }}>
      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors z-10"
        onMouseDown={handleResizeStart}
      />
      <button
        onClick={onBrainDump}
        className="w-full mb-4 py-2 px-4 bg-neutral-800 text-white text-sm font-medium rounded-lg hover:bg-neutral-700 transition-colors"
      >
        🧠 Brain Dump
      </button>

      {SECTIONS.map(section => (
        <div key={section.id}>
          {/* Add + button for inbox section */}
          {section.id === 'inbox' && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                <span>{section.emoji}</span>
                <span>{section.label}</span>
                {getTasksBySection(section.id).length > 0 && (
                  <span className="text-neutral-400">({getTasksBySection(section.id).length})</span>
                )}
              </div>
              <button
                onClick={() => setShowAddInput(true)}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 rounded transition-colors"
                title="Add task"
              >
                +
              </button>
            </div>
          )}
          {section.id === 'inbox' && showAddInput && (
            <div className="mb-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleAddKeyDown}
                onBlur={() => { if (!newTaskTitle.trim()) setShowAddInput(false) }}
                placeholder="New task..."
                autoFocus
                className="w-full px-2 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <Section
            section={section}
            tasks={getTasksBySection(section.id)}
            onDurationChange={updateTaskDuration}
            onDelete={removeTask}
            onTitleChange={updateTaskTitle}
            hideHeader={section.id === 'inbox'}
            isDeleteMode={isDeleteMode}
            onDeleteModeClick={onDeleteModeClick}
          />
        </div>
      ))}
    </div>
  )
}
