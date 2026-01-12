import { useState } from 'react'
import * as api from '../lib/api'

export function useBrainDump(onTasksCreated: (tasks: { title: string; duration: number }[]) => void) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)

  const submit = async (text: string) => {
    setLoading(true)
    try {
      const tasks = await api.braindump(text)
      onTasksCreated(tasks)
      close()
    } catch (err) {
      console.error('Brain dump failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return { isOpen, loading, open, close, submit }
}
