import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UndoToast } from '../UndoToast'

describe('UndoToast', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(
      <UndoToast count={0} onUndo={vi.fn()} onDismiss={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders with singular text for 1 item', () => {
    render(<UndoToast count={1} onUndo={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText('1 item deleted')).toBeInTheDocument()
  })

  it('renders with plural text for multiple items', () => {
    render(<UndoToast count={5} onUndo={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText('5 items deleted')).toBeInTheDocument()
  })

  it('calls onUndo when Undo button is clicked', () => {
    const onUndo = vi.fn()
    render(<UndoToast count={2} onUndo={onUndo} onDismiss={vi.fn()} />)

    fireEvent.click(screen.getByText('Undo'))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when X button is clicked', () => {
    const onDismiss = vi.fn()
    render(<UndoToast count={2} onUndo={vi.fn()} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByText('✕'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
