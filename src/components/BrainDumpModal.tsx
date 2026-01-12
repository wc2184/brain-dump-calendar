import { useEffect, useRef } from 'react'
import { BRAIN_DUMP_PROMPTS } from '../types'
import { useGoals } from '../hooks/useGoals'

interface Props {
  isOpen: boolean
  loading: boolean
  tentativeText: string
  onTextChange: (text: string) => void
  onBlur: () => void
  onClose: () => void
  onSubmit: (text: string) => void
}

export function BrainDumpModal({
  isOpen,
  loading,
  tentativeText,
  onTextChange,
  onBlur,
  onClose,
  onSubmit
}: Props) {
  const goals = useGoals()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        goals.saveNow()
        onBlur()
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, onBlur, goals])

  // Focus textarea and move cursor to end when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      const len = tentativeText.length
      textarea.setSelectionRange(len, len)
    }
  }, [isOpen]) // Only on open, not on text change

  if (!isOpen) return null

  const handleSubmit = () => {
    if (tentativeText.trim()) {
      goals.saveNow()
      onSubmit(tentativeText)
    }
  }

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      goals.saveNow()
      onBlur()
      onClose()
    }
  }

  const handleClose = () => {
    goals.saveNow()
    onBlur()
    onClose()
  }

  // Handle keydown for Enter (new line with dash) and first char dash
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    value: string,
    setValue: (v: string) => void
  ) => {
    // First char in empty textarea - prepend "- "
    if (!value && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      setValue('- ' + e.key)
      // Cursor will be at position 3 after React re-renders
      setTimeout(() => {
        const textarea = e.currentTarget
        textarea.selectionStart = textarea.selectionEnd = 3
      }, 0)
      return
    }

    // Enter key - add new line with dash
    if (e.key === 'Enter') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.slice(0, start) + '\n- ' + value.slice(end)
      setValue(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 3
      }, 0)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl w-full max-w-3xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-800">🧠 Brain Dump</h2>
            <button
              onClick={handleClose}
              className="text-neutral-400 hover:text-neutral-600"
            >
              ✕
            </button>
          </div>

          {/* Top Priority - single line */}
          <div className="mb-4 flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700 whitespace-nowrap">
              🐸 #1 Task
            </label>
            <input
              type="text"
              value={goals.topPriority}
              onChange={(e) => goals.setTopPriority(e.target.value)}
              onBlur={goals.saveNow}
              placeholder="What's the one thing you must do today?"
              className="flex-1 px-3 py-1.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
              disabled={goals.loading}
            />
          </div>

          {/* Goals Section */}
          <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-neutral-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-neutral-700 flex items-center gap-1 mb-1">
                🎯 Mandatory Goals
                {goals.saving && <span className="text-xs text-neutral-400">(saving...)</span>}
              </label>
              <textarea
                value={goals.mandatory}
                onChange={(e) => goals.setMandatory(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, goals.mandatory, goals.setMandatory)}
                onBlur={goals.saveNow}
                placeholder="Ship v1 by Friday"
                className="w-full h-32 p-2 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300"
                disabled={goals.loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 flex items-center gap-1 mb-1">
                ✨ Nice to Have Goals
              </label>
              <textarea
                value={goals.niceToHave}
                onChange={(e) => goals.setNiceToHave(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, goals.niceToHave, goals.setNiceToHave)}
                onBlur={goals.saveNow}
                placeholder="Refactor auth module"
                className="w-full h-32 p-2 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300"
                disabled={goals.loading}
              />
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-sm text-neutral-500">Let it all out. Think about:</p>
            <ul className="text-sm text-neutral-600 space-y-1">
              {BRAIN_DUMP_PROMPTS.map((prompt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-neutral-400">•</span>
                  <span>{prompt}</span>
                </li>
              ))}
            </ul>
          </div>

          <textarea
            ref={textareaRef}
            value={tentativeText}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, tentativeText, onTextChange)}
            onBlur={onBlur}
            placeholder="Start typing your thoughts..."
            className="w-full h-48 p-3 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </div>

        <div className="p-4 bg-neutral-50 rounded-b-xl flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!tentativeText.trim() || loading}
            className="px-4 py-2 bg-neutral-800 text-white text-sm font-medium rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Extract Tasks'}
          </button>
        </div>
      </div>
    </div>
  )
}
