import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { verifyToken } from '@clerk/backend'
import User from './models/User.js'
import Message from './models/Message.js'
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
  if (redisAdapter) return redisAdapter;

  try {
    await Promise.race([
      Promise.all([
        redis.connect(),
        redisSubscriber.connect()
      ]),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Redis connection timeout')),
          5000 // Increased timeout
        )
      ),
    ]);

    const ping = await redis.ping();

    if (ping !== 'PONG') {
      throw new Error('Redis ping failed');
    }

    // Clear stale online keys on startup
    await redis.del('online:users');

    const keys = await redis.keys('online:socket:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    redisAdapter = createAdapter(redis, redisSubscriber);

    console.log('[Redis] Connected successfully');

    return redisAdapter;
  } catch (error) {
    console.warn(
      '[Redis] unavailable, using in-memory socket adapter:',
      error.message
    );

    try {
      if (redis?.isOpen) {
        await redis.quit();
      }
    } catch (e) {}

    try {
      if (redisSubscriber?.isOpen) {
        await redisSubscriber.quit();
      }
    } catch (e) {}

    return null;
  }
};

const broadcastPresenceUpdate = async (userId, isOnline) => {
  const onlineUsers = (await getOnlineUsers()) || []
  const redisLastSeen = (await getSession(userId))?.lastSeen || null
  const dbLastSeen = isOnline
    ? null
    : (await User.findById(userId).select('lastSeen'))?.lastSeen || null
  const lastSeen = isOnline ? null : redisLastSeen || dbLastSeen

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

    socket.on('messages:seen', async ({ to_user_id }) => {
      if (!to_user_id) return

      try {
        await Message.updateMany(
          { from_user_id: to_user_id, to_user_id: socket.userId, seen: false },
          { seen: true }
        )

        emitToUser(to_user_id, 'messages:seen', {
          from_user_id: socket.userId,
        })
      } catch (err) {
        console.error('Error in messages:seen socket handler:', err)
      }
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

    // --- CUSTOM WEBRTC SIGNALING HANDLERS ---
    
    /**
     * Event: call:join-room
     * Triggered when a peer enters the voice call Roompage.
     * The client joins the Socket.io room and alerts any already joined peer.
     */
    socket.on('call:join-room', ({ roomId }) => {
      if (!roomId) return
      
      socket.join(roomId)
      
      // Let other clients in the room know someone joined so they can initiate WebRTC handshake
      socket.to(roomId).emit('call:user-joined', {
        userId: socket.userId
      })
    })

    /**
     * Event: call:signal
     * Relays WebRTC signaling payloads (SDP offers, SDP answers, ICE candidates)
     * between the peers inside the call room.
     */
    socket.on('call:signal', ({ roomId, signal }) => {
      if (!roomId || !signal) return
      
      // Send the signal payload to all other clients in the room
      socket.to(roomId).emit('call:signal', {
        signal,
        fromUserId: socket.userId
      })
    })  

    /**
     * Event: call:end
     * Informs the other peer that the call has been hung up / ended.
     */
    socket.on('call:end', ({ roomId }) => {
      if (!roomId) return
      
      // Parse the target user ID from the roomId (format: userId1-userId2)
      const userIds = roomId.split('-')
      const otherUserId = userIds.find((id) => id !== socket.userId)
      
      if (otherUserId) {
        // Emit call:ended directly to the other user's private socket channel (handles early cancellation)
        emitToUser(otherUserId, 'call:ended', { roomId })
      }
      
      // Broadcast call:ended event to the socket.io room (for users already in the room page)
      socket.to(roomId).emit('call:ended')
      
      // Leave the socket room
      socket.leave(roomId)
    })

    /**
     * Event: whiteboard:draw
     * Relays drawing coordinates and styles to other peers in the room.
     */
    socket.on('whiteboard:draw', ({ roomId, drawData }) => {
      if (!roomId || !drawData) return
      socket.to(roomId).emit('whiteboard:draw', { drawData })
    })

    /**
     * Event: whiteboard:clear
     * Relays canvas clear actions to other peers in the room.
     */
    socket.on('whiteboard:clear', ({ roomId }) => {
      if (!roomId) return
      socket.to(roomId).emit('whiteboard:clear')
    })

    /**
     * Event: whiteboard:toggle
     * Relays whiteboard visibility toggle actions (opening/closing) to other peers in the room.
     */
    socket.on('whiteboard:toggle', ({ roomId, isOpen }) => {
      if (!roomId) return
      socket.to(roomId).emit('whiteboard:toggle', { isOpen })
    })
  
    socket.on('disconnect', async () => {
      socket.leave(socket.userId)
      await unregisterOnlineUser(socket.userId, socket.id)
      const lastSeenIso = new Date().toISOString()
      await setSession(socket.userId, { lastSeen: lastSeenIso })
      await User.findByIdAndUpdate(socket.userId, { lastSeen: lastSeenIso }).catch(() => {})

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
