import { describe, it, expect } from 'vitest'
import type { CalendarEvent, Task, SectionType } from '../types'

// Test the logic for dragging calendar events back to sidebar
// This tests the handleDragEnd logic extracted for testability

interface DragResult {
  shouldUnschedule: boolean
  shouldCreateTask: boolean
  targetSection: SectionType | null
  linkedTaskId: string | null
  calculatedDuration: number | null
}

function handleEventToSidebarDrop(
  activeId: string,
  overId: string,
  event: CalendarEvent,
  tasks: Task[],
  sections: { id: SectionType }[]
): DragResult {
  const noAction: DragResult = {
    shouldUnschedule: false,
    shouldCreateTask: false,
    targetSection: null,
    linkedTaskId: null,
    calculatedDuration: null
  }

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
    const duration = Math.round(
      (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
    )
    return {
      shouldUnschedule: false,
      shouldCreateTask: true,
      targetSection: dropSection,
      linkedTaskId: null,
      calculatedDuration: duration
    }
  }

  return {
    shouldUnschedule: true,
    shouldCreateTask: false,
    targetSection: dropSection,
    linkedTaskId: linkedTask.id,
    calculatedDuration: null
  }
}

describe('drag calendar event to sidebar', () => {
  const sections = [
    { id: 'inbox' as const },
    { id: '2min' as const },
    { id: 'mustdo' as const },
    { id: 'iftime' as const },
    { id: 'later' as const },
    { id: 'someday' as const },
  ]

  // ============================================
  // LINKED TASK EVENTS (from scheduled tasks)
  // ============================================
  describe('linked task events (scheduled tasks)', () => {
    const scheduledTask: Task = {
      id: 'task-1',
      user_id: 'u1',
      title: 'Scheduled Task',
      duration: 60,
      section: 'inbox',
      position: 0,
      scheduled: '2024-01-01T10:00:00Z',
      google_id: 'gcal-123',
      created_at: '2024-01-01'
    }

    const linkedEvent: CalendarEvent = {
      id: 'gcal-123',
      title: 'Scheduled Task',
      start: '2024-01-01T10:00:00Z',
      end: '2024-01-01T11:00:00Z',
      isGoogleEvent: true,
      taskId: 'task-1'
    }

    const tasks = [scheduledTask]

    describe('drop on section backgrounds', () => {
      it.each([
        ['inbox', 'inbox'],
        ['2min', '2min'],
        ['mustdo', 'mustdo'],
        ['iftime', 'iftime'],
        ['later', 'later'],
        ['someday', 'someday'],
      ])('drops on %s section → unschedules to %s', (sectionId, expectedSection) => {
        const result = handleEventToSidebarDrop(
          'event-gcal-123',
          sectionId,
          linkedEvent,
          tasks,
          sections
        )

        expect(result.shouldUnschedule).toBe(true)
        expect(result.shouldCreateTask).toBe(false)
        expect(result.targetSection).toBe(expectedSection)
        expect(result.linkedTaskId).toBe('task-1')
      })
    })

    describe('drop on tasks in sections', () => {
      const tasksInSections: Task[] = [
        scheduledTask,
        { id: 'inbox-task', user_id: 'u1', title: 'Inbox Task', duration: 30, section: 'inbox', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
        { id: '2min-task', user_id: 'u1', title: '2min Task', duration: 5, section: '2min', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
        { id: 'mustdo-task', user_id: 'u1', title: 'Must Do Task', duration: 45, section: 'mustdo', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
        { id: 'iftime-task', user_id: 'u1', title: 'If Time Task', duration: 30, section: 'iftime', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
        { id: 'later-task', user_id: 'u1', title: 'Later Task', duration: 60, section: 'later', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
        { id: 'someday-task', user_id: 'u1', title: 'Someday Task', duration: 90, section: 'someday', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
      ]

      it.each([
        ['task-drop-inbox-task', 'inbox'],
        ['task-drop-2min-task', '2min'],
        ['task-drop-mustdo-task', 'mustdo'],
        ['task-drop-iftime-task', 'iftime'],
        ['task-drop-later-task', 'later'],
        ['task-drop-someday-task', 'someday'],
      ])('drops on %s → unschedules to %s', (dropId, expectedSection) => {
        const result = handleEventToSidebarDrop(
          'event-gcal-123',
          dropId,
          linkedEvent,
          tasksInSections,
          sections
        )

        expect(result.shouldUnschedule).toBe(true)
        expect(result.targetSection).toBe(expectedSection)
        expect(result.linkedTaskId).toBe('task-1')
      })

      it('drops on task via direct task id', () => {
        const result = handleEventToSidebarDrop(
          'event-gcal-123',
          'mustdo-task', // direct task id, not task-drop-*
          linkedEvent,
          tasksInSections,
          sections
        )

        expect(result.shouldUnschedule).toBe(true)
        expect(result.targetSection).toBe('mustdo')
      })
    })

    describe('linked task detection', () => {
      it('finds linked task via taskId property', () => {
        const result = handleEventToSidebarDrop(
          'event-gcal-123',
          'later',
          linkedEvent,
          tasks,
          sections
        )

        expect(result.linkedTaskId).toBe('task-1')
        expect(result.shouldUnschedule).toBe(true)
      })

      it('finds linked task via google_id when taskId is null', () => {
        const eventWithoutTaskId: CalendarEvent = {
          ...linkedEvent,
          taskId: null // but event.id matches task's google_id
        }

        const result = handleEventToSidebarDrop(
          'event-gcal-123',
          'iftime',
          eventWithoutTaskId,
          tasks,
          sections
        )

        expect(result.linkedTaskId).toBe('task-1')
        expect(result.shouldUnschedule).toBe(true)
      })

      it('finds task by taskId when google_id does not match any task', () => {
        const taskWithNoGoogleId: Task = {
          ...scheduledTask,
          id: 'task-2',
          google_id: null
        }

        const eventWithTaskId: CalendarEvent = {
          id: 'unmatched-gcal-id', // doesn't match any task's google_id
          title: 'Event',
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z',
          isGoogleEvent: true,
          taskId: 'task-2' // explicitly points to task-2
        }

        const result = handleEventToSidebarDrop(
          'event-unmatched-gcal-id',
          'mustdo',
          eventWithTaskId,
          [taskWithNoGoogleId],
          sections
        )

        expect(result.linkedTaskId).toBe('task-2')
      })
    })
  })

  // ============================================
  // EXTERNAL CALENDAR EVENTS (from Google Calendar)
  // ============================================
  describe('external calendar events (from Google)', () => {
    const tasks: Task[] = [
      { id: 'existing-task', user_id: 'u1', title: 'Existing', duration: 30, section: 'inbox', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
    ]

    describe('creates new task on drop', () => {
      it.each([
        ['inbox', 'inbox'],
        ['2min', '2min'],
        ['mustdo', 'mustdo'],
        ['iftime', 'iftime'],
        ['later', 'later'],
        ['someday', 'someday'],
      ])('external event dropped on %s → creates task in %s', (sectionId, expectedSection) => {
        const externalEvent: CalendarEvent = {
          id: 'google-meeting-xyz',
          title: 'Team Standup',
          start: '2024-01-01T09:00:00Z',
          end: '2024-01-01T09:30:00Z',
          isGoogleEvent: true,
          taskId: null
        }

        const result = handleEventToSidebarDrop(
          'event-google-meeting-xyz',
          sectionId,
          externalEvent,
          tasks,
          sections
        )

        expect(result.shouldCreateTask).toBe(true)
        expect(result.shouldUnschedule).toBe(false)
        expect(result.targetSection).toBe(expectedSection)
        expect(result.linkedTaskId).toBeNull()
      })
    })

    describe('duration calculation from event times', () => {
      it.each([
        ['2024-01-01T10:00:00Z', '2024-01-01T10:15:00Z', 15],
        ['2024-01-01T10:00:00Z', '2024-01-01T10:30:00Z', 30],
        ['2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z', 60],
        ['2024-01-01T10:00:00Z', '2024-01-01T11:30:00Z', 90],
        ['2024-01-01T10:00:00Z', '2024-01-01T12:00:00Z', 120],
        ['2024-01-01T09:00:00Z', '2024-01-01T09:05:00Z', 5],
        ['2024-01-01T09:00:00Z', '2024-01-01T09:45:00Z', 45],
      ])('event from %s to %s → duration %d minutes', (start, end, expectedDuration) => {
        const externalEvent: CalendarEvent = {
          id: 'external-event',
          title: 'External Meeting',
          start,
          end,
          isGoogleEvent: true,
          taskId: null
        }

        const result = handleEventToSidebarDrop(
          'event-external-event',
          'inbox',
          externalEvent,
          tasks,
          sections
        )

        expect(result.calculatedDuration).toBe(expectedDuration)
      })

      it('rounds fractional minutes', () => {
        const externalEvent: CalendarEvent = {
          id: 'external-event',
          title: 'Odd Duration Meeting',
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T10:17:30Z', // 17.5 minutes
          isGoogleEvent: true,
          taskId: null
        }

        const result = handleEventToSidebarDrop(
          'event-external-event',
          'inbox',
          externalEvent,
          tasks,
          sections
        )

        expect(result.calculatedDuration).toBe(18) // rounded
      })
    })

    describe('drop on tasks creates task in that section', () => {
      const tasksInSections: Task[] = [
        { id: 'mustdo-task', user_id: 'u1', title: 'Must Do', duration: 30, section: 'mustdo', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
        { id: 'later-task', user_id: 'u1', title: 'Later', duration: 30, section: 'later', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
      ]

      it('external event dropped on task → creates in that section', () => {
        const externalEvent: CalendarEvent = {
          id: 'google-meeting',
          title: 'Client Call',
          start: '2024-01-01T14:00:00Z',
          end: '2024-01-01T15:00:00Z',
          isGoogleEvent: true,
          taskId: null
        }

        const result = handleEventToSidebarDrop(
          'event-google-meeting',
          'task-drop-later-task',
          externalEvent,
          tasksInSections,
          sections
        )

        expect(result.shouldCreateTask).toBe(true)
        expect(result.targetSection).toBe('later')
        expect(result.calculatedDuration).toBe(60)
      })
    })
  })

  // ============================================
  // INVALID DROPS (should not trigger actions)
  // ============================================
  describe('invalid drops', () => {
    const mockEvent: CalendarEvent = {
      id: 'gcal-123',
      title: 'Test Event',
      start: '2024-01-01T10:00:00Z',
      end: '2024-01-01T11:00:00Z',
      isGoogleEvent: true,
      taskId: 'task-1'
    }

    const tasks: Task[] = [
      { id: 'task-1', user_id: 'u1', title: 'Task 1', duration: 60, section: 'inbox', position: 0, scheduled: '2024-01-01T10:00:00Z', google_id: 'gcal-123', created_at: '2024-01-01' },
    ]

    describe('drops on calendar timeslots', () => {
      it.each([
        'timeslot-2024-01-01-08-00',
        'timeslot-2024-01-01-14-30',
        'timeslot-2024-01-01-23-00',
        'timeslot-2024-12-31-00-00',
      ])('drop on %s → no action (stays on calendar)', (timeslotId) => {
        const result = handleEventToSidebarDrop(
          'event-gcal-123',
          timeslotId,
          mockEvent,
          tasks,
          sections
        )

        expect(result.shouldUnschedule).toBe(false)
        expect(result.shouldCreateTask).toBe(false)
        expect(result.targetSection).toBeNull()
      })
    })

    describe('non-event drags', () => {
      it.each([
        'task-1',
        'task-123',
        'random-id',
        'section-inbox',
      ])('dragging %s (not an event) → no action', (activeId) => {
        const result = handleEventToSidebarDrop(
          activeId,
          'mustdo',
          mockEvent,
          tasks,
          sections
        )

        expect(result.shouldUnschedule).toBe(false)
        expect(result.shouldCreateTask).toBe(false)
      })
    })

    describe('unknown drop targets', () => {
      it.each([
        'unknown-section',
        'random-element',
        'calendar-header',
        'task-drop-nonexistent-task',
        '',
      ])('drop on unknown target "%s" → no action', (overId) => {
        const result = handleEventToSidebarDrop(
          'event-gcal-123',
          overId,
          mockEvent,
          tasks,
          sections
        )

        expect(result.shouldUnschedule).toBe(false)
        expect(result.shouldCreateTask).toBe(false)
        expect(result.targetSection).toBeNull()
      })
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================
  describe('edge cases', () => {
    it('handles event with both taskId and google_id correctly', () => {
      const task: Task = {
        id: 'task-with-both',
        user_id: 'u1',
        title: 'Task With Both IDs',
        duration: 30,
        section: 'mustdo',
        position: 0,
        scheduled: '2024-01-01T10:00:00Z',
        google_id: 'gcal-abc',
        created_at: '2024-01-01'
      }

      const event: CalendarEvent = {
        id: 'gcal-abc',
        title: 'Task With Both IDs',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T10:30:00Z',
        isGoogleEvent: true,
        taskId: 'task-with-both'
      }

      const result = handleEventToSidebarDrop(
        'event-gcal-abc',
        'later',
        event,
        [task],
        sections
      )

      expect(result.shouldUnschedule).toBe(true)
      expect(result.linkedTaskId).toBe('task-with-both')
    })

    it('handles empty task list for external events', () => {
      const externalEvent: CalendarEvent = {
        id: 'external-123',
        title: 'External Event',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
        isGoogleEvent: true,
        taskId: null
      }

      const result = handleEventToSidebarDrop(
        'event-external-123',
        'inbox',
        externalEvent,
        [], // no tasks
        sections
      )

      expect(result.shouldCreateTask).toBe(true)
      expect(result.targetSection).toBe('inbox')
    })

    it('handles very long duration events', () => {
      const allDayEvent: CalendarEvent = {
        id: 'all-day',
        title: 'All Day Event',
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z', // 24 hours
        isGoogleEvent: true,
        taskId: null
      }

      const result = handleEventToSidebarDrop(
        'event-all-day',
        'someday',
        allDayEvent,
        [],
        sections
      )

      expect(result.calculatedDuration).toBe(1440) // 24 * 60 minutes
    })

    it('handles zero duration events', () => {
      const zeroEvent: CalendarEvent = {
        id: 'zero-duration',
        title: 'Instant Event',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T10:00:00Z',
        isGoogleEvent: true,
        taskId: null
      }

      const result = handleEventToSidebarDrop(
        'event-zero-duration',
        'inbox',
        zeroEvent,
        [],
        sections
      )

      expect(result.calculatedDuration).toBe(0)
    })

    it('handles multiple tasks - finds correct linked task', () => {
      const tasks: Task[] = [
        { id: 'task-a', user_id: 'u1', title: 'Task A', duration: 30, section: 'inbox', position: 0, scheduled: null, google_id: 'gcal-a', created_at: '2024-01-01' },
        { id: 'task-b', user_id: 'u1', title: 'Task B', duration: 60, section: 'mustdo', position: 0, scheduled: '2024-01-01T10:00:00Z', google_id: 'gcal-b', created_at: '2024-01-01' },
        { id: 'task-c', user_id: 'u1', title: 'Task C', duration: 45, section: 'later', position: 0, scheduled: null, google_id: 'gcal-c', created_at: '2024-01-01' },
      ]

      const eventForTaskB: CalendarEvent = {
        id: 'gcal-b',
        title: 'Task B',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
        isGoogleEvent: true,
        taskId: 'task-b'
      }

      const result = handleEventToSidebarDrop(
        'event-gcal-b',
        'iftime',
        eventForTaskB,
        tasks,
        sections
      )

      expect(result.linkedTaskId).toBe('task-b')
      expect(result.targetSection).toBe('iftime')
    })
  })
})
