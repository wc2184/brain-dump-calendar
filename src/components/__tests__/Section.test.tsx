import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Section } from '../Section'
import * as dndCore from '@dnd-kit/core'

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: true, // Simulate hover
  }),
  useDndContext: vi.fn(() => ({
    active: null,
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

const mockSection = { id: 'inbox' as const, label: 'Inbox', emoji: '📥' }

describe('Section cross-section highlighting', () => {
  const defaultProps = {
    section: mockSection,
    tasks: [],
    onDurationChange: vi.fn(),
    onDelete: vi.fn(),
    onTitleChange: vi.fn(),
  }

  it('does NOT show highlight when dragging within same section', () => {
    vi.mocked(dndCore.useDndContext).mockReturnValue({
      active: { id: 'task-1', data: { current: { section: 'inbox' } } },
    } as any)

    const { container } = render(<Section {...defaultProps} />)
    const sectionDiv = container.firstChild as HTMLElement

    expect(sectionDiv.className).not.toContain('bg-blue-100')
    expect(sectionDiv.className).not.toContain('ring-blue-400')
  })

  it('shows highlight when dragging from different section', () => {
    vi.mocked(dndCore.useDndContext).mockReturnValue({
      active: { id: 'task-1', data: { current: { section: 'mustdo' } } },
    } as any)

    const { container } = render(<Section {...defaultProps} />)
    const sectionDiv = container.firstChild as HTMLElement

    expect(sectionDiv.className).toContain('bg-blue-100')
    expect(sectionDiv.className).toContain('ring-blue-400')
  })

  it('does NOT show highlight when no active drag', () => {
    vi.mocked(dndCore.useDndContext).mockReturnValue({
      active: null,
    } as any)

    const { container } = render(<Section {...defaultProps} />)
    const sectionDiv = container.firstChild as HTMLElement

    expect(sectionDiv.className).not.toContain('bg-blue-100')
  })

  it('shows highlight when dragging calendar event', () => {
    vi.mocked(dndCore.useDndContext).mockReturnValue({
      active: { id: 'event-123', data: { current: { type: 'calendar-event', event: {} } } },
    } as any)

    const { container } = render(<Section {...defaultProps} />)
    const sectionDiv = container.firstChild as HTMLElement

    expect(sectionDiv.className).toContain('bg-blue-100')
    expect(sectionDiv.className).toContain('ring-blue-400')
  })
})
