import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DurationButtons } from '../DurationButtons'
import { DURATIONS } from '../../types'

describe('DurationButtons', () => {
  it('renders all duration options', () => {
    render(<DurationButtons value={30} onChange={() => {}} />)

    DURATIONS.forEach(d => {
      expect(screen.getByText(d.label)).toBeInTheDocument()
    })
  })

  it('highlights selected duration', () => {
    render(<DurationButtons value={30} onChange={() => {}} />)

    const selectedBtn = screen.getByText('30')
    expect(selectedBtn).toHaveClass('bg-neutral-800', 'text-white')
  })

  it('non-selected buttons have neutral style', () => {
    render(<DurationButtons value={30} onChange={() => {}} />)

    const unselectedBtn = screen.getByText('15')
    expect(unselectedBtn).toHaveClass('bg-neutral-100', 'text-neutral-600')
  })

  it('calls onChange with correct duration when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DurationButtons value={30} onChange={onChange} />)

    await user.click(screen.getByText('1h'))
    expect(onChange).toHaveBeenCalledWith(60)

    await user.click(screen.getByText('5'))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('updates highlight when value prop changes', () => {
    const { rerender } = render(<DurationButtons value={15} onChange={() => {}} />)
    expect(screen.getByText('15')).toHaveClass('bg-neutral-800')

    rerender(<DurationButtons value={60} onChange={() => {}} />)
    expect(screen.getByText('1h')).toHaveClass('bg-neutral-800')
    expect(screen.getByText('15')).toHaveClass('bg-neutral-100')
  })
})
