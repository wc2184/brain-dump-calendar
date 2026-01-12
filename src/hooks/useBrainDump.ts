import { useState, useEffect, useRef, useCallback } from 'react'
import * as api from '../lib/api'

export function useBrainDump(onTasksCreated: (tasks: { title: string; duration: number }[]) => void) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tentativeText, setTentativeText] = useState('')
  const [loadingTentative, setLoadingTentative] = useState(true)

  // Track if there are unsaved changes
  const hasChanges = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef('')

  // Load tentative braindump on mount
  useEffect(() => {
    const load = async () => {
      try {
        const goals = await api.getGoals()
        const saved = goals.tentative_braindump || ''
        setTentativeText(saved)
        lastSaved.current = saved
      } catch (err) {
        console.error('Failed to load tentative braindump:', err)
      } finally {
        setLoadingTentative(false)
      }
    }
    load()
  }, [])

  // Save function
  const save = useCallback(async (text: string) => {
    if (text === lastSaved.current) return

    try {
      await api.saveTentativeBraindump(text)
      lastSaved.current = text
      hasChanges.current = false
    } catch (err) {
      console.error('Failed to save tentative braindump:', err)
    }
  }, [])

  // Update text with debounced save
  const updateTentativeText = useCallback((text: string) => {
    setTentativeText(text)
    hasChanges.current = true

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      save(text)
    }, 2000) // 2 second debounce
  }, [save])

  // Save immediately (for blur/close)
  const saveNow = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    if (hasChanges.current) {
      save(tentativeText)
    }
  }, [tentativeText, save])

  // Clear tentative (after successful extract)
  const clearTentative = useCallback(async () => {
    setTentativeText('')
    lastSaved.current = ''
    hasChanges.current = false
    try {
      await api.saveTentativeBraindump('')
    } catch (err) {
      console.error('Failed to clear tentative braindump:', err)
    }
  }, [])

  const open = () => setIsOpen(true)

  const close = () => {
    saveNow()
    setIsOpen(false)
  }

  const submit = async (text: string) => {
    setLoading(true)
    try {
      const tasks = await api.braindump(text)
      onTasksCreated(tasks)
      await clearTentative()
      setIsOpen(false)
    } catch (err) {
      console.error('Brain dump failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return {
    isOpen,
    loading,
    loadingTentative,
    tentativeText,
    updateTentativeText,
    saveNow,
    open,
    close,
    submit
  }
}
