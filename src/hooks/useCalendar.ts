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

  const updateEvent = async (eventId: string, updates: CalendarEventUpdate) => {
    const updated = await api.updateCalendarEvent(eventId, updates)
    setEvents(prev => prev.map(e => e.id === eventId ? updated : e))
    return updated
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
    updateEvent,
    removeEvent,
    goToPrevDay,
    goToNextDay,
    goToToday,
    reload: loadEvents,
  }
}
