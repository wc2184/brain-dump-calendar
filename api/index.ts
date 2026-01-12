import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import OpenAI from 'openai'

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Middleware to get user from auth header
const getUser = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  req.user = user
  next()
}

// Get Google OAuth2 client for user
const getGoogleClient = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token
  })

  // Save refreshed tokens
  oauth2Client.on('tokens', async (tokens) => {
    const updates: any = { updated_at: new Date().toISOString() }
    if (tokens.access_token) updates.access_token = tokens.access_token
    if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token

    await supabase
      .from('user_tokens')
      .update(updates)
      .eq('user_id', userId)
  })

  return oauth2Client
}

// Tasks endpoints
app.get('/api/tasks', getUser, async (req: any, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', req.user.id)
    .order('position')

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/api/tasks', getUser, async (req: any, res) => {
  const { title, duration, section = 'inbox', position = 0 } = req.body

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: req.user.id,
      title,
      duration,
      section,
      position
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.patch('/api/tasks/reorder', getUser, async (req: any, res) => {
  const { tasks } = req.body

  if (!tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks array required' })
  }

  try {
    for (const task of tasks) {
      await supabase
        .from('tasks')
        .update({ section: task.section, position: task.position })
        .eq('id', task.id)
        .eq('user_id', req.user.id)
    }
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.patch('/api/tasks/:id', getUser, async (req: any, res) => {
  const { id } = req.params
  const updates = req.body

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.delete('/api/tasks/:id', getUser, async (req: any, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// Calendar endpoints
app.get('/api/calendar', getUser, async (req: any, res) => {
  const oauth2Client = await getGoogleClient(req.user.id)
  if (!oauth2Client) return res.json([])

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const { startDate, endDate } = req.query
  let timeMin: Date, timeMax: Date

  if (startDate && endDate) {
    timeMin = new Date(startDate as string)
    timeMax = new Date(endDate as string)
  } else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    timeMin = new Date(today)
    timeMin.setDate(timeMin.getDate() - 1)
    timeMax = new Date(today)
    timeMax.setDate(timeMax.getDate() + 2)
  }

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })

    const events = response.data.items?.map(event => ({
      id: event.id,
      title: event.summary || 'No title',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      isGoogleEvent: true,
      colorId: event.colorId || null,
      recurringEventId: event.recurringEventId || null
    })) || []

    res.json(events)
  } catch (error) {
    res.json([])
  }
})

app.post('/api/calendar', getUser, async (req: any, res) => {
  const { taskId, startTime } = req.body

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', req.user.id)
    .single()

  if (!task) return res.status(404).json({ error: 'Task not found' })

  const oauth2Client = await getGoogleClient(req.user.id)
  if (!oauth2Client) return res.status(400).json({ error: 'Google not connected' })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const start = new Date(startTime)
  const end = new Date(start.getTime() + task.duration * 60000)

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: task.title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      }
    })

    res.json({
      id: response.data.id,
      title: task.title,
      start: start.toISOString(),
      end: end.toISOString(),
      isGoogleEvent: false
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' })
  }
})

app.patch('/api/calendar/:id', getUser, async (req: any, res) => {
  const { id } = req.params
  const { startTime, duration, colorId, title } = req.body

  const oauth2Client = await getGoogleClient(req.user.id)
  if (!oauth2Client) return res.status(400).json({ error: 'Google not connected' })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const requestBody: any = {}

  if (startTime !== undefined && duration !== undefined) {
    const start = new Date(startTime)
    const end = new Date(start.getTime() + duration * 60000)
    requestBody.start = { dateTime: start.toISOString() }
    requestBody.end = { dateTime: end.toISOString() }
  }

  if (colorId !== undefined) requestBody.colorId = colorId
  if (title !== undefined) requestBody.summary = title

  try {
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: id,
      requestBody
    })

    res.json({
      id: response.data.id,
      title: response.data.summary || 'No title',
      start: response.data.start?.dateTime || response.data.start?.date,
      end: response.data.end?.dateTime || response.data.end?.date,
      isGoogleEvent: true,
      colorId: response.data.colorId || null,
      recurringEventId: response.data.recurringEventId || null
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' })
  }
})

app.delete('/api/calendar/:id', getUser, async (req: any, res) => {
  const { id } = req.params

  const oauth2Client = await getGoogleClient(req.user.id)
  if (!oauth2Client) return res.status(400).json({ error: 'Google not connected' })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: id
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' })
  }
})

// Brain dump endpoint
app.post('/api/braindump', getUser, async (req: any, res) => {
  const { text } = req.body

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a productivity assistant. The user will share thoughts from a brain dump session covering:
- Tasks to accomplish today
- Thoughts holding them back
- Ideas they're excited about
- Worries lingering in their mind

Extract ONLY actionable tasks with estimated duration in minutes.
Ignore non-actionable thoughts, worries, or ideas unless they imply a task.

Return JSON array only, no markdown:
[
  { "title": "Reply to Sarah's email", "duration": 15 },
  { "title": "Finish quarterly report", "duration": 90 }
]`
        },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0].message.content
    const parsed = JSON.parse(content || '{}')
    const tasks = parsed.tasks || parsed

    res.json(Array.isArray(tasks) ? tasks : [])
  } catch (error) {
    res.status(500).json({ error: 'Failed to process brain dump' })
  }
})

export default app
