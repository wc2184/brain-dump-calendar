# Brain Dump Calendar

A productivity app: brain dump your thoughts → GPT extracts actionable tasks → drag to Google Calendar.

## Features

- **Brain Dump**: Write freely, AI extracts tasks with time estimates
- **Drag & Drop**: Drag tasks to calendar, reorder within inbox
- **Google Calendar Sync**: Events sync bidirectionally with Google Calendar
- **3-Day View**: See yesterday, today, and tomorrow at a glance
- **Compact Mode**: Toggle zoomed-out view for high-level planning
- **Keyboard Shortcuts**: `n`/`p` navigate, `d`/`3` switch views, `c` compact, `t` today
- **Event Editing**: Resize, recolor, rename events via drag or context menu

## Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Express (Vercel Serverless)
- **Database**: Supabase (Postgres + Auth)
- **APIs**: OpenAI GPT-4o-mini, Google Calendar API
- **Drag & Drop**: @dnd-kit

## Local Development

```bash
# Install dependencies
npm install

# Terminal 1 - API server
npm run dev:api    # runs on :3001

# Terminal 2 - Frontend
npm run dev        # runs on :5173
```

## Project Structure

```
src/
├── components/     # React components (CalendarView, Sidebar, TaskBlock, etc.)
├── hooks/          # useAuth, useTasks, useCalendar, useBrainDump
├── lib/            # supabase.ts, api.ts
└── types/          # TypeScript types + constants

api/
└── index.ts        # Express API (Vercel serverless function)
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Frontend
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Backend
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Deployment

Deployed on Vercel. Push to `main` triggers auto-deploy.

```bash
git push origin main
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `n` | Next day |
| `p` | Previous day |
| `t` | Today |
| `d` | Day view |
| `3` | 3-day view |
| `c` | Toggle compact |
