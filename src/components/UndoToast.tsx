interface Props {
  count: number
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({ count, onUndo, onDismiss }: Props) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-4 left-4 bg-neutral-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
      <span>{count} item{count > 1 ? 's' : ''} deleted</span>
      <button
        onClick={onUndo}
        className="text-blue-400 hover:text-blue-300 font-medium"
      >
        Undo
      </button>
      <button
        onClick={onDismiss}
        className="text-neutral-400 hover:text-neutral-300"
      >
        ✕
      </button>
    </div>
  )
}
