import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTasks } from '../useTasks'
import * as api from '../../lib/api'
import type { Task } from '../../types'

// Mock the api module
vi.mock('../../lib/api')

const mockTasks: Task[] = [
  {
    id: '1',
    user_id: 'user-1',
    title: 'Task 1',
    duration: 30,
    section: 'inbox',
    position: 0,
    scheduled: null,
    google_id: null,
    created_at: '2024-01-01',
  },
  {
    id: '2',
    user_id: 'user-1',
    title: 'Task 2',
    duration: 15,
    section: 'mustdo',
    position: 0,
    scheduled: null,
    google_id: null,
    created_at: '2024-01-01',
  },
]

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.fetchTasks).mockResolvedValue(mockTasks)
  })

  it('loads tasks on mount when userId provided', async () => {
    const { result } = renderHook(() => useTasks('user-1'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.tasks).toEqual(mockTasks)
    expect(api.fetchTasks).toHaveBeenCalledOnce()
  })

  it('does not load tasks when userId is undefined', async () => {
    const { result } = renderHook(() => useTasks(undefined))

    // Give it time to potentially make a call
    await new Promise(r => setTimeout(r, 100))

    expect(api.fetchTasks).not.toHaveBeenCalled()
    expect(result.current.tasks).toEqual([])
  })

  it('getTasksBySection filters and sorts correctly', async () => {
    const { result } = renderHook(() => useTasks('user-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const inboxTasks = result.current.getTasksBySection('inbox')
    expect(inboxTasks).toHaveLength(1)
    expect(inboxTasks[0].title).toBe('Task 1')

    const mustdoTasks = result.current.getTasksBySection('mustdo')
    expect(mustdoTasks).toHaveLength(1)
    expect(mustdoTasks[0].title).toBe('Task 2')
  })

  it('getTasksBySection excludes scheduled tasks', async () => {
    const tasksWithScheduled = [
      ...mockTasks,
      {
        ...mockTasks[0],
        id: '3',
        title: 'Scheduled Task',
        scheduled: '2024-01-01T10:00:00',
      },
    ]
    vi.mocked(api.fetchTasks).mockResolvedValue(tasksWithScheduled)

    const { result } = renderHook(() => useTasks('user-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const inboxTasks = result.current.getTasksBySection('inbox')
    expect(inboxTasks).toHaveLength(1)
    expect(inboxTasks[0].title).toBe('Task 1')
  })

  describe('addTask', () => {
    it('creates task and adds to state', async () => {
      const newTask: Task = {
        id: '3',
        user_id: 'user-1',
        title: 'New Task',
        duration: 45,
        section: 'inbox',
        position: 1,
        scheduled: null,
        google_id: null,
        created_at: '2024-01-01',
      }
      vi.mocked(api.createTask).mockResolvedValue(newTask)

      const { result } = renderHook(() => useTasks('user-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.addTask('New Task', 45)
      })

      expect(api.createTask).toHaveBeenCalledWith({
        title: 'New Task',
        duration: 45,
        section: 'inbox',
        position: 1,
      })
      expect(result.current.tasks).toContainEqual(newTask)
    })
  })

  describe('updateTaskDuration', () => {
    it('updates task duration in state', async () => {
      const updatedTask = { ...mockTasks[0], duration: 60 }
      vi.mocked(api.updateTask).mockResolvedValue(updatedTask)

      const { result } = renderHook(() => useTasks('user-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.updateTaskDuration('1', 60)
      })

      expect(api.updateTask).toHaveBeenCalledWith('1', { duration: 60 })
      expect(result.current.tasks.find(t => t.id === '1')?.duration).toBe(60)
    })
  })

  describe('removeTask', () => {
    it('removes task from state', async () => {
      vi.mocked(api.deleteTask).mockResolvedValue()

      const { result } = renderHook(() => useTasks('user-1'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.tasks).toHaveLength(2)

      await act(async () => {
        await result.current.removeTask('1')
      })

      expect(api.deleteTask).toHaveBeenCalledWith('1')
      expect(result.current.tasks).toHaveLength(1)
      expect(result.current.tasks.find(t => t.id === '1')).toBeUndefined()
    })
  })
})
