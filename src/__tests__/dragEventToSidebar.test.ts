import { describe, it, expect, vi } from 'vitest'
import type { CalendarEvent, Task, SectionType } from '../types'

// Test the logic for dragging calendar events back to sidebar
// This tests the handleDragEnd logic extracted for testability

interface DragResult {
  shouldUnschedule: boolean
  shouldCreateTask: boolean
  targetSection: SectionType | null
  linkedTaskId: string | null
}

function handleEventToSidebarDrop(
  activeId: string,
  overId: string,
  event: CalendarEvent,
  tasks: Task[],
  sections: { id: SectionType }[]
): DragResult {
  const noAction = { shouldUnschedule: false, shouldCreateTask: false, targetSection: null, linkedTaskId: null }

  // Must be an event drag
  if (!activeId.startsWith('event-')) {
    return noAction
  }

  // Check if dropped on timeslot (not sidebar)
  if (overId.startsWith('timeslot-')) {
    return noAction
  }

  // Check if dropped on a section
  const targetSectionId = sections.find(s => s.id === overId)?.id || null

  // Check if dropped on a task (via task-drop-* or direct task id)
  const taskDropMatch = overId.match(/^task-drop-(.+)$/)
  const targetTaskId = taskDropMatch ? taskDropMatch[1] : tasks.find(t => t.id === overId)?.id
  const targetTask = targetTaskId ? tasks.find(t => t.id === targetTaskId) : null

  const dropSection = targetSectionId || targetTask?.section || null

  if (!dropSection) {
    return noAction
  }

  // Find linked task
  const linkedTask = tasks.find(t =>
    (event.taskId && t.id === event.taskId) ||
    t.google_id === event.id
  )

  if (!linkedTask) {
    // External event - create new task
    return {
      shouldUnschedule: false,
      shouldCreateTask: true,
      targetSection: dropSection,
      linkedTaskId: null
    }
  }

  return {
    shouldUnschedule: true,
    shouldCreateTask: false,
    targetSection: dropSection,
    linkedTaskId: linkedTask.id
  }
}

describe('drag calendar event to sidebar', () => {
  const mockEvent: CalendarEvent = {
    id: 'gcal-123',
    title: 'Test Event',
    start: '2024-01-01T10:00:00Z',
    end: '2024-01-01T11:00:00Z',
    isGoogleEvent: true,
    taskId: 'task-1'
  }

  const mockTasks: Task[] = [
    { id: 'task-1', user_id: 'u1', title: 'Task 1', duration: 60, section: 'inbox', position: 0, scheduled: '2024-01-01T10:00:00Z', google_id: 'gcal-123', created_at: '2024-01-01' },
    { id: 'task-2', user_id: 'u1', title: 'Task 2', duration: 30, section: 'mustdo', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
  ]

  const sections = [
    { id: 'inbox' as const },
    { id: '2min' as const },
    { id: 'mustdo' as const },
    { id: 'iftime' as const },
    { id: 'later' as const },
    { id: 'someday' as const },
  ]

  it('returns unschedule when event dropped on section', () => {
    const result = handleEventToSidebarDrop(
      'event-gcal-123',
      'mustdo',
      mockEvent,
      mockTasks,
      sections
    )

    expect(result.shouldUnschedule).toBe(true)
    expect(result.targetSection).toBe('mustdo')
    expect(result.linkedTaskId).toBe('task-1')
  })

  it('returns unschedule when event dropped on task (via task-drop-*)', () => {
    const result = handleEventToSidebarDrop(
      'event-gcal-123',
      'task-drop-task-2',
      mockEvent,
      mockTasks,
      sections
    )

    expect(result.shouldUnschedule).toBe(true)
    expect(result.targetSection).toBe('mustdo') // task-2's section
    expect(result.linkedTaskId).toBe('task-1')
  })

  it('does NOT unschedule when dropped on timeslot', () => {
    const result = handleEventToSidebarDrop(
      'event-gcal-123',
      'timeslot-2024-01-01-14-00',
      mockEvent,
      mockTasks,
      sections
    )

    expect(result.shouldUnschedule).toBe(false)
    expect(result.targetSection).toBeNull()
  })

  it('creates new task when no linked task found (external event)', () => {
    const externalEvent: CalendarEvent = {
      ...mockEvent,
      taskId: null,
      id: 'external-event'
    }

    const result = handleEventToSidebarDrop(
      'event-external-event',
      'inbox',
      externalEvent,
      mockTasks,
      sections
    )

    // External events should trigger task creation
    expect(result.shouldCreateTask).toBe(true)
    expect(result.targetSection).toBe('inbox')
  })

  it('finds linked task via google_id when taskId is null', () => {
    const eventWithoutTaskId: CalendarEvent = {
      ...mockEvent,
      taskId: null // but google_id matches task-1's google_id
    }

    const result = handleEventToSidebarDrop(
      'event-gcal-123',
      'iftime',
      eventWithoutTaskId,
      mockTasks,
      sections
    )

    expect(result.shouldUnschedule).toBe(true)
    expect(result.linkedTaskId).toBe('task-1')
  })

  it('does NOT unschedule for non-event drags', () => {
    const result = handleEventToSidebarDrop(
      'task-1', // not an event
      'mustdo',
      mockEvent,
      mockTasks,
      sections
    )

    expect(result.shouldUnschedule).toBe(false)
  })
})
