import { DURATIONS } from '../types'

interface Props {
  value: number
  onChange: (duration: number) => void
}

export function DurationButtons({ value, onChange }: Props) {
  return (
    <div className="flex gap-0.5">
      {DURATIONS.map(d => (
        <button
          key={d.value}
          onClick={() => onChange(d.value)}
          className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
            value === d.value
              ? 'bg-neutral-800 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}
