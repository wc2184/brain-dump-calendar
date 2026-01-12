import { useState, useRef, useEffect } from 'react'

interface ReflectionLinkProps {
  url: string
  onSave: (url: string) => void
}

export function ReflectionLink({ url, onSave }: ReflectionLinkProps) {
  const [showEditPopup, setShowEditPopup] = useState(false)
  const [editValue, setEditValue] = useState(url)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(url)
  }, [url])

  useEffect(() => {
    if (showEditPopup && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [showEditPopup])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowEditPopup(false)
      }
    }
    if (showEditPopup) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEditPopup])

  const handleClick = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      setShowEditPopup(true)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowEditPopup(true)
  }

  const handleSave = () => {
    onSave(editValue.trim())
    setShowEditPopup(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setShowEditPopup(false)
      setEditValue(url)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="flex items-center gap-1.5 text-neutral-800 hover:text-neutral-600 transition-colors"
        title={url ? 'Click to open, right-click to edit' : 'Right-click to set URL'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        <span className="underline">Reflection</span>
      </button>

      {showEditPopup && (
        <div
          ref={popupRef}
          className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-neutral-200 p-3 z-50 w-80"
        >
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Reflection URL
          </label>
          <input
            ref={inputRef}
            type="url"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://docs.google.com/..."
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setShowEditPopup(false)
                setEditValue(url)
              }}
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm bg-neutral-800 text-white rounded-md hover:bg-neutral-700"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
