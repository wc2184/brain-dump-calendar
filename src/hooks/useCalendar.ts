import { useState, useEffect, useCallback, useMemo } from 'react'
import type { CalendarEvent } from '../types'
import * as api from '../lib/api'
import type { CalendarEventUpdate } from '../lib/api'

// Helper to get start of day
function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to add days
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Load compact state from localStorage
function loadCompactState(): boolean {
  try {
    return localStorage.getItem('calendar-compact') === 'true'
  } catch {
    return false
  }
}

export function useCalendar(userId: string | undefined) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [centerDate, setCenterDate] = useState(() => startOfDay(new Date()))
  const [viewMode, setViewMode] = useState<'1day' | '3day'>('3day')
  const [isCompact, setIsCompact] = useState(loadCompactState)

  // Compute date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === '1day') {
      return { start: centerDate, end: addDays(centerDate, 1) }
    }
    const start = addDays(centerDate, -1)
    const end = addDays(centerDate, 2) // exclusive end
    return { start, end }
  }, [centerDate, viewMode])

  // Array of dates to display based on view mode
  const visibleDates = useMemo(() => {
    if (viewMode === '1day') {
      return [centerDate]
    }
    return [
      addDays(centerDate, -1),
      centerDate,
      addDays(centerDate, 1)
    ]
  }, [centerDate, viewMode])

  const loadEvents = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const data = await api.fetchCalendarEvents(
        dateRange.start.toISOString(),
        dateRange.end.toISOString()
      )
      setEvents(data)
    } catch (err) {
      console.error('Failed to load calendar:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, dateRange])

  useEffect(() => {
    if (userId) {
      loadEvents()
    }
  }, [userId, loadEvents])

  const addEvent = (event: CalendarEvent) => {
    setEvents(prev => [...prev, event])
  }

  // Replace a temp event with the real event (for optimistic updates)
  const replaceEvent = (tempId: string, realEvent: CalendarEvent) => {
    setEvents(prev => prev.map(e => e.id === tempId ? realEvent : e))
  }

  // Remove event by ID (for rollback without API call)
  const removeEventLocal = (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  // Optimistic update - updates UI immediately, then syncs with API
  const updateEventOptimistic = (eventId: string, updates: { startTime: string; duration: number }) => {
    // Calculate new end time
    const newEnd = new Date(new Date(updates.startTime).getTime() + updates.duration * 60000)

    // Store original event for rollback
    let originalEvent: CalendarEvent | undefined
    setEvents(prev => {
      originalEvent = prev.find(e => e.id === eventId)
      return prev.map(e => {
        if (e.id !== eventId) return e
        return {
          ...e,
          start: updates.startTime,
          end: newEnd.toISOString()
        }
      })
    })

    // Fire API call in background (don't await)
    api.updateCalendarEvent(eventId, updates).catch(err => {
      console.error('Failed to update event, rolling back:', err)
      // Rollback to original state
      if (originalEvent) {
        setEvents(prev => prev.map(e => e.id === eventId ? originalEvent! : e))
      }
    })
  }

  const updateEvent = async (eventId: string, updates: CalendarEventUpdate) => {
    const updated = await api.updateCalendarEvent(eventId, updates)
    setEvents(prev => prev.map(e => e.id === eventId ? updated : e))
    return updated
  }

  // Optimistic remove - removes from UI immediately, then syncs with API
  const removeEventOptimistic = (eventId: string) => {
    // Store original event for rollback
    let removedEvent: CalendarEvent | undefined
    setEvents(prev => {
      removedEvent = prev.find(e => e.id === eventId)
      return prev.filter(e => e.id !== eventId)
    })

    // Fire API call in background
    api.deleteCalendarEvent(eventId).catch(err => {
      console.error('Failed to delete event, rolling back:', err)
      // Rollback - add event back
      if (removedEvent) {
        setEvents(prev => [...prev, removedEvent!])
      }
    })
  }

  const removeEvent = async (eventId: string) => {
    await api.deleteCalendarEvent(eventId)
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  // Navigation helpers
  const goToPrevDay = () => setCenterDate(prev => addDays(prev, -1))
  const goToNextDay = () => setCenterDate(prev => addDays(prev, 1))
  const goToToday = () => setCenterDate(startOfDay(new Date()))
  const toggleCompact = () => {
    setIsCompact(prev => {
      const next = !prev
      localStorage.setItem('calendar-compact', String(next))
      return next
    })
  }

  // Restore a deleted event by re-creating it in Google Calendar
  const restoreEvent = async (event: CalendarEvent) => {
    // Note: This creates a NEW event in Google Calendar (different ID)
    // We need to find a task that was linked to this event to restore it
    // For now, we'll just add it back to local state - the API doesn't support
    // restoring deleted Google events directly
    // This will be handled at App level by re-creating via API
    setEvents(prev => [...prev, event])
    return event
  }

  return {
    events,
    loading,
    centerDate,
    visibleDates,
    viewMode,
    setViewMode,
    isCompact,
    toggleCompact,
    dateRange,
    addEvent,
    replaceEvent,
    removeEventLocal,
    updateEvent,
    updateEventOptimistic,
    removeEvent,
    removeEventOptimistic,
    restoreEvent,
    goToPrevDay,
    goToNextDay,
    goToToday,
    reload: loadEvents,
  }
}
