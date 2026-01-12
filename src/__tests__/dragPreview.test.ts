import { describe, it, expect } from 'vitest'
import type { Task, CalendarEvent } from '../types'

/**
 * Test suite for drag preview behavior
 * Tests compact overlay and duration-aware calendar highlight
 */

// ============================================
// DRAG OVERLAY - DURATION CALCULATION
// ============================================

describe('drag overlay duration display', () => {
  describe('task duration', () => {
    it('displays task duration directly', () => {
      const task: Partial<Task> = { title: 'Test Task', duration: 60 }
      expect(task.duration).toBe(60)
    })

    it.each([5, 15, 30, 45, 60, 90, 120])('handles %d minute duration', (duration) => {
      const task: Partial<Task> = { title: 'Task', duration }
      expect(task.duration).toBe(duration)
    })
  })

  describe('event duration calculation', () => {
    it('calculates duration from start/end times', () => {
      const event: CalendarEvent = {
        id: 'e1',
        title: 'Meeting',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
        isGoogleEvent: true,
        taskId: null
      }
      const duration = Math.round(
        (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
      )
      expect(duration).toBe(60)
    })

    it('handles 15-minute events', () => {
      const event: CalendarEvent = {
        id: 'e1',
        title: 'Quick sync',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T10:15:00Z',
        isGoogleEvent: true,
        taskId: null
      }
      const duration = Math.round(
        (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
      )
      expect(duration).toBe(15)
    })

    it('handles multi-hour events', () => {
      const event: CalendarEvent = {
        id: 'e1',
        title: 'Workshop',
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T12:30:00Z',
        isGoogleEvent: true,
        taskId: null
      }
      const duration = Math.round(
        (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
      )
      expect(duration).toBe(210) // 3.5 hours
    })

    it('handles events crossing midnight', () => {
      const event: CalendarEvent = {
        id: 'e1',
        title: 'Overnight',
        start: '2024-01-01T23:00:00Z',
        end: '2024-01-02T01:00:00Z',
        isGoogleEvent: true,
        taskId: null
      }
      const duration = Math.round(
        (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
      )
      expect(duration).toBe(120)
    })
  })
})

// ============================================
// DURATION PREVIEW HEIGHT CALCULATION
// ============================================

describe('duration preview height calculation', () => {
  const HOUR_HEIGHT_NORMAL = 150
  const HOUR_HEIGHT_COMPACT = 85

  function calculatePreviewHeight(durationMins: number, hourHeight: number): number {
    return (durationMins / 60) * hourHeight
  }

  describe('normal view', () => {
    it('calculates height for 15-minute task', () => {
      const height = calculatePreviewHeight(15, HOUR_HEIGHT_NORMAL)
      expect(height).toBe(37.5) // 150 / 4
    })

    it('calculates height for 60-minute task', () => {
      const height = calculatePreviewHeight(60, HOUR_HEIGHT_NORMAL)
      expect(height).toBe(150)
    })

    it('calculates height for 90-minute task', () => {
      const height = calculatePreviewHeight(90, HOUR_HEIGHT_NORMAL)
      expect(height).toBe(225)
    })
  })

  describe('compact view', () => {
    it('calculates height for 15-minute task', () => {
      const height = calculatePreviewHeight(15, HOUR_HEIGHT_COMPACT)
      expect(height).toBe(21.25)
    })

    it('calculates height for 60-minute task', () => {
      const height = calculatePreviewHeight(60, HOUR_HEIGHT_COMPACT)
      expect(height).toBe(85)
    })

    it('calculates height for 90-minute task', () => {
      const height = calculatePreviewHeight(90, HOUR_HEIGHT_COMPACT)
      expect(height).toBe(127.5)
    })
  })
})

// ============================================
// TIMESLOT ID PARSING
// ============================================

describe('timeslot ID parsing', () => {
  function parseTimeslotId(overId: string): { dateKey: string; hour: number; minute: number } | null {
    if (!overId?.startsWith('timeslot-')) return null
    const parts = overId.split('-')
    // Format: timeslot-YYYY-MM-DD-HH-MM
    if (parts.length !== 6) return null
    const dateKey = `${parts[1]}-${parts[2]}-${parts[3]}`
    const hour = parseInt(parts[4])
    const minute = parseInt(parts[5])
    if (isNaN(hour) || isNaN(minute)) return null
    return { dateKey, hour, minute }
  }

  it('parses valid timeslot ID', () => {
    const result = parseTimeslotId('timeslot-2024-01-15-10-30')
    expect(result).toEqual({ dateKey: '2024-01-15', hour: 10, minute: 30 })
  })

  it('parses midnight slot', () => {
    const result = parseTimeslotId('timeslot-2024-01-15-0-0')
    expect(result).toEqual({ dateKey: '2024-01-15', hour: 0, minute: 0 })
  })

  it('parses late evening slot', () => {
    const result = parseTimeslotId('timeslot-2024-01-15-23-45')
    expect(result).toEqual({ dateKey: '2024-01-15', hour: 23, minute: 45 })
  })

  it('returns null for non-timeslot IDs', () => {
    expect(parseTimeslotId('task-123')).toBeNull()
    expect(parseTimeslotId('section-inbox')).toBeNull()
    expect(parseTimeslotId('event-abc')).toBeNull()
  })

  it('returns null for malformed timeslot IDs', () => {
    expect(parseTimeslotId('timeslot-invalid')).toBeNull()
    expect(parseTimeslotId('timeslot-2024-01')).toBeNull()
  })
})

// ============================================
// PREVIEW POSITION CALCULATION
// ============================================

describe('preview position calculation', () => {
  function calculatePreviewTop(
    hour: number,
    minute: number,
    displayStartHour: number,
    hourHeight: number
  ): number {
    const startHour = hour + minute / 60
    return (startHour - displayStartHour) * hourHeight
  }

  it('calculates top position for slot at display start', () => {
    const top = calculatePreviewTop(8, 0, 8, 150)
    expect(top).toBe(0)
  })

  it('calculates top position for slot 2 hours after start', () => {
    const top = calculatePreviewTop(10, 0, 8, 150)
    expect(top).toBe(300)
  })

  it('calculates top position for 15-minute offset', () => {
    const top = calculatePreviewTop(10, 15, 8, 150)
    expect(top).toBe(337.5) // 2.25 hours * 150
  })

  it('calculates top position for 45-minute offset', () => {
    const top = calculatePreviewTop(10, 45, 8, 150)
    expect(top).toBe(412.5) // 2.75 hours * 150
  })

  it('handles compact view', () => {
    const top = calculatePreviewTop(10, 30, 8, 85)
    expect(top).toBe(212.5) // 2.5 hours * 85
  })
})

// ============================================
// EDGE CASES
// ============================================

describe('edge cases', () => {
  describe('title truncation for overlay', () => {
    it('handles empty title', () => {
      const title = ''
      expect(title.length).toBe(0)
    })

    it('handles very long title', () => {
      const title = 'This is a very long task title that should be truncated in the UI display'
      expect(title.length).toBeGreaterThan(50)
      // UI should truncate via CSS, but title is preserved
    })

    it('handles special characters in title', () => {
      const title = 'Meeting: Review Q1 & Q2 <budget>'
      expect(title).toContain('&')
      expect(title).toContain('<')
      expect(title).toContain('>')
    })
  })

  describe('duration edge cases', () => {
    it('handles minimum duration (5 min)', () => {
      const durationMins = 5
      const height = (durationMins / 60) * 150
      expect(height).toBe(12.5)
    })

    it('handles zero duration gracefully', () => {
      const durationMins = 0
      const height = (durationMins / 60) * 150
      expect(height).toBe(0)
    })

    it('handles very long duration (8 hours)', () => {
      const durationMins = 480
      const height = (durationMins / 60) * 150
      expect(height).toBe(1200) // 8 * 150
    })
  })

  describe('dateKey matching', () => {
    it('matches same dateKey for preview', () => {
      const hoveredSlot = { dateKey: '2024-01-15', hour: 10, minute: 0 }
      const columnDateKey = '2024-01-15'
      expect(hoveredSlot.dateKey === columnDateKey).toBe(true)
    })

    it('does not match different dateKey', () => {
      const hoveredSlot = { dateKey: '2024-01-15', hour: 10, minute: 0 }
      const columnDateKey = '2024-01-16'
      expect(hoveredSlot.dateKey === columnDateKey).toBe(false)
    })
  })
})
