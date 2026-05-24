import express from 'express'
import cors from 'cors'
import http from 'http'
import 'dotenv/config'
import connectDB from './configs/db.js'
import { inngest, functions } from './inngest/index.js'
import { serve } from 'inngest/express'
import { clerkMiddleware } from '@clerk/express'
import userRouter from './routes/userRoutes.js'
import postRouter from './routes/postRoutes.js'
import storyRouter from './routes/storyRoutes.js'
import messageRouter from './routes/messageRoutes.js'
import { initSocketServer } from './socketManager.js'

const PORT = process.env.PORT || 4000

const app = express()
const server = http.createServer(app)

await connectDB()

app.use(express.json())
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://pingup-six-lake.vercel.app',
  ],
  credentials: true,
}))
app.use(clerkMiddleware())

initSocketServer(server)

app.get('/', (req, res) => res.send('Server is running'))
app.use('/api/inngest', serve({ client: inngest, functions }))
app.use('/api/user', userRouter)
app.use('/api/post', postRouter)
app.use('/api/story', storyRouter)
app.use('/api/message', messageRouter)

server.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`))