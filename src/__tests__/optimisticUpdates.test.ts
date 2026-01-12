import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CalendarEvent, Task, SectionType } from '../types'

/**
 * Test suite for optimistic update behavior
 * Tests the logic patterns used in drag & drop operations
 */

// ============================================
// CALENDAR EVENT OPTIMISTIC UPDATE LOGIC
// ============================================

interface EventUpdate {
  startTime: string
  duration: number
}

interface OptimisticEventResult {
  updatedEvent: CalendarEvent
  rollback: () => CalendarEvent
}

function optimisticUpdateEvent(
  event: CalendarEvent,
  updates: EventUpdate
): OptimisticEventResult {
  const newEnd = new Date(new Date(updates.startTime).getTime() + updates.duration * 60000)

  const updatedEvent: CalendarEvent = {
    ...event,
    start: updates.startTime,
    end: newEnd.toISOString()
  }

  return {
    updatedEvent,
    rollback: () => event // returns original
  }
}

describe('calendar event optimistic updates', () => {
  const mockEvent: CalendarEvent = {
    id: 'event-1',
    title: 'Test Event',
    start: '2024-01-01T10:00:00Z',
    end: '2024-01-01T11:00:00Z',
    isGoogleEvent: true,
    taskId: 'task-1'
  }

  describe('updateEventOptimistic', () => {
    it('updates event start and end times immediately', () => {
      const result = optimisticUpdateEvent(mockEvent, {
        startTime: '2024-01-01T14:00:00Z',
        duration: 60
      })

      expect(result.updatedEvent.start).toBe('2024-01-01T14:00:00Z')
      expect(result.updatedEvent.end).toBe('2024-01-01T15:00:00.000Z')
    })

    it('preserves other event properties', () => {
      const result = optimisticUpdateEvent(mockEvent, {
        startTime: '2024-01-01T14:00:00Z',
        duration: 60
      })

      expect(result.updatedEvent.id).toBe('event-1')
      expect(result.updatedEvent.title).toBe('Test Event')
      expect(result.updatedEvent.isGoogleEvent).toBe(true)
      expect(result.updatedEvent.taskId).toBe('task-1')
    })

    it('calculates correct end time for various durations', () => {
      const testCases = [
        { duration: 15, expectedEnd: '2024-01-01T14:15:00.000Z' },
        { duration: 30, expectedEnd: '2024-01-01T14:30:00.000Z' },
        { duration: 45, expectedEnd: '2024-01-01T14:45:00.000Z' },
        { duration: 60, expectedEnd: '2024-01-01T15:00:00.000Z' },
        { duration: 90, expectedEnd: '2024-01-01T15:30:00.000Z' },
        { duration: 120, expectedEnd: '2024-01-01T16:00:00.000Z' },
      ]

      testCases.forEach(({ duration, expectedEnd }) => {
        const result = optimisticUpdateEvent(mockEvent, {
          startTime: '2024-01-01T14:00:00Z',
          duration
        })
        expect(result.updatedEvent.end).toBe(expectedEnd)
      })
    })

    it('provides rollback function that returns original event', () => {
      const result = optimisticUpdateEvent(mockEvent, {
        startTime: '2024-01-01T14:00:00Z',
        duration: 60
      })

      const rolledBack = result.rollback()
      expect(rolledBack).toEqual(mockEvent)
      expect(rolledBack.start).toBe('2024-01-01T10:00:00Z')
    })
  })
})

// ============================================
// TASK SCHEDULE OPTIMISTIC UPDATE LOGIC
// ============================================

interface TempEventResult {
  tempEvent: CalendarEvent
  updatedTask: Task
  rollback: () => Task
}

function optimisticScheduleTask(
  task: Task,
  startTime: string
): TempEventResult {
  const endTime = new Date(new Date(startTime).getTime() + task.duration * 60000)
  const tempEventId = `temp-${task.id}-${Date.now()}`

  const tempEvent: CalendarEvent = {
    id: tempEventId,
    title: task.title,
    start: startTime,
    end: endTime.toISOString(),
    isGoogleEvent: false,
    taskId: task.id
  }

  const updatedTask: Task = {
    ...task,
    scheduled: startTime,
    google_id: tempEventId
  }

  return {
    tempEvent,
    updatedTask,
    rollback: () => ({
      ...task,
      scheduled: null,
      google_id: null
    })
  }
}

