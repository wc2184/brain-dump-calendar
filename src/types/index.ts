export type SectionType = 'inbox' | '2min' | 'mustdo' | 'iftime' | 'later' | 'someday'

export interface Task {
  id: string
  user_id: string
  title: string
  duration: number
  section: SectionType
  position: number
  scheduled: string | null
  google_id: string | null
  created_at: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  isGoogleEvent: boolean
  colorId?: string | null
  recurringEventId?: string | null
  taskId?: string | null
}

export const GOOGLE_CALENDAR_COLORS = [
  { id: '1', name: 'Lavender', hex: '#7986CB' },
  { id: '2', name: 'Sage', hex: '#33B679' },
  { id: '3', name: 'Grape', hex: '#8E24AA' },
  { id: '4', name: 'Flamingo', hex: '#E67C73' },
  { id: '5', name: 'Banana', hex: '#F6BF26' },
  { id: '6', name: 'Tangerine', hex: '#F4511E' },
  { id: '7', name: 'Peacock', hex: '#039BE5' },
  { id: '8', name: 'Graphite', hex: '#616161' },
  { id: '9', name: 'Blueberry', hex: '#3F51B5' },
  { id: '10', name: 'Basil', hex: '#0B8043' },
  { id: '11', name: 'Tomato', hex: '#D50000' },
]

export interface Section {
  id: SectionType
  label: string
  emoji: string
}

export const SECTIONS: Section[] = [
  { id: 'inbox', label: 'Inbox', emoji: '📥' },
  { id: '2min', label: '2-Min', emoji: '⚡' },
  { id: 'mustdo', label: 'Must Do', emoji: '🎯' },
  { id: 'iftime', label: 'If Time', emoji: '✨' },
  { id: 'later', label: 'Later', emoji: '📅' },
  { id: 'someday', label: 'Someday', emoji: '💭' },
]

export const DURATIONS = [
  { value: 5, label: '5' },
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 45, label: '45' },
  { value: 60, label: '1h' },
  { value: 90, label: '1:30' },
  { value: 120, label: '2h' },
]

export const BRAIN_DUMP_PROMPTS = [
  'All of the tasks that you need to accomplish today',
  'Thoughts that are holding you back',
  'Ideas that you\'re excited about',
  'Worries that are lingering in your mind',
]

export interface UserGoals {
  mandatory_goals: string
  nice_to_have_goals: string
}
