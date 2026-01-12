import { useState, useEffect, useRef, useCallback } from 'react'
import * as api from '../lib/api'

export function useGoals() {
  const [mandatory, setMandatory] = useState('')
  const [niceToHave, setNiceToHave] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Track if there are unsaved changes
  const hasChanges = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef({ mandatory: '', niceToHave: '' })

  // Load goals on mount
  useEffect(() => {
    const load = async () => {
      try {
        const goals = await api.getGoals()
        setMandatory(goals.mandatory_goals)
        setNiceToHave(goals.nice_to_have_goals)
        lastSaved.current = {
          mandatory: goals.mandatory_goals,
          niceToHave: goals.nice_to_have_goals
        }
      } catch (err) {
        console.error('Failed to load goals:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Save function
  const save = useCallback(async (m: string, n: string) => {
    // Skip if no changes
    if (m === lastSaved.current.mandatory && n === lastSaved.current.niceToHave) {
      return
    }

    setSaving(true)
    try {
      await api.saveGoals({ mandatory_goals: m, nice_to_have_goals: n })
      lastSaved.current = { mandatory: m, niceToHave: n }
      hasChanges.current = false
    } catch (err) {
      console.error('Failed to save goals:', err)
    } finally {
      setSaving(false)
    }
  }, [])

  // Debounced save on changes
  useEffect(() => {
    if (loading) return

    hasChanges.current = true

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      save(mandatory, niceToHave)
    }, 500)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [mandatory, niceToHave, loading, save])

  // Immediate save for blur/close events
  const saveNow = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    if (hasChanges.current) {
      save(mandatory, niceToHave)
    }
  }, [mandatory, niceToHave, save])

  return {
    mandatory,
    niceToHave,
    setMandatory,
    setNiceToHave,
    loading,
    saving,
    saveNow,
  }
}
