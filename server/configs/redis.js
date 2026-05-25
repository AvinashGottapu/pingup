import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  reconnectOnError: (error) => {
    const message = error?.message || ''
    return !message.includes('READONLY')
  },
})

redis.on('error', (error) => {
  console.error('[redis] error:', error.message)
})

redis.on('connect', () => {
  console.log('[redis] connected')
})

export const initRedis = async () => {
  try {
    if (redis.status === 'ready') return redis

    if (redis.status === 'connecting') {
      await redis.ping()
      return redis
    }

    await redis.connect()
    await redis.ping()
    return redis
  } catch (error) {
    console.warn('[redis] unavailable, continuing without Redis:', error?.message || error)
    redis.disconnect()
    return redis
  }
}

const safeJsonParse = (value) => {
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const getCachedJson = async (key) => {
  const cached = await redis.get(key)
  return safeJsonParse(cached)
}

export const setCachedJson = async (key, value, ttlSeconds) => {
  const serialized = JSON.stringify(value)

  if (ttlSeconds) {
    await redis.set(key, serialized, 'EX', ttlSeconds)
    return
  }

  await redis.set(key, serialized)
}

export const deletePattern = async (pattern) => {
  const keys = await redis.keys(pattern)

  if (!keys.length) return 0

  await redis.del(...keys)
  return keys.length
}

export const getCounter = async (key) => {
  const value = await redis.get(key)

  if (!value) return null

  return Number(value)
}

export const setCounter = async (key, value, ttlSeconds) => {
  const payload = String(value)

  if (ttlSeconds) {
    await redis.set(key, payload, 'EX', ttlSeconds)
    return
  }

  await redis.set(key, payload)
}

export const incrementCounter = async (key, amount = 1, ttlSeconds) => {
  const value = await redis.incrby(key, amount)

  if (ttlSeconds) {
    await redis.expire(key, ttlSeconds)
  }

  return value
}

export const decrementCounter = async (key, amount = 1, ttlSeconds) => {
  const value = await redis.decrby(key, amount)

  if (ttlSeconds) {
    await redis.expire(key, ttlSeconds)
  }

  return value
}

export const setOnlineUser = async (userId) => {
  await redis.sadd('presence:online_users', userId)
}

export const removeOnlineUser = async (userId) => {
  await redis.srem('presence:online_users', userId)
}

export const getOnlineUsers = async () => {
  return redis.smembers('presence:online_users')
}

export const isUserOnline = async (userId) => {
  return redis.sismember('presence:online_users', userId)
}

export const setSession = async (userId, sessionId, ttlSeconds = 60 * 60) => {
  const key = `session:${userId}:${sessionId}`
  await redis.set(key, JSON.stringify({ userId, sessionId, updatedAt: Date.now() }), 'EX', ttlSeconds)
}

export const getUserSessions = async (userId) => {
  const pattern = `session:${userId}:*`
  const keys = await redis.keys(pattern)

  if (!keys.length) return []

  const sessions = await redis.mget(...keys)

  return sessions
    .filter(Boolean)
    .map((session) => safeJsonParse(session))
    .filter(Boolean)
}

export const deleteSession = async (userId, sessionId) => {
  await redis.del(`session:${userId}:${sessionId}`)
}

export const setTypingStatus = async (chatId, userId, ttlSeconds = 5) => {
  const typingKey = `typing:${chatId}`
  const payload = JSON.stringify({ userId, updatedAt: Date.now() })

  await redis.hset(typingKey, userId, payload)
  await redis.expire(typingKey, ttlSeconds)
}

export const clearTypingStatus = async (chatId, userId) => {
  await redis.hdel(`typing:${chatId}`, userId)
}

export const getTypingStatus = async (chatId) => {
  const typingData = await redis.hgetall(`typing:${chatId}`)

  if (!typingData || !Object.keys(typingData).length) return {}

  return Object.entries(typingData).reduce((acc, [userId, value]) => {
    const parsed = safeJsonParse(value)

    if (parsed) {
      acc[userId] = parsed
    }

    return acc
  }, {})
}