describe('task schedule optimistic updates', () => {
  const mockTask: Task = {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Test Task',
    duration: 60,
    section: 'inbox',
    position: 0,
    scheduled: null,
    google_id: null,
    created_at: '2024-01-01'
  }

  describe('scheduleTaskOptimistic', () => {
    it('creates temp event with correct properties', () => {
      const result = optimisticScheduleTask(mockTask, '2024-01-01T10:00:00Z')

      expect(result.tempEvent.title).toBe('Test Task')
      expect(result.tempEvent.start).toBe('2024-01-01T10:00:00Z')
      expect(result.tempEvent.end).toBe('2024-01-01T11:00:00.000Z')
      expect(result.tempEvent.taskId).toBe('task-1')
      expect(result.tempEvent.isGoogleEvent).toBe(false)
    })

    it('creates temp event with unique ID pattern', () => {
      const result = optimisticScheduleTask(mockTask, '2024-01-01T10:00:00Z')

      // ID should follow temp-{taskId}-{timestamp} pattern
      expect(result.tempEvent.id).toContain('temp-task-1')
      expect(result.tempEvent.id).toMatch(/^temp-task-1-\d+$/)
    })

    it('updates task with scheduled time and temp google_id', () => {
      const result = optimisticScheduleTask(mockTask, '2024-01-01T10:00:00Z')

      expect(result.updatedTask.scheduled).toBe('2024-01-01T10:00:00Z')
      expect(result.updatedTask.google_id).toBe(result.tempEvent.id)
    })

    it('calculates correct end time based on task duration', () => {
      const testCases = [
        { duration: 15, expectedEnd: '2024-01-01T10:15:00.000Z' },
        { duration: 30, expectedEnd: '2024-01-01T10:30:00.000Z' },
        { duration: 60, expectedEnd: '2024-01-01T11:00:00.000Z' },
        { duration: 90, expectedEnd: '2024-01-01T11:30:00.000Z' },
      ]

      testCases.forEach(({ duration, expectedEnd }) => {
        const taskWithDuration = { ...mockTask, duration }
        const result = optimisticScheduleTask(taskWithDuration, '2024-01-01T10:00:00Z')
        expect(result.tempEvent.end).toBe(expectedEnd)
      })
    })

    it('provides rollback that clears scheduled and google_id', () => {
      const result = optimisticScheduleTask(mockTask, '2024-01-01T10:00:00Z')
      const rolledBack = result.rollback()

      expect(rolledBack.scheduled).toBeNull()
      expect(rolledBack.google_id).toBeNull()
      expect(rolledBack.title).toBe('Test Task') // other props preserved
    })
  })
})

// ============================================
// UNSCHEDULE + MOVE OPTIMISTIC UPDATE LOGIC
// ============================================

interface UnscheduleAndMoveResult {
  updatedTask: Task
  originalTask: Task
}

function optimisticUnscheduleAndMove(
  task: Task,
  toSection: SectionType,
  toIndex: number
): UnscheduleAndMoveResult {
  const updatedTask: Task = {
    ...task,
    section: toSection,
    position: toIndex,
    scheduled: null,
    google_id: null
  }

  return {
    updatedTask,
    originalTask: task
  }
}

describe('unschedule and move optimistic updates', () => {
  const scheduledTask: Task = {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Scheduled Task',
    duration: 60,
    section: 'inbox',
    position: 0,
    scheduled: '2024-01-01T10:00:00Z',
    google_id: 'gcal-123',
    created_at: '2024-01-01'
  }

  describe('unscheduleAndMoveTask', () => {
    it('clears scheduled and google_id', () => {
      const result = optimisticUnscheduleAndMove(scheduledTask, 'mustdo', 0)

      expect(result.updatedTask.scheduled).toBeNull()
      expect(result.updatedTask.google_id).toBeNull()
    })

    it('moves task to target section', () => {
      const result = optimisticUnscheduleAndMove(scheduledTask, 'mustdo', 0)

      expect(result.updatedTask.section).toBe('mustdo')
    })

    it('sets correct position', () => {
      const result = optimisticUnscheduleAndMove(scheduledTask, 'later', 5)

      expect(result.updatedTask.position).toBe(5)
    })

    it.each([
      ['inbox', 'inbox'],
      ['2min', '2min'],
      ['mustdo', 'mustdo'],
      ['iftime', 'iftime'],
      ['later', 'later'],
      ['someday', 'someday'],
    ])('can move to %s section', (sectionId, expected) => {
      const result = optimisticUnscheduleAndMove(
        scheduledTask,
        sectionId as SectionType,
        0
      )

      expect(result.updatedTask.section).toBe(expected)
    })

    it('preserves original task for rollback', () => {
      const result = optimisticUnscheduleAndMove(scheduledTask, 'mustdo', 0)

      expect(result.originalTask).toEqual(scheduledTask)
      expect(result.originalTask.scheduled).toBe('2024-01-01T10:00:00Z')
      expect(result.originalTask.google_id).toBe('gcal-123')
    })

    it('preserves other task properties', () => {
      const result = optimisticUnscheduleAndMove(scheduledTask, 'mustdo', 0)

      expect(result.updatedTask.id).toBe('task-1')
      expect(result.updatedTask.title).toBe('Scheduled Task')
      expect(result.updatedTask.duration).toBe(60)
    })
  })
})

