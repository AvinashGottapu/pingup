import { Server } from 'socket.io'
import { verifyToken } from '@clerk/backend'
import {
  clearTypingStatus,
  deleteSession,
  getOnlineUsers,
  isUserOnline,
  removeOnlineUser,
  setOnlineUser,
  setSession,
  setTypingStatus,
} from './configs/redis.js'

export { isUserOnline } from './configs/redis.js'

const allowedOrigins = [
  'http://localhost:5173',
  'https://pingup-six-lake.vercel.app',
]

let io

const broadcastPresenceStatus = (userId, isOnline) => {
  if (!io) return
  io.emit('presence:status', { userId, isOnline })
}

const broadcastTypingStatus = (toUserId, userId, isTyping) => {
  if (!io) return
  emitToUser(toUserId, 'typing:status', { userId, isTyping })
}

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

  io.on('connection', async (socket) => {
    socket.join(socket.userId)

    await setOnlineUser(socket.userId)
    await setSession(socket.userId, socket.id)

    const onlineUsers = await getOnlineUsers()
    socket.emit('presence:sync', onlineUsers)
    broadcastPresenceStatus(socket.userId, true)

    socket.on('call:invite', async ({ to_user_id, roomId, callerName }, ack) => {
      if (!to_user_id || !roomId || !callerName) {
        ack?.({ success: false, message: 'Invalid call payload' })
        return
      }

      if (!(await isUserOnline(to_user_id))) {
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

    socket.on('call:reject', async ({ to_user_id }, ack) => {
      if (!to_user_id) {
        ack?.({ success: false, message: 'Invalid call payload' })
        return
      }

      if (!(await isUserOnline(to_user_id))) {
        ack?.({ success: false, message: 'User is not available' })
        return
      }

      emitToUser(to_user_id, 'call:rejected', {
        type: 'call_rejected',
        from_user_id: socket.userId,
      })

      ack?.({ success: true })
    })

    socket.on('typing:start', async ({ to_user_id }) => {
      if (!to_user_id) return

      const chatId = [socket.userId, to_user_id].sort().join(':')
      await setTypingStatus(chatId, socket.userId)
      broadcastTypingStatus(to_user_id, socket.userId, true)
    })

    socket.on('typing:stop', async ({ to_user_id }) => {
      if (!to_user_id) return

      const chatId = [socket.userId, to_user_id].sort().join(':')
      await clearTypingStatus(chatId, socket.userId)
      broadcastTypingStatus(to_user_id, socket.userId, false)
    })

    socket.on('disconnect', async () => {
      socket.leave(socket.userId)
      await removeOnlineUser(socket.userId)
      await deleteSession(socket.userId, socket.id)
      broadcastPresenceStatus(socket.userId, false)
    })
  })

  return io
}

export const emitToUser = (userId, event, payload) => {
  if (!io) return
  io.to(userId).emit(event, payload)
}

export const getSocketIo = () => io
