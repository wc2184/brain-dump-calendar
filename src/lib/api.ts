import type { Task, CalendarEvent, SectionType } from '../types'
import { supabase } from './supabase'

const API_BASE = '/api'

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`
  }
}

export async function fetchTasks(): Promise<Task[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/tasks`, { headers })
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

export async function createTask(task: Partial<Task>): Promise<Task> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(task),
  })
  if (!res.ok) throw new Error('Failed to create task')
  return res.json()
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update task')
  return res.json()
}

export async function deleteTask(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error('Failed to delete task')
}

export async function reorderTasks(tasks: { id: string; section: SectionType; position: number }[]): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/tasks/reorder`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ tasks }),
  })
  if (!res.ok) throw new Error('Failed to reorder tasks')
}

export async function fetchCalendarEvents(startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)
  const query = params.toString() ? `?${params}` : ''
  const res = await fetch(`${API_BASE}/calendar${query}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch calendar')
  return res.json()
}

export async function createCalendarEvent(taskId: string, startTime: string): Promise<CalendarEvent> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/calendar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ taskId, startTime }),
  })
  if (!res.ok) throw new Error('Failed to create event')
  return res.json()
}

export interface CalendarEventUpdate {
  startTime?: string
  duration?: number
  colorId?: string | null
  title?: string
}

export async function updateCalendarEvent(eventId: string, updates: CalendarEventUpdate): Promise<CalendarEvent> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/calendar/${eventId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update event')
  return res.json()
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/calendar/${eventId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete event')
}

export async function braindump(text: string): Promise<{ title: string; duration: number }[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/braindump`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Failed to process braindump')
  return res.json()
}

export interface UserGoals {
  mandatory_goals: string
  nice_to_have_goals: string
  tentative_braindump?: string
}

export async function getGoals(): Promise<UserGoals> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/goals`, { headers })
  if (!res.ok) throw new Error('Failed to fetch goals')
  return res.json()
}

export async function saveGoals(goals: Partial<UserGoals>): Promise<UserGoals> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/goals`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(goals),
  })
  if (!res.ok) throw new Error('Failed to save goals')
  return res.json()
}

export async function saveTentativeBraindump(text: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/goals`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ tentative_braindump: text }),
  })
  if (!res.ok) throw new Error('Failed to save tentative braindump')
}

export interface UserSettings {
  reflection_url: string
}

export async function getSettings(): Promise<UserSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, { headers })
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export async function saveSettings(settings: UserSettings): Promise<UserSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to save settings')
  return res.json()
}
