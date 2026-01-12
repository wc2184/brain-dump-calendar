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

  const unscheduleTask = async (taskId: string) => {
    const updated = await api.updateTask(taskId, {
      scheduled: null,
      google_id: null
    })
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    return updated
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
    unscheduleTask,
    getTasksBySection,
    restoreTask,
    reload: loadTasks,
  }
}