// ============================================
// REMOVE EVENT OPTIMISTIC UPDATE LOGIC
// ============================================

describe('remove event optimistic updates', () => {
  const events: CalendarEvent[] = [
    { id: 'event-1', title: 'Event 1', start: '2024-01-01T10:00:00Z', end: '2024-01-01T11:00:00Z', isGoogleEvent: true, taskId: 'task-1' },
    { id: 'event-2', title: 'Event 2', start: '2024-01-01T12:00:00Z', end: '2024-01-01T13:00:00Z', isGoogleEvent: true, taskId: 'task-2' },
    { id: 'event-3', title: 'Event 3', start: '2024-01-01T14:00:00Z', end: '2024-01-01T15:00:00Z', isGoogleEvent: true, taskId: 'task-3' },
  ]

  it('removes event from list immediately', () => {
    const eventToRemove = events[1]
    const filtered = events.filter(e => e.id !== eventToRemove.id)

    expect(filtered).toHaveLength(2)
    expect(filtered.find(e => e.id === 'event-2')).toBeUndefined()
  })

  it('preserves other events', () => {
    const filtered = events.filter(e => e.id !== 'event-2')

    expect(filtered.find(e => e.id === 'event-1')).toBeDefined()
    expect(filtered.find(e => e.id === 'event-3')).toBeDefined()
  })

  it('can rollback by adding event back', () => {
    const eventToRemove = events[1]
    const filtered = events.filter(e => e.id !== eventToRemove.id)
    const restored = [...filtered, eventToRemove]

    expect(restored).toHaveLength(3)
    expect(restored.find(e => e.id === 'event-2')).toEqual(eventToRemove)
  })
})

// ============================================
// REPLACE TEMP EVENT WITH REAL EVENT
// ============================================

describe('replace temp event with real event', () => {
  it('replaces temp event ID with real event', () => {
    const tempEvent: CalendarEvent = {
      id: 'temp-task-1-12345',
      title: 'Task',
      start: '2024-01-01T10:00:00Z',
      end: '2024-01-01T11:00:00Z',
      isGoogleEvent: false,
      taskId: 'task-1'
    }

    const realEvent: CalendarEvent = {
      id: 'gcal-abc123',
      title: 'Task',
      start: '2024-01-01T10:00:00Z',
      end: '2024-01-01T11:00:00Z',
      isGoogleEvent: true,
      taskId: 'task-1'
    }

    const events = [tempEvent]
    const updated = events.map(e => e.id === tempEvent.id ? realEvent : e)

    expect(updated[0].id).toBe('gcal-abc123')
    expect(updated[0].isGoogleEvent).toBe(true)
  })

  it('only replaces matching temp event', () => {
    const events: CalendarEvent[] = [
      { id: 'gcal-existing', title: 'Existing', start: '2024-01-01T09:00:00Z', end: '2024-01-01T10:00:00Z', isGoogleEvent: true, taskId: 'task-0' },
      { id: 'temp-task-1-12345', title: 'Temp', start: '2024-01-01T10:00:00Z', end: '2024-01-01T11:00:00Z', isGoogleEvent: false, taskId: 'task-1' },
    ]

    const realEvent: CalendarEvent = {
      id: 'gcal-new',
      title: 'Temp',
      start: '2024-01-01T10:00:00Z',
      end: '2024-01-01T11:00:00Z',
      isGoogleEvent: true,
      taskId: 'task-1'
    }

    const updated = events.map(e => e.id === 'temp-task-1-12345' ? realEvent : e)

    expect(updated[0].id).toBe('gcal-existing') // unchanged
    expect(updated[1].id).toBe('gcal-new') // replaced
  })
})

// ============================================
// EXTERNAL CALENDAR EVENT TASK CREATION
// ============================================

describe('external calendar event creates new task', () => {
  it('calculates duration from event times', () => {
    const event: CalendarEvent = {
      id: 'google-meeting',
      title: 'External Meeting',
      start: '2024-01-01T10:00:00Z',
      end: '2024-01-01T11:30:00Z',
      isGoogleEvent: true,
      taskId: null
    }

    const duration = Math.round(
      (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
    )

    expect(duration).toBe(90)
  })

  it('creates task with event title and calculated duration', () => {
    const event: CalendarEvent = {
      id: 'google-meeting',
      title: 'Team Standup',
      start: '2024-01-01T09:00:00Z',
      end: '2024-01-01T09:30:00Z',
      isGoogleEvent: true,
      taskId: null
    }

    const duration = Math.round(
      (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
    )

    const newTask: Partial<Task> = {
      title: event.title,
      duration,
      section: 'inbox'
    }

    expect(newTask.title).toBe('Team Standup')
    expect(newTask.duration).toBe(30)
    expect(newTask.section).toBe('inbox')
  })
})
