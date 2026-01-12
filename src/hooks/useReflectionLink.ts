import { useState, useEffect, useCallback } from 'react'
import * as api from '../lib/api'

export function useReflectionLink() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await api.getSettings()
        setUrl(settings.reflection_url)
      } catch (err) {
        console.error('Failed to load reflection link:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const save = useCallback(async (newUrl: string) => {
    try {
      await api.saveSettings({ reflection_url: newUrl })
      setUrl(newUrl)
    } catch (err) {
      console.error('Failed to save reflection link:', err)
    }
  }, [])

  return { url, loading, save }
}
