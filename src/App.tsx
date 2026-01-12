import { DndContext, DragOverlay, pointerWithin, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useState, useEffect } from 'react'
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
import { useReflectionLink } from './hooks/useReflectionLink'
import { SECTIONS } from './types'
import type { Task, CalendarEvent } from './types'

function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const taskHook = useTasks(user?.id)
  const calendarHook = useCalendar(user?.id)
  const reflectionLink = useReflectionLink()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(288) // 18rem = 288px

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

  const handleTasksCreated = async (newTasks: { title: string; duration: number }[]) => {
    for (const t of newTasks) {
      await taskHook.addTask(t.title, t.duration)
    }
  }

  const brainDump = useBrainDump(handleTasksCreated)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
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

    // Handle calendar event move
    // Format: timeslot-YYYY-MM-DD-HH-MM
    if (activeId.startsWith('event-') && overId.startsWith('timeslot-')) {
      const eventData = active.data.current
      if (eventData?.event) {
        const calEvent = eventData.event as CalendarEvent
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


        await calendarHook.updateEvent(calEvent.id, {
          startTime: dropDate.toISOString(),
          duration
        })
      }
      return
    }

    // Handle task drag
    const taskId = activeId

    // Dropping on a time slot (format: timeslot-YYYY-MM-DD-HH-MM)
    if (overId.startsWith('timeslot-')) {
      const parts = overId.split('-')
      // parts: ['timeslot', 'YYYY', 'MM', 'DD', 'HH', 'MM']
      const year = parseInt(parts[1])
      const month = parseInt(parts[2]) - 1 // JS months are 0-indexed
      const day = parseInt(parts[3])
      const hour = parseInt(parts[4])
      const minute = parseInt(parts[5])
      const dropDate = new Date(year, month, day, hour, minute, 0, 0)
      const calEvent = await taskHook.scheduleTask(taskId, dropDate.toISOString())
      if (calEvent) calendarHook.addEvent(calEvent)
      return
    }

    // Dropping on a section or another task
    const targetSection = SECTIONS.find(s => s.id === overId)?.id
    const targetTask = taskHook.tasks.find(t => t.id === overId)

    if (targetSection) {
      const sectionTasks = taskHook.getTasksBySection(targetSection)
      await taskHook.moveTask(taskId, targetSection, sectionTasks.length)
    } else if (targetTask) {
      await taskHook.moveTask(taskId, targetTask.section, targetTask.position)
    }
  }

  // Event resize handler
  const handleEventResize = async (eventId: string, startTime: string, duration: number) => {
    await calendarHook.updateEvent(eventId, { startTime, duration })
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
          <Sidebar taskHook={taskHook} onBrainDump={brainDump.open} width={sidebarWidth} onResize={setSidebarWidth} />
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

      <DragOverlay>
        {activeTask && (
          <div className="w-64">
            <TaskBlock
              task={activeTask}
              onDurationChange={() => {}}
              onDelete={() => {}}
            />
          </div>
        )}
        {activeEvent && (() => {
          const durationMins = (new Date(activeEvent.end).getTime() - new Date(activeEvent.start).getTime()) / 60000
          const hourHeight = calendarHook.isCompact ? 85 : 150
          const height = Math.max((durationMins / 60) * hourHeight, 20)
          return (
            <div
              className="w-48 rounded-md px-2 py-1 text-xs text-white shadow-lg overflow-hidden"
              style={{ backgroundColor: '#039BE5', height: `${height}px` }}
            >
              <div className="font-medium truncate">{activeEvent.title}</div>
              <div className="text-[10px] opacity-75">
                {new Date(activeEvent.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {' - '}
                {new Date(activeEvent.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
  )
}

export default App
