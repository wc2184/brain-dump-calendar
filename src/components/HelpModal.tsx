import { useEffect } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { key: 'Shift + Click', description: 'Delete mode - click tasks/events to delete' },
  { key: 'n', description: 'Next day' },
  { key: 'p', description: 'Previous day' },
  { key: 't', description: 'Go to today' },
  { key: 'd', description: 'Day view' },
  { key: '3', description: '3-day view' },
  { key: 'c', description: 'Toggle compact view' },
  { key: 'b', description: 'Open brain dump' },
]

export function HelpModal({ isOpen, onClose }: Props) {
  // ESC to close
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-xl">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <table className="w-full">
            <tbody>
              {SHORTCUTS.map(({ key, description }) => (
                <tr key={key} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-4">
                    <kbd className="px-2 py-1 bg-neutral-100 rounded text-sm font-mono text-neutral-700">
                      {key}
                    </kbd>
                  </td>
                  <td className="py-2 text-sm text-neutral-600">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-neutral-50 rounded-b-xl">
          <p className="text-xs text-neutral-500 text-center">
            Press <kbd className="px-1 bg-neutral-200 rounded text-xs">?</kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  )
}
