import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Section as SectionType, Task } from '../types'
import { TaskBlock } from './TaskBlock'

interface Props {
  section: SectionType
  tasks: Task[]
  onDurationChange: (taskId: string, duration: number) => void
  onDelete: (taskId: string) => void
  onTitleChange: (taskId: string, newTitle: string) => void
  hideHeader?: boolean
}

export function Section({ section, tasks, onDurationChange, onDelete, onTitleChange, hideHeader }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id })

  return (
    <div
      ref={setNodeRef}
      className={`mb-4 p-2 -m-2 rounded-lg transition-all ${
        isOver ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset shadow-inner' : ''
      }`}
    >
      {!hideHeader && (
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
          <span>{section.emoji}</span>
          <span>{section.label}</span>
          {tasks.length > 0 && (
            <span className="text-neutral-400">({tasks.length})</span>
          )}
        </div>
      )}
      <div className="min-h-[40px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map(task => (
              <TaskBlock
                key={task.id}
                task={task}
                onDurationChange={(d) => onDurationChange(task.id, d)}
                onDelete={() => onDelete(task.id)}
                onTitleChange={(newTitle) => onTitleChange(task.id, newTitle)}
              />
            ))}
          </div>
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-xs text-neutral-300 py-2 text-center">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  )
}
