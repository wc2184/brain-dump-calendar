import { DndContext, DragOverlay, pointerWithin, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTasks } from './hooks/useTasks'
import { useCalendar } from './hooks/useCalendar'
import { useBrainDump } from './hooks/useBrainDump'
import { LoginScreen } from './components/LoginScreen'
import { Sidebar } from './components/Sidebar'
import { CalendarView } from './components/CalendarView'
import { BrainDumpModal } from './components/BrainDumpModal'
import { ContextMenu } from './components/ContextMenu'
import { TaskBlock } from './components/TaskBlock'
import { ReflectionLink } from './components/ReflectionLink'
import { UndoToast } from './components/UndoToast'
import { HelpModal } from './components/HelpModal'
import { useReflectionLink } from './hooks/useReflectionLink'
import { SECTIONS } from './types'
import type { Task, CalendarEvent } from './types'

interface DeletedItem {
  type: 'task' | 'event'
  data: Task | CalendarEvent
}

function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const taskHook = useTasks(user?.id)
  const calendarHook = useCalendar(user?.id)
  const reflectionLink = useReflectionLink()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(750) // ~3x original width

  // Delete mode state
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([])
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteModeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Help modal state
  const [showHelp, setShowHelp] = useState(false)

  // Sensor with distance activation - requires 5px movement to start drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  // Context menu state for calendar events
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    position: { x: number; y: number }
    event: CalendarEvent | null
  }>({ isOpen: false, position: { x: 0, y: 0 }, event: null })

  // Track modal state in a ref so shift detection can check it
  const modalOpenRef = useRef(false)

  // Shift key detection for delete mode (with 0.75s delay)
  useEffect(() => {
    const isInInputOrModal = () => {
      const activeEl = document.activeElement
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement
      return isInput || modalOpenRef.current
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        // Don't activate in modals or inputs
        if (isInInputOrModal()) return

        // Clear any existing timeout
        if (deleteModeTimeoutRef.current) {
          clearTimeout(deleteModeTimeoutRef.current)
        }

        // Start 0.4s delay before activating delete mode
        deleteModeTimeoutRef.current = setTimeout(() => {
          // Double-check we're still not in modal/input when timeout fires
          if (!isInInputOrModal()) {
            setIsDeleteMode(true)
          }
        }, 400)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        // Clear pending timeout
        if (deleteModeTimeoutRef.current) {
          clearTimeout(deleteModeTimeoutRef.current)
          deleteModeTimeoutRef.current = null
        }
        setIsDeleteMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (deleteModeTimeoutRef.current) {
        clearTimeout(deleteModeTimeoutRef.current)
      }
    }
  }, [])

  // Undo stack helpers
  const addToUndoStack = (item: DeletedItem) => {
    setDeletedItems(prev => [...prev, item])
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    undoTimeoutRef.current = setTimeout(() => setDeletedItems([]), 10000)
  }

  const undoLast = async () => {
    if (deletedItems.length === 0) return
    const lastItem = deletedItems[deletedItems.length - 1]

    if (lastItem.type === 'task') {
      await taskHook.restoreTask(lastItem.data as Task)
    } else {
      // For events, we need to restore to calendar
      // This will create a new event in Google Calendar
      await calendarHook.restoreEvent(lastItem.data as CalendarEvent)
    }

    setDeletedItems(prev => prev.slice(0, -1))
    // Reset the timeout
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    if (deletedItems.length > 1) {
      undoTimeoutRef.current = setTimeout(() => setDeletedItems([]), 10000)
    }
  }

  const dismissUndo = () => {
    setDeletedItems([])
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
  }

  // Delete mode handlers
  const handleDeleteModeTask = async (taskId: string) => {
    const task = taskHook.tasks.find(t => t.id === taskId)
    if (task) {
      addToUndoStack({ type: 'task', data: task })
      await taskHook.removeTask(taskId)
    }
  }

  const handleDeleteModeEvent = async (eventId: string) => {
    const event = calendarHook.events.find(e => e.id === eventId)
    if (event) {
      addToUndoStack({ type: 'event', data: event })
      await calendarHook.removeEvent(eventId)
    }
  }

  const handleClearAllTasks = async () => {
    const allTasks = taskHook.tasks.filter(t => !t.scheduled)
    if (allTasks.length === 0) return

    // Add all tasks to undo stack
    for (const task of allTasks) {
      addToUndoStack({ type: 'task', data: task })
    }

    // Delete all tasks
    for (const task of allTasks) {
      await taskHook.removeTask(task.id)
    }
  }

  const handleTasksCreated = async (newTasks: { title: string; duration: number }[]) => {
    for (const t of newTasks) {
      await taskHook.addTask(t.title, t.duration)
    }
  }

  const brainDump = useBrainDump(handleTasksCreated)

  // Sync modal state to ref for shift detection
  useEffect(() => {
    modalOpenRef.current = brainDump.isOpen || contextMenu.isOpen || showHelp
  }, [brainDump.isOpen, contextMenu.isOpen, showHelp])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case 'n':
          calendarHook.goToNextDay()
          break
        case 'p':
          calendarHook.goToPrevDay()
          break
        case 'd':
          calendarHook.setViewMode('1day')
          break
        case '3':
          calendarHook.setViewMode('3day')
          break
        case 't':
          calendarHook.goToToday()
          break
        case 'c':
          calendarHook.toggleCompact()
          break
        case 'b':
          e.preventDefault()
          brainDump.open()
          break
        case '?':
          setShowHelp(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [calendarHook, brainDump])

  const handleDragStart = (dragEvent: DragStartEvent) => {
    const activeId = dragEvent.active.id as string

    // Check if dragging a calendar event
    if (activeId.startsWith('event-')) {
      const eventData = dragEvent.active.data.current
      if (eventData?.event) {
        setActiveEvent(eventData.event as CalendarEvent)
        setActiveTask(null)
        return
      }
    }

    // Otherwise, check if dragging a task
    const task = taskHook.tasks.find(t => t.id === activeId)
    if (task) {
      setActiveTask(task)
      setActiveEvent(null)
    }
  }

  const handleDragEnd = async (dragEvent: DragEndEvent) => {
    setActiveTask(null)
    setActiveEvent(null)
    const { active, over } = dragEvent
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Handle calendar event drag
    if (activeId.startsWith('event-')) {
      const eventData = active.data.current
      if (!eventData?.event) return
      const calEvent = eventData.event as CalendarEvent

      // Dropping event on a timeslot - move within calendar (OPTIMISTIC)
      if (overId.startsWith('timeslot-')) {
        const parts = overId.split('-')
        // parts: ['timeslot', 'YYYY', 'MM', 'DD', 'HH', 'MM']
        const year = parseInt(parts[1])
        const month = parseInt(parts[2]) - 1 // JS months are 0-indexed
        const day = parseInt(parts[3])
        const hour = parseInt(parts[4])
        const minute = parseInt(parts[5])
        const dropDate = new Date(year, month, day, hour, minute, 0, 0)

        // Calculate duration from original event
        const originalStart = new Date(calEvent.start)
        const originalEnd = new Date(calEvent.end)
        const duration = (originalEnd.getTime() - originalStart.getTime()) / 60000

        // Optimistic update - UI updates immediately
        calendarHook.updateEventOptimistic(calEvent.id, {
          startTime: dropDate.toISOString(),
          duration
        })
        return
      }

      // Dropping event on a sidebar section or task - return to sidebar
      const targetSectionId = SECTIONS.find(s => s.id === overId)?.id
      const targetTaskMatch = overId.match(/^task-drop-(.+)$/)
      const targetTaskId = targetTaskMatch ? targetTaskMatch[1] : (taskHook.tasks.find(t => t.id === overId)?.id)
      const targetTask = targetTaskId ? taskHook.tasks.find(t => t.id === targetTaskId) : null

      const dropSection = targetSectionId || targetTask?.section
      if (dropSection) {
        // Find the linked task - check both taskId and google_id
        const linkedTask = taskHook.tasks.find(t =>
          (calEvent.taskId && t.id === calEvent.taskId) ||
          t.google_id === calEvent.id
        )

        // Get position BEFORE any state changes
        const sectionTasks = taskHook.getTasksBySection(dropSection)
        const dropPosition = sectionTasks.length

        // OPTIMISTIC: Remove event from calendar immediately
        calendarHook.removeEventOptimistic(calEvent.id)

        if (linkedTask) {
          // Existing task: optimistic unschedule + move to drop section
          taskHook.unscheduleAndMoveTask(
            linkedTask.id,
            dropSection,
            dropPosition,
            // Rollback: restore calendar event if API fails
            () => calendarHook.addEvent(calEvent)
          )
        } else {
          // External calendar event: create new task from it
          const duration = Math.round((new Date(calEvent.end).getTime() - new Date(calEvent.start).getTime()) / 60000)
          taskHook.addTask(calEvent.title, duration, dropSection)
        }
        return
      }
      return
    }

    // Handle task drag
    const taskId = activeId

    // Dropping on a time slot (format: timeslot-YYYY-MM-DD-HH-MM) - OPTIMISTIC
    if (overId.startsWith('timeslot-')) {
      const parts = overId.split('-')
      // parts: ['timeslot', 'YYYY', 'MM', 'DD', 'HH', 'MM']
      const year = parseInt(parts[1])
      const month = parseInt(parts[2]) - 1 // JS months are 0-indexed
      const day = parseInt(parts[3])
      const hour = parseInt(parts[4])
      const minute = parseInt(parts[5])
      const dropDate = new Date(year, month, day, hour, minute, 0, 0)

      // Optimistic update - show event immediately, sync in background
      const result = taskHook.scheduleTaskOptimistic(
        taskId,
        dropDate.toISOString(),
        (tempId, realEvent) => calendarHook.replaceEvent(tempId, realEvent),
        (tempId) => calendarHook.removeEventLocal(tempId) // rollback on failure
      )
      if (result?.tempEvent) {
        calendarHook.addEvent(result.tempEvent)
      }
      return
    }

    // Dropping on a section or another task
    const targetSection = SECTIONS.find(s => s.id === overId)?.id
    const targetTask = taskHook.tasks.find(t => t.id === overId)

    // Handle cross-section drop on task (task-drop-{id} pattern)
    const taskDropMatch = overId.match(/^task-drop-(.+)$/)
    const crossSectionTargetTask = taskDropMatch ? taskHook.tasks.find(t => t.id === taskDropMatch[1]) : null

    if (targetSection) {
      // Use Infinity to ensure we append to the very end (insertIndex will be -1)
      await taskHook.moveTask(taskId, targetSection, Infinity)
    } else if (targetTask) {
      // Same-section reorder via sortable
      const draggedTask = taskHook.tasks.find(t => t.id === taskId)
      if (draggedTask && draggedTask.section === targetTask.section) {
        // Same section reorder
        // When dragging DOWN, use position+1 to insert AFTER target
        // When dragging UP, use target position to insert AT target
        const newPosition = draggedTask.position < targetTask.position
          ? targetTask.position + 1  // dragging down: insert after target
          : targetTask.position      // dragging up: insert at target position
        await taskHook.moveTask(taskId, targetTask.section, newPosition)
      } else {
        await taskHook.moveTask(taskId, targetTask.section, targetTask.position)
      }
    } else if (crossSectionTargetTask) {
      // Cross-section drop on a task - move to that section at target position
      const draggedTask = taskHook.tasks.find(t => t.id === taskId)
      if (draggedTask && draggedTask.section !== crossSectionTargetTask.section) {
        await taskHook.moveTask(taskId, crossSectionTargetTask.section, crossSectionTargetTask.position)
      }
    }
  }

  // Event resize handler - optimistic update
  const handleEventResize = (eventId: string, startTime: string, duration: number) => {
    calendarHook.updateEventOptimistic(eventId, { startTime, duration })
  }

  // Context menu handlers
  const handleEventContextMenu = (event: CalendarEvent, position: { x: number; y: number }) => {
    setContextMenu({ isOpen: true, position, event })
  }

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, event: null })
  }

  const handleColorChange = async (colorId: string) => {
    if (!contextMenu.event) return
    await calendarHook.updateEvent(contextMenu.event.id, { colorId })
    closeContextMenu()
  }

  const handleRename = async (newTitle: string) => {
    if (!contextMenu.event) return
    await calendarHook.updateEvent(contextMenu.event.id, { title: newTitle })
    closeContextMenu()
  }

  const handleDurationChange = async (duration: number) => {
    if (!contextMenu.event) return
    await calendarHook.updateEvent(contextMenu.event.id, {
      startTime: contextMenu.event.start,
      duration
    })
    closeContextMenu()
  }

  const handleTimeChange = async (startTime: string, endTime: string) => {
    if (!contextMenu.event) return
    // Parse time strings (HH:MM) and combine with event date
    const eventDate = new Date(contextMenu.event.start)
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    const newStart = new Date(eventDate)
    newStart.setHours(startHour, startMin, 0, 0)

    const newEnd = new Date(eventDate)
    newEnd.setHours(endHour, endMin, 0, 0)

    // Calculate duration in minutes
    const duration = (newEnd.getTime() - newStart.getTime()) / 60000

    if (duration > 0) {
      await calendarHook.updateEvent(contextMenu.event.id, {
        startTime: newStart.toISOString(),
        duration
      })
    }
    closeContextMenu()
  }

  const handleReturnToInbox = async () => {
    if (!contextMenu.event) return

    // Find the linked task
    const linkedTask = taskHook.tasks.find(t => t.google_id === contextMenu.event!.id)
    if (!linkedTask) {
      closeContextMenu()
      return
    }

    // Delete from Google Calendar
    await calendarHook.removeEvent(contextMenu.event.id)

    // Update task to clear scheduled and google_id
    await taskHook.unscheduleTask(linkedTask.id)

    closeContextMenu()
  }

  // Check if event has linked task (for "Return to Inbox" option)
  const hasLinkedTask = contextMenu.event
    ? taskHook.tasks.some(t => t.google_id === contextMenu.event!.id)
    : false

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={signInWithGoogle} />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      autoScroll={{ threshold: { x: 0, y: 0.03 } }}
    >
      <div className="h-screen bg-neutral-50 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-neutral-200 bg-white px-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-neutral-800">🧠 Brain Dump Calendar</h1>
          <div className="flex items-center gap-4">
            <ReflectionLink url={reflectionLink.url} onSave={reflectionLink.save} />
            <button
              onClick={() => setShowHelp(true)}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
            <span className="text-sm text-neutral-500">{user.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            taskHook={taskHook}
            onBrainDump={brainDump.open}
            width={sidebarWidth}
            onResize={setSidebarWidth}
            isDeleteMode={isDeleteMode}
            onDeleteModeClick={handleDeleteModeTask}
            onClearAllTasks={handleClearAllTasks}
          />
          <CalendarView
            events={calendarHook.events}
            visibleDates={calendarHook.visibleDates}
            centerDate={calendarHook.centerDate}
            viewMode={calendarHook.viewMode}
            onViewChange={calendarHook.setViewMode}
            isCompact={calendarHook.isCompact}
            onToggleCompact={calendarHook.toggleCompact}
            onEventResize={handleEventResize}
            onEventContextMenu={handleEventContextMenu}
            onPrevDay={calendarHook.goToPrevDay}
            onNextDay={calendarHook.goToNextDay}
            onToday={calendarHook.goToToday}
            isDeleteMode={isDeleteMode}
            onDeleteModeClick={handleDeleteModeEvent}
            draggedDuration={
              activeTask ? activeTask.duration :
              activeEvent ? Math.round((new Date(activeEvent.end).getTime() - new Date(activeEvent.start).getTime()) / 60000) :
              undefined
            }
          />
        </div>
      </div>

      <BrainDumpModal
        isOpen={brainDump.isOpen}
        loading={brainDump.loading}
        tentativeText={brainDump.tentativeText}
        onTextChange={brainDump.updateTentativeText}
        onBlur={brainDump.saveNow}
        onClose={brainDump.close}
        onSubmit={brainDump.submit}
      />

      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        event={contextMenu.event}
        hasLinkedTask={hasLinkedTask}
        onClose={closeContextMenu}
        onColorChange={handleColorChange}
        onRename={handleRename}
        onDurationChange={handleDurationChange}
        onTimeChange={handleTimeChange}
        onReturnToInbox={handleReturnToInbox}
      />

      <UndoToast
        count={deletedItems.length}
        onUndo={undoLast}
        onDismiss={dismissUndo}
      />

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-700 text-white rounded-lg shadow-lg text-sm max-w-[200px]">
            <span className="truncate">{activeTask.title}</span>
            <span className="text-neutral-300 text-xs whitespace-nowrap">({activeTask.duration}m)</span>
          </div>
        )}
        {activeEvent && (() => {
          const durationMins = Math.round((new Date(activeEvent.end).getTime() - new Date(activeEvent.start).getTime()) / 60000)
          return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-700 text-white rounded-lg shadow-lg text-sm max-w-[200px]">
              <span className="truncate">{activeEvent.title}</span>
              <span className="text-neutral-300 text-xs whitespace-nowrap">({durationMins}m)</span>
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
  )
}

export default App
