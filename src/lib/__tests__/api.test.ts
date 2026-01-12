import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from '../api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
  },
}))

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchTasks', () => {
    it('fetches tasks with auth header', async () => {
      const mockTasks = [{ id: '1', title: 'Task 1' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTasks),
      })

      const result = await api.fetchTasks()

      expect(mockFetch).toHaveBeenCalledWith('/api/tasks', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      })
      expect(result).toEqual(mockTasks)
    })

    it('throws on fetch error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(api.fetchTasks()).rejects.toThrow('Failed to fetch tasks')
    })
  })

  describe('createTask', () => {
    it('creates task with POST request', async () => {
      const newTask = { title: 'New Task', duration: 30, section: 'inbox', position: 0 }
      const createdTask = { id: '1', ...newTask }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdTask),
      })

      const result = await api.createTask(newTask)

      expect(mockFetch).toHaveBeenCalledWith('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify(newTask),
      })
      expect(result).toEqual(createdTask)
    })
  })

  describe('updateTask', () => {
    it('updates task with PATCH request', async () => {
      const updates = { duration: 60 }
      const updatedTask = { id: '1', title: 'Task', duration: 60 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedTask),
      })

      const result = await api.updateTask('1', updates)

      expect(mockFetch).toHaveBeenCalledWith('/api/tasks/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify(updates),
      })
      expect(result).toEqual(updatedTask)
    })
  })

  describe('deleteTask', () => {
    it('deletes task with DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await api.deleteTask('1')

      expect(mockFetch).toHaveBeenCalledWith('/api/tasks/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      })
    })

    it('throws on delete error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(api.deleteTask('1')).rejects.toThrow('Failed to delete task')
    })
  })

  describe('braindump', () => {
    it('sends braindump text and returns parsed tasks', async () => {
      const parsedTasks = [
        { title: 'Task 1', duration: 15 },
        { title: 'Task 2', duration: 30 },
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(parsedTasks),
      })

      const result = await api.braindump('Do task 1 and task 2')

      expect(mockFetch).toHaveBeenCalledWith('/api/braindump', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({ text: 'Do task 1 and task 2' }),
      })
      expect(result).toEqual(parsedTasks)
    })
  })

  describe('fetchCalendarEvents', () => {
    it('fetches events without date params', async () => {
      const events = [{ id: '1', title: 'Event' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(events),
      })

      await api.fetchCalendarEvents()

      expect(mockFetch).toHaveBeenCalledWith('/api/calendar', expect.any(Object))
    })

    it('fetches events with date params', async () => {
      const events = [{ id: '1', title: 'Event' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(events),
      })

      await api.fetchCalendarEvents('2024-01-01', '2024-01-07')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/calendar?startDate=2024-01-01&endDate=2024-01-07',
        expect.any(Object)
      )
    })
  })
})
