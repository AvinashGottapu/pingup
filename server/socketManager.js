import { Server } from 'socket.io'
import { verifyToken } from '@clerk/backend'

const allowedOrigins = [
  'http://localhost:5173',
  'https://pingup-six-lake.vercel.app',
]

let io

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  })

  // WebSocket authentication middleware => It works exactly like Express middleware..
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '')

      if (!token) {
        next(new Error('Unauthorized'))
        return
      }

      const data = await verifyToken(token, { // This verifies Clerk JWT token....
        secretKey: process.env.CLERK_SECRET_KEY,
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      })

      if (!data?.sub) { // sub means -> UserId...
        next(new Error('Unauthorized'))
        return
      }

      socket.userId = data.sub
      next()
    } catch (error) {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    socket.join(socket.userId)

    socket.on('call:invite', ({ to_user_id, roomId, callerName }, ack) => {
      if (!to_user_id || !roomId || !callerName) {
        ack?.({ success: false, message: 'Invalid call payload' })
        return
      }

      if (!isUserOnline(to_user_id)) {
        ack?.({ success: false, message: 'User is not available' })
        return
      }

      emitToUser(to_user_id, 'call:incoming', {
        type: 'call',
        roomId,
        callerName,
        from_user_id: socket.userId,
      })

      ack?.({ success: true })
    })

    socket.on('call:reject', ({ to_user_id }, ack) => {
      if (!to_user_id) {
        ack?.({ success: false, message: 'Invalid call payload' })
        return
      }

      if (!isUserOnline(to_user_id)) {
        ack?.({ success: false, message: 'User is not available' })
        return
      }

      emitToUser(to_user_id, 'call:rejected', {
        type: 'call_rejected',
        from_user_id: socket.userId,
      })

      ack?.({ success: true })
    })

    socket.on('disconnect', () => {
      socket.leave(socket.userId)
    })
  })

  return io
}

export const emitToUser = (userId, event, payload) => {
  if (!io) return
  io.to(userId).emit(event, payload)
}

export const isUserOnline = (userId) => {
  if (!io) return false
  return io.sockets.adapter.rooms.has(userId)
}

export const getSocketIo = () => io
