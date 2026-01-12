import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBrainDump } from '../useBrainDump'
import * as api from '../../lib/api'

vi.mock('../../lib/api')

describe('useBrainDump', () => {
  const mockOnTasksCreated = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getGoals).mockResolvedValue({
      mandatory_goals: '',
      nice_to_have_goals: '',
      tentative_braindump: 'saved draft text'
    })
    vi.mocked(api.saveTentativeBraindump).mockResolvedValue()
    vi.mocked(api.braindump).mockResolvedValue([
      { title: 'Task 1', duration: 30 }
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads tentative text on mount', async () => {
    const { result } = renderHook(() => useBrainDump(mockOnTasksCreated))

    expect(result.current.loadingTentative).toBe(true)

    await waitFor(() => {
      expect(result.current.loadingTentative).toBe(false)
    })

    expect(result.current.tentativeText).toBe('saved draft text')
    expect(api.getGoals).toHaveBeenCalled()
  })

  it('updates text and triggers debounced save', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useBrainDump(mockOnTasksCreated))

    // Wait for initial load
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    // Update text
    act(() => {
      result.current.updateTentativeText('new text')
    })

    expect(result.current.tentativeText).toBe('new text')
    expect(api.saveTentativeBraindump).not.toHaveBeenCalled()

    // Advance past debounce time
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100)
    })

    expect(api.saveTentativeBraindump).toHaveBeenCalledWith('new text')
  })

  it('saves immediately on saveNow', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useBrainDump(mockOnTasksCreated))

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    act(() => {
      result.current.updateTentativeText('immediate save')
    })

    // Save immediately without waiting for debounce
    await act(async () => {
      result.current.saveNow()
    })

    expect(api.saveTentativeBraindump).toHaveBeenCalledWith('immediate save')
  })

  it('clears tentative after successful submit', async () => {
    const { result } = renderHook(() => useBrainDump(mockOnTasksCreated))

    await waitFor(() => {
      expect(result.current.loadingTentative).toBe(false)
    })

    await act(async () => {
      await result.current.submit('my brain dump text')
    })

    expect(api.braindump).toHaveBeenCalledWith('my brain dump text')
    expect(mockOnTasksCreated).toHaveBeenCalledWith([{ title: 'Task 1', duration: 30 }])
    expect(api.saveTentativeBraindump).toHaveBeenCalledWith('')
    expect(result.current.tentativeText).toBe('')
    expect(result.current.isOpen).toBe(false)
  })

  it('opens and closes modal', () => {
    const { result } = renderHook(() => useBrainDump(mockOnTasksCreated))

    expect(result.current.isOpen).toBe(false)

    act(() => {
      result.current.open()
    })

    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.close()
    })

    expect(result.current.isOpen).toBe(false)
  })
})
