// Local dev server that uses the same api/index.ts as Vercel
import 'dotenv/config'
import app from './api/index.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`)
})
