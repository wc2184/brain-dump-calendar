import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskBlock } from '../TaskBlock'
import type { Task } from '../../types'
import * as dndCore from '@dnd-kit/core'

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
  }),
  useDndContext: vi.fn(() => ({
    active: null,
    over: null,
  })),
}))

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}))

const mockTask: Task = {
  id: 'task-1',
  user_id: 'user-1',
  title: 'Test Task',
  duration: 30,
  section: 'inbox',
  position: 0,
  scheduled: null,
  google_id: null,
  created_at: '2024-01-01',
}

describe('TaskBlock', () => {
  const defaultProps = {
    task: mockTask,
    onDurationChange: vi.fn(),
    onDelete: vi.fn(),
    onTitleChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders task title', () => {
    render(<TaskBlock {...defaultProps} />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('renders duration buttons', () => {
    render(<TaskBlock {...defaultProps} />)
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('calls onDurationChange when duration button clicked', async () => {
    const user = userEvent.setup()
    const onDurationChange = vi.fn()
    render(<TaskBlock {...defaultProps} onDurationChange={onDurationChange} />)

    await user.click(screen.getByText('1h'))
    expect(onDurationChange).toHaveBeenCalledWith(60)
  })

  describe('context menu', () => {
    it('shows context menu on right click', async () => {
      render(<TaskBlock {...defaultProps} />)

      const taskElement = screen.getByText('Test Task').closest('div')!
      fireEvent.contextMenu(taskElement)

      expect(screen.getByText('Rename')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('calls onDelete when delete clicked', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      render(<TaskBlock {...defaultProps} onDelete={onDelete} />)

      const taskElement = screen.getByText('Test Task').closest('div')!
      fireEvent.contextMenu(taskElement)

      await user.click(screen.getByText('Delete'))
      expect(onDelete).toHaveBeenCalledOnce()
    })

    it('closes menu on Escape', async () => {
      const user = userEvent.setup()
      render(<TaskBlock {...defaultProps} />)

      const taskElement = screen.getByText('Test Task').closest('div')!
      fireEvent.contextMenu(taskElement)
      expect(screen.getByText('Rename')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByText('Rename')).not.toBeInTheDocument()
    })
  })

  describe('inline editing', () => {
    it('enters edit mode when rename clicked', async () => {
      const user = userEvent.setup()
      render(<TaskBlock {...defaultProps} />)

      const taskElement = screen.getByText('Test Task').closest('div')!
      fireEvent.contextMenu(taskElement)
      await user.click(screen.getByText('Rename'))

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveValue('Test Task')
    })

    it('calls onTitleChange on Enter', async () => {
      const user = userEvent.setup()
      const onTitleChange = vi.fn()
      render(<TaskBlock {...defaultProps} onTitleChange={onTitleChange} />)

      const taskElement = screen.getByText('Test Task').closest('div')!
      fireEvent.contextMenu(taskElement)
      await user.click(screen.getByText('Rename'))

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'New Title{Enter}')

      expect(onTitleChange).toHaveBeenCalledWith('New Title')
    })

    it('cancels edit on Escape', async () => {
      const user = userEvent.setup()
      const onTitleChange = vi.fn()
      render(<TaskBlock {...defaultProps} onTitleChange={onTitleChange} />)

      const taskElement = screen.getByText('Test Task').closest('div')!
      fireEvent.contextMenu(taskElement)
      await user.click(screen.getByText('Rename'))

      const input = screen.getByRole('textbox')
      await user.clear(input)
      await user.type(input, 'New Title{Escape}')

      expect(onTitleChange).not.toHaveBeenCalled()
      expect(screen.getByText('Test Task')).toBeInTheDocument()
    })

    it('does not call onTitleChange if title unchanged', async () => {
      const user = userEvent.setup()
      const onTitleChange = vi.fn()
      render(<TaskBlock {...defaultProps} onTitleChange={onTitleChange} />)

      const taskElement = screen.getByText('Test Task').closest('div')!
      fireEvent.contextMenu(taskElement)
      await user.click(screen.getByText('Rename'))

      const input = screen.getByRole('textbox')
      await user.type(input, '{Enter}')

      expect(onTitleChange).not.toHaveBeenCalled()
    })
  })

  describe('cross-section drag highlighting', () => {
    it('does NOT show highlight when dragging within same section', () => {
      vi.mocked(dndCore.useDndContext).mockReturnValue({
        active: { id: 'other-task', data: { current: { section: 'inbox' } } },
        over: { id: 'task-1' },
      } as any)

      const { container } = render(<TaskBlock {...defaultProps} />)
      const card = container.firstChild as HTMLElement

      expect(card.className).not.toContain('ring-blue-400')
      expect(card.className).not.toContain('bg-blue-50')
    })

    it('shows highlight when dragging from different section', () => {
      vi.mocked(dndCore.useDndContext).mockReturnValue({
        active: { id: 'other-task', data: { current: { section: 'mustdo' } } },
        over: { id: 'task-1' },
      } as any)

      const { container } = render(<TaskBlock {...defaultProps} />)
      const card = container.firstChild as HTMLElement

      expect(card.className).toContain('ring-blue-400')
      expect(card.className).toContain('bg-blue-50')
    })

    it('shows highlight when hovering via task-drop ID', () => {
      vi.mocked(dndCore.useDndContext).mockReturnValue({
        active: { id: 'other-task', data: { current: { section: '2min' } } },
        over: { id: 'task-drop-task-1' },
      } as any)

      const { container } = render(<TaskBlock {...defaultProps} />)
      const card = container.firstChild as HTMLElement

      expect(card.className).toContain('ring-blue-400')
    })

    it('does NOT show highlight when no active drag', () => {
      vi.mocked(dndCore.useDndContext).mockReturnValue({
        active: null,
        over: { id: 'task-1' },
      } as any)

      const { container } = render(<TaskBlock {...defaultProps} />)
      const card = container.firstChild as HTMLElement

      expect(card.className).not.toContain('ring-blue-400')
    })

    it('shows highlight when dragging calendar event over task', () => {
      vi.mocked(dndCore.useDndContext).mockReturnValue({
        active: { id: 'event-123', data: { current: { type: 'calendar-event', event: {} } } },
        over: { id: 'task-1' },
      } as any)

      const { container } = render(<TaskBlock {...defaultProps} />)
      const card = container.firstChild as HTMLElement

      expect(card.className).toContain('ring-blue-400')
      expect(card.className).toContain('bg-blue-50')
    })
  })
})
