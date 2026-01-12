import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from '../Sidebar'
import type { Task } from '../../types'

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
  }),
  useDndContext: () => ({
    active: null,
    over: null,
  }),
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
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}))

const mockTasks: Task[] = [
  { id: '1', user_id: 'u1', title: 'Task 1', duration: 30, section: 'inbox', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
  { id: '2', user_id: 'u1', title: 'Task 2', duration: 15, section: 'inbox', position: 1, scheduled: null, google_id: null, created_at: '2024-01-01' },
  { id: '3', user_id: 'u1', title: 'Task 3', duration: 60, section: '2min', position: 0, scheduled: null, google_id: null, created_at: '2024-01-01' },
]

const mockTaskHook = {
  tasks: mockTasks,
  loading: false,
  getTasksBySection: (section: string) => mockTasks.filter(t => t.section === section),
  addTask: vi.fn(),
  updateTaskDuration: vi.fn(),
  removeTask: vi.fn(),
  updateTaskTitle: vi.fn(),
  moveTask: vi.fn(),
  scheduleTask: vi.fn(),
  unscheduleTask: vi.fn(),
  restoreTask: vi.fn(),
}

describe('Sidebar', () => {
  const defaultProps = {
    taskHook: mockTaskHook as ReturnType<typeof import('../../hooks/useTasks').useTasks>,
    onBrainDump: vi.fn(),
    width: 750,
    onResize: vi.fn(),
  }

  it('renders all 6 sections in 2-column layout', () => {
    render(<Sidebar {...defaultProps} />)

    // Check all section labels are present
    expect(screen.getByText('Inbox')).toBeInTheDocument()
    expect(screen.getByText('2-Min')).toBeInTheDocument()
    expect(screen.getByText('Must Do')).toBeInTheDocument()
    expect(screen.getByText('If Time')).toBeInTheDocument()
    expect(screen.getByText('Later')).toBeInTheDocument()
    expect(screen.getByText('Someday')).toBeInTheDocument()
  })

  it('renders sections in 3 grid rows (2 columns each)', () => {
    const { container } = render(<Sidebar {...defaultProps} />)

    // Should have 3 grid rows
    const gridRows = container.querySelectorAll('.grid.grid-cols-2')
    expect(gridRows).toHaveLength(3)
  })

  it('renders tasks in correct sections', () => {
    render(<Sidebar {...defaultProps} />)

    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
    expect(screen.getByText('Task 3')).toBeInTheDocument()
  })

  it('renders Brain Dump button', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /brain dump/i })).toBeInTheDocument()
  })

  it('renders 1-column layout when width < 430px', () => {
    const { container } = render(<Sidebar {...defaultProps} width={400} />)

    // Should have no grid rows in narrow mode
    const gridRows = container.querySelectorAll('.grid.grid-cols-2')
    expect(gridRows).toHaveLength(0)
  })
})
