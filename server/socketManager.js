import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { verifyToken } from '@clerk/backend'
import { redis, redisSubscriber } from './configs/redis.js'
import {
  clearTypingStatus,
  getOnlineUsers,
  getSession,
  getTypingConversationForUser,
  incrementCounter,
  registerOnlineUser,
  setSession,
  setTypingStatus,
  touchSession,
  unregisterOnlineUser,
} from './utils/redisStore.js'

const allowedOrigins = [
  'http://localhost:5173',
  'https://pingup-six-lake.vercel.app',
]

let io
let redisAdapter = null

const getConversationKey = (userA, userB) => [userA, userB].sort().join(':')

const initRedisAdapter = async () => {
  if (redisAdapter) return redisAdapter   // Reuse existing adapter if already initialized

  try {
    await Promise.race([ // Run multiple promises,whichever finishes first wins..
      Promise.all([redis.connect(), redisSubscriber.connect()]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 2000)),
    ])

    const ping = await redis.ping()
    if (ping !== 'PONG') {  // If Redis not responding correctly,throw error..
      throw new Error('Redis ping failed')
    }

    redisAdapter = createAdapter(redis, redisSubscriber) // All servers receive socket events
    return redisAdapter
  } catch (error) {
    console.warn('[Redis] unavailable, using in-memory socket adapter:', error.message)
    redis.disconnect().catch(() => {})
    redisSubscriber.disconnect().catch(() => {})
    return null
  }
}

const broadcastPresenceUpdate = async (userId, isOnline) => {
  const onlineUsers = (await getOnlineUsers()) || []
  const lastSeen = isOnline
    ? null
    : (await getSession(userId))?.lastSeen || null

  io.emit('presence:update', {
    onlineUsers,
    users: {
      [userId]: {
        isOnline,
        lastSeen,
      },
    },
  })
}

export const initSocketServer = async (httpServer) => {
  const adapter = await initRedisAdapter()

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    adapter,
  })

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '')

      if (!token) {
        next(new Error('Unauthorized'))
        return
      }

      const data = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      })

      if (!data?.sub) {
        next(new Error('Unauthorized'))
        return
      }

      socket.userId = data.sub
      await touchSession(socket.userId)
      next()
    } catch (error) {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', async (socket) => {
    socket.join(socket.userId)
    await registerOnlineUser(socket.userId, socket.id)
    await incrementCounter('socket.connections')

    await broadcastPresenceUpdate(socket.userId, true)

    socket.on('typing:start', async ({ to_user_id }) => {
      if (!to_user_id) return

      const conversationKey = getConversationKey(socket.userId, to_user_id)
      await setTypingStatus(conversationKey, socket.userId)

      emitToUser(to_user_id, 'typing:start', {
        from_user_id: socket.userId,
        conversationKey,
      })
    })

    socket.on('typing:stop', async ({ to_user_id }) => {
      if (!to_user_id) return

      const conversationKey = getConversationKey(socket.userId, to_user_id)
      await clearTypingStatus(conversationKey, socket.userId)

      emitToUser(to_user_id, 'typing:stop', {
        from_user_id: socket.userId,
        conversationKey,
      })
    })

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

    socket.on('disconnect', async () => {
      socket.leave(socket.userId)
      await unregisterOnlineUser(socket.userId, socket.id)
      await setSession(socket.userId, { lastSeen: new Date().toISOString() })

      const activeConversation = await getTypingConversationForUser(socket.userId)
      if (activeConversation) {
        await clearTypingStatus(activeConversation, socket.userId)
      }

      await broadcastPresenceUpdate(socket.userId, false)
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
