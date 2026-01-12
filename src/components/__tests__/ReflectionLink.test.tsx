import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReflectionLink } from '../ReflectionLink'

describe('ReflectionLink', () => {
  const defaultProps = {
    url: 'https://docs.google.com/test',
    onSave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders link icon and "Reflection" text', () => {
    render(<ReflectionLink {...defaultProps} />)
    expect(screen.getByText('Reflection')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has underlined text styling', () => {
    render(<ReflectionLink {...defaultProps} />)
    const text = screen.getByText('Reflection')
    expect(text).toHaveClass('underline')
  })

  it('opens URL in new tab on left click when URL exists', async () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()

    render(<ReflectionLink {...defaultProps} />)
    await user.click(screen.getByRole('button'))

    expect(windowOpen).toHaveBeenCalledWith(
      'https://docs.google.com/test',
      '_blank',
      'noopener,noreferrer'
    )
    windowOpen.mockRestore()
  })

  it('shows edit popup on right click', async () => {
    render(<ReflectionLink {...defaultProps} />)

    fireEvent.contextMenu(screen.getByRole('button'))

    expect(screen.getByLabelText('Reflection URL')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('https://docs.google.com/test')
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('shows edit popup on left click when no URL set', async () => {
    const user = userEvent.setup()
    render(<ReflectionLink url="" onSave={vi.fn()} />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByLabelText('Reflection URL')).toBeInTheDocument()
  })

  it('calls onSave with new URL when Save clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ReflectionLink url="" onSave={onSave} />)

    fireEvent.contextMenu(screen.getByRole('button'))

    const input = screen.getByRole('textbox')
    await user.type(input, 'https://example.com/new')
    await user.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledWith('https://example.com/new')
  })

  it('calls onSave on Enter key', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ReflectionLink url="" onSave={onSave} />)

    fireEvent.contextMenu(screen.getByRole('button'))

    const input = screen.getByRole('textbox')
    await user.type(input, 'https://example.com/enter{Enter}')

    expect(onSave).toHaveBeenCalledWith('https://example.com/enter')
  })

  it('closes popup on Cancel without saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ReflectionLink {...defaultProps} onSave={onSave} />)

    fireEvent.contextMenu(screen.getByRole('button'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    await user.click(screen.getByText('Cancel'))

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('closes popup on Escape without saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ReflectionLink {...defaultProps} onSave={onSave} />)

    fireEvent.contextMenu(screen.getByRole('button'))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})
