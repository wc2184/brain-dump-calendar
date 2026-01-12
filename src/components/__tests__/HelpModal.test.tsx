import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HelpModal } from '../HelpModal'

describe('HelpModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <HelpModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal when open', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
  })

  it('displays all keyboard shortcuts', () => {
    render(<HelpModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Shift + Click')).toBeInTheDocument()
    expect(screen.getByText('Delete mode - click tasks/events to delete')).toBeInTheDocument()
    expect(screen.getByText('n')).toBeInTheDocument()
    expect(screen.getByText('Next day')).toBeInTheDocument()
    expect(screen.getByText('p')).toBeInTheDocument()
    expect(screen.getByText('Previous day')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
    expect(screen.getByText('Open brain dump')).toBeInTheDocument()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(<HelpModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<HelpModal isOpen={true} onClose={onClose} />)

    // Click the backdrop (the outer div with bg-black/50)
    const backdrop = screen.getByText('Keyboard Shortcuts').parentElement?.parentElement?.parentElement
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<HelpModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
