import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LoginScreen } from '../LoginScreen'

describe('LoginScreen', () => {
  it('renders login button', () => {
    render(<LoginScreen onLogin={() => {}} />)
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('renders app title', () => {
    render(<LoginScreen onLogin={() => {}} />)
    expect(screen.getByText('🧠 Brain Dump Calendar')).toBeInTheDocument()
  })

  it('calls onLogin when button clicked', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()
    render(<LoginScreen onLogin={onLogin} />)

    await user.click(screen.getByText('Sign in with Google'))
    expect(onLogin).toHaveBeenCalledOnce()
  })
})
