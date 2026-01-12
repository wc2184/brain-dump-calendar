import { useState, useEffect, useCallback } from 'react'
import type { Task, SectionType } from '../types'
import * as api from '../lib/api'

export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const loadTasks = useCallback(async () => {
    if (!userId) return
    try {
      const data = await api.fetchTasks()
      setTasks(data)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      loadTasks()
    }
  }, [userId, loadTasks])

  const addTask = async (title: string, duration: number, section: SectionType = 'inbox') => {
    const sectionTasks = tasks.filter(t => t.section === section)
    const position = sectionTasks.length
    const task = await api.createTask({ title, duration, section, position })
    setTasks(prev => [...prev, task])
    return task
  }

  const updateTaskDuration = async (id: string, duration: number) => {
    const updated = await api.updateTask(id, { duration })
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
  }

  const updateTaskTitle = async (id: string, title: string) => {
    const updated = await api.updateTask(id, { title })
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
  }

  const removeTask = async (id: string) => {
    await api.deleteTask(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const moveTask = async (taskId: string, toSection: SectionType, toIndex: number) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const fromSection = task.section
    const updatedTasks = [...tasks]

    // Remove from current position
    const taskIndex = updatedTasks.findIndex(t => t.id === taskId)
    updatedTasks.splice(taskIndex, 1)

    // Insert at new position
    const insertIndex = updatedTasks.findIndex(t => t.section === toSection && t.position >= toIndex)
    const movedTask = { ...task, section: toSection, position: toIndex }

    if (insertIndex === -1) {
      updatedTasks.push(movedTask)
    } else {
      updatedTasks.splice(insertIndex, 0, movedTask)
    }

    // Recalculate positions for affected sections
    const sectionsToUpdate = new Set([fromSection, toSection])
    const reorderPayload: { id: string; section: SectionType; position: number }[] = []

    sectionsToUpdate.forEach(section => {
      updatedTasks
        .filter(t => t.section === section)
        .forEach((t, idx) => {
          t.position = idx
          reorderPayload.push({ id: t.id, section: t.section, position: idx })
        })
    })

    setTasks(updatedTasks)
    await api.reorderTasks(reorderPayload)
  }

  const scheduleTask = async (taskId: string, startTime: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const event = await api.createCalendarEvent(taskId, startTime)
    const updated = await api.updateTask(taskId, {
      scheduled: startTime,
      google_id: event.id
    })
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    return event
  }

  // Optimistic schedule - updates UI immediately, returns temp event, syncs in background
  // onEventCreated callback is called with real event when API responds (to replace temp event)
  // onRollback callback is called if API fails (to remove temp event)
  const scheduleTaskOptimistic = (
    taskId: string,
    startTime: string,
    onEventCreated?: (tempId: string, realEvent: import('../types').CalendarEvent) => void,
    onRollback?: (tempId: string) => void
  ): { tempEvent: import('../types').CalendarEvent } | null => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return null

    // Create temporary event for immediate UI display
    const endTime = new Date(new Date(startTime).getTime() + task.duration * 60000)
    const tempEventId = `temp-${taskId}-${Date.now()}`
    const tempEvent: import('../types').CalendarEvent = {
      id: tempEventId,
      title: task.title,
      start: startTime,
      end: endTime.toISOString(),
      isGoogleEvent: false,
      taskId: taskId
    }

    // Update task as scheduled immediately
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      scheduled: startTime,
      google_id: tempEventId
    } : t))

    // Fire API calls in background, update with real IDs when done
    api.createCalendarEvent(taskId, startTime)
      .then(async (realEvent) => {
        await api.updateTask(taskId, {
          scheduled: startTime,
          google_id: realEvent.id
        })
        // Update task with real google_id
        setTasks(prev => prev.map(t => t.id === taskId ? {
          ...t,
          google_id: realEvent.id
        } : t))
        // Notify caller to replace temp event with real event
        if (onEventCreated) {
          onEventCreated(tempEventId, realEvent)
        }
      })
      .catch(err => {
        console.error('Failed to schedule task, rolling back:', err)
        // Revert task state
        setTasks(prev => prev.map(t => t.id === taskId ? {
          ...t,
          scheduled: null,
          google_id: null
        } : t))
        // Notify caller to remove temp event
        if (onRollback) {
          onRollback(tempEventId)
        }
      })

    return { tempEvent }
  }

  const unscheduleTask = async (taskId: string) => {
    const updated = await api.updateTask(taskId, {
      scheduled: null,
      google_id: null
    })
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    return updated
  }

  // Optimistic unschedule + move - updates UI immediately, syncs in background
  // onRollback callback is called if API fails (to restore calendar event)
  const unscheduleAndMoveTask = (
    taskId: string,
    toSection: SectionType,
    toIndex: number,
    onRollback?: (originalTask: Task) => void
  ) => {
    // Store original task for rollback
    let originalTask: Task | undefined
    let originalTasks: Task[] = []

    // Atomic local state update FIRST: unschedule + move + reorder
    setTasks(prev => {
      originalTask = prev.find(t => t.id === taskId)
      originalTasks = [...prev] // store for rollback
      if (!originalTask) return prev

      const fromSection = originalTask.section
      const updatedTasks = [...prev]

      // Find and update the task
      const taskIndex = updatedTasks.findIndex(t => t.id === taskId)
      updatedTasks.splice(taskIndex, 1)

      // Create unscheduled + moved task
      const movedTask = { ...originalTask, section: toSection, position: toIndex, scheduled: null, google_id: null }

      // Insert at new position
      const insertIndex = updatedTasks.findIndex(t => t.section === toSection && t.position >= toIndex)
      if (insertIndex === -1) {
        updatedTasks.push(movedTask)
      } else {
        updatedTasks.splice(insertIndex, 0, movedTask)
      }

      // Recalculate positions for affected sections
      const sectionsToUpdate = new Set([fromSection, toSection])
      sectionsToUpdate.forEach(section => {
        updatedTasks
          .filter(t => t.section === section)
          .forEach((t, idx) => {
            t.position = idx
          })
      })

      return updatedTasks
    })

    // Fire API calls in background
    api.updateTask(taskId, { scheduled: null, google_id: null })
      .then(async () => {
        // Sync positions to backend
        const currentTasks = await api.fetchTasks()
        const toSectionTasks = currentTasks.filter(t => t.section === toSection)
        const reorderPayload = toSectionTasks.map((t, idx) => ({
          id: t.id,
          section: t.section,
          position: idx
        }))
        if (reorderPayload.length > 0) {
          await api.reorderTasks(reorderPayload)
        }
      })
      .catch(err => {
        console.error('Failed to unschedule and move task, rolling back:', err)
        // Rollback to original state
        setTasks(originalTasks)
        if (onRollback && originalTask) {
          onRollback(originalTask)
        }
      })
  }

  const getTasksBySection = (section: SectionType) => {
    return tasks
      .filter(t => t.section === section && !t.scheduled)
      .sort((a, b) => a.position - b.position)
  }

  const restoreTask = async (task: Task) => {
    const restored = await api.createTask({
      title: task.title,
      duration: task.duration,
      section: task.section,
      position: task.position
    })
    setTasks(prev => [...prev, restored])
    return restored
  }

  return {
    tasks,
    loading,
    addTask,
    updateTaskDuration,
    updateTaskTitle,
    removeTask,
    moveTask,
    scheduleTask,
    scheduleTaskOptimistic,
    unscheduleTask,
    unscheduleAndMoveTask,
    getTasksBySection,
    restoreTask,
    reload: loadTasks,
  }
}
