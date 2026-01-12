import { useState, useEffect } from 'react'
import { BRAIN_DUMP_PROMPTS } from '../types'
import { useGoals } from '../hooks/useGoals'

interface Props {
  isOpen: boolean
  loading: boolean
  onClose: () => void
  onSubmit: (text: string) => void
}

export function BrainDumpModal({ isOpen, loading, onClose, onSubmit }: Props) {
  const [text, setText] = useState('')
  const goals = useGoals()

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        goals.saveNow()
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, goals])

  if (!isOpen) return null

  const handleSubmit = () => {
    if (text.trim()) {
      goals.saveNow()
      onSubmit(text)
      setText('')
    }
  }

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      goals.saveNow()
      onClose()
    }
  }

  const handleClose = () => {
    goals.saveNow()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
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

          {/* Goals Section */}
          <div className="space-y-3 mb-4 p-3 bg-neutral-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-neutral-700 flex items-center gap-1 mb-1">
                🎯 Mandatory Goals
                {goals.saving && <span className="text-xs text-neutral-400">(saving...)</span>}
              </label>
              <textarea
                value={goals.mandatory}
                onChange={(e) => goals.setMandatory(e.target.value)}
                onBlur={goals.saveNow}
                placeholder="- Ship v1 by Friday&#10;- Fix critical bug"
                className="w-full h-20 p-2 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300"
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
                onBlur={goals.saveNow}
                placeholder="- Refactor auth module&#10;- Add dark mode"
                className="w-full h-20 p-2 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300"
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
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start typing your thoughts..."
            className="w-full h-48 p-3 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300"
            autoFocus
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
            disabled={!text.trim() || loading}
            className="px-4 py-2 bg-neutral-800 text-white text-sm font-medium rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Extract Tasks'}
          </button>
        </div>
      </div>
    </div>
  )
}
