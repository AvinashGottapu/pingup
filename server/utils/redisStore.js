import { redis } from '../configs/redis.js'

const SESSION_TTL = 60 * 60
const TYPING_TTL = 8
const FEED_TTL = 60

const safeJsonParse = (value) => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

  const withRedis = async (callback) => {
    try {
      return await callback()
    } catch (error) {
      console.warn('[Redis] operation failed:', error.message)
      return null
    }
  }

export const checkRateLimit = async (key, limit, windowSeconds) => {
  if (!key || !limit || !windowSeconds) {
    return { allowed: true, count: 0, remaining: 0, ttl: 0 }
  }

  return withRedis(async () => {
    const now = Date.now()
    const windowMs = Number(windowSeconds) * 1000
    const member = `${now}-${Math.random().toString(36).slice(2, 10)}`

    // It counts requests in the last X seconds from now, not from the first request.

      //  Zadd - Adds current request to sorted set..
     // zremrangebyscore - Deletes requests older than the window..
     // zcard - Gets the current count of requests in the window..

    const result = await redis.eval(
      `
        local now = tonumber(ARGV [1])
        local window_ms = tonumber(ARGV[2])
        local member = ARGV[3]
        local cutoff = now - window_ms

        redis.call('zadd', KEYS[1], now, member)
        redis.call('zremrangebyscore', KEYS[1], '-inf', cutoff)

        local current = redis.call('zcard', KEYS[1])
        local oldest = redis.call('zrange', KEYS[1], 0, 0, 'WITHSCORES')
        local ttl = 0

        if #oldest > 0 then
          local oldest_score = tonumber(oldest[2])
          ttl = math.max(0, math.ceil((oldest_score + window_ms - now) / 1000))
        end

        redis.call('expire', KEYS[1], tonumber(ARGV[4]))

        return { current, ttl }
      `,
      1,
      key,
      now,
      windowMs,
      member,
      windowSeconds,
    )

    const [currentCount, ttl] = Array.isArray(result) ? result : [result?.[0], result?.[1]]
    const nextCount = Number(currentCount || 0)
    const nextTtl = Number(ttl || 0)

    return {
      allowed: nextCount <= Number(limit),
      count: nextCount,
      remaining: Math.max(0, Number(limit) - nextCount),
      ttl: Math.max(nextTtl, 0),
    }
  })
}

// THESE 4 => used for ✅ last seen tracking ✅ active session management..

export const touchSession = async (userId) => {
  if (!userId) return false

  return withRedis(async () => {
    const key = `session:${userId}` // Like heartbeat refresh... Update activity timestamp.
    await redis.hset(key, 'lastSeen', new Date().toISOString())
    await redis.expire(key, SESSION_TTL)
    return true
  })
}

export const setSession = async (userId, payload = {}) => {
  if (!userId) return false

  return withRedis(async () => {
    const key = `session:${userId}`
    await redis.hset(key, {
      userId,
      lastSeen: new Date().toISOString(),
      ...payload,
    })
    await redis.expire(key, SESSION_TTL)
    return true
  })
}

export const getSession = async (userId) => {
  if (!userId) return null

  return withRedis(async () => {
    const data = await redis.hgetall(`session:${userId}`)
    return Object.keys(data || {}).length ? data : null
  })
}

export const deleteSession = async (userId) => {
  if (!userId) return false

  return withRedis(async () => {
    await redis.del(`session:${userId}`)
    return true
  })
}


const ONLINE_SOCKET_TTL = 24 * 60 * 60 // 24 hours

export const registerOnlineUser = async (userId, socketId) => {
  if (!userId) return false

  return withRedis(async () => {
    const key = `online:users`
    await redis.sadd(key, userId)
    await redis.hset(`online:socket:${userId}`, socketId, Date.now().toString()) 
    // Diff tabs..  user1 may be connected from: - Chrome tab - Mobile app - Another laptop...
    await redis.expire(`online:socket:${userId}`, ONLINE_SOCKET_TTL)
    return true
  })
}

export const unregisterOnlineUser = async (userId, socketId) => {
  if (!userId) return false

  return withRedis(async () => {
    if (socketId) {
      await redis.hdel(`online:socket:${userId}`, socketId) // Only one tab is deleted...
    }

    const remainingSockets = await redis.hlen(`online:socket:${userId}`)
    if (remainingSockets === 0) {
      await redis.srem('online:users', userId)  // SET REMOVE... 
      await redis.del(`online:socket:${userId}`)  // DELETE ENTIRE KEY...
    } else {
      await redis.expire(`online:socket:${userId}`, ONLINE_SOCKET_TTL)
    }

    return true
  })
}

export const getOnlineUsers = async () => {
  return withRedis(async () => {
    const users = await redis.smembers('online:users')
    if (!users || users.length === 0) return []

    // Verify which users actually have active socket registrations
    const pipeline = redis.pipeline()
    users.forEach((userId) => {
      pipeline.exists(`online:socket:${userId}`)
    })
    const results = await pipeline.exec()

    const activeUsers = []
    const inactiveUsers = []

    users.forEach((userId, index) => {
      const exists = results[index]?.[1] === 1
      if (exists) {
        activeUsers.push(userId)
      } else {
        inactiveUsers.push(userId)
      }
    })

    if (inactiveUsers.length > 0) {
      // Clean up stale users from 'online:users' in the background
      redis.srem('online:users', ...inactiveUsers).catch((err) => {
        console.warn('[Redis] failed to remove stale online users:', err.message)
      })
    }

    return activeUsers
  })
}

export const getPresenceMap = async (userIds = []) => {
  if (!userIds.length) return {}

  const result = await withRedis(async () => {
    const onlineUsers = await getOnlineUsers()
    const onlineSet = new Set(onlineUsers || [])

    const sessions = await Promise.all(
      userIds.map((userId) => redis.hgetall(`session:${userId}`))
    )

    return userIds.reduce((acc, userId, index) => {
      const session = sessions[index] || {}
      acc[userId] = {
        isOnline: onlineSet.has(userId),
        lastSeen: session.lastSeen || null,
      }
      return acc
    }, {})
  })

  return result || userIds.reduce((acc, userId) => {
    acc[userId] = {
      isOnline: false,
      lastSeen: null,
    }
    return acc
  }, {})
}

export const getOnlineCount = async () => {
  return withRedis(async () => {
    return redis.scard('online:users') // Returns the count of userIds currently online.. SET CARDINALITY
  })
}

export const setTypingStatus = async (conversationKey, userId) => {
  if (!conversationKey || !userId) return false

  return withRedis(async () => {  // Advanced multi-chat cleanup → two directions useful
  // Exactly which conversation is active for a user → "typing:active:userId" => conversationKey Extra cleanup → If user starts typing in another conversation, previous "typing:active:userId" will be overwritten, and previous "typing:conversationKey" will expire after TTL. This way we avoid stale typing indicators across multiple conversations.
    await redis.set(`typing:${conversationKey}`, userId, 'EX', TYPING_TTL)
    await redis.set(`typing:active:${userId}`, conversationKey, 'EX', TYPING_TTL)
    return true
  })
}

export const clearTypingStatus = async (conversationKey, userId) => {
  if (!conversationKey && !userId) return false

  return withRedis(async () => {
    if (conversationKey) {
      await redis.del(`typing:${conversationKey}`)
    }

    if (userId) {
      await redis.del(`typing:active:${userId}`)
    }

    return true
  })
}

export const getTypingStatus = async (conversationKey) => {
  if (!conversationKey) return null

  return withRedis(async () => {
    return redis.get(`typing:${conversationKey}`)
  })
}


export const getTypingConversationForUser = async (userId) => {
  if (!userId) return null

  return withRedis(async () => {
    return redis.get(`typing:active:${userId}`)
  })
}

export const setFeedCache = async (key, payload) => {
  return withRedis(async () => {
    await redis.set(key, JSON.stringify(payload), 'EX', FEED_TTL) //  // Redis automatically cleans old cache..
    return true
  })
}

export const getFeedCache = async (key) => {
  return withRedis(async () => {
    const cached = await redis.get(key)
    return safeJsonParse(cached)
  })
}

export const deleteFeedCache = async (key) => {
  return withRedis(async () => {
    await redis.del(key)  // Deletes one exact cache key...
    return true
  })
}

export const deleteFeedCacheForUser = async (userId) => {
  if(!userId) return false

  return withRedis(async () => {
    const pattern = `feed:${userId}:*`
    const keys = await redis.keys(pattern) // Deletes all feed cache keys (accnd to cursor.. -> many keys) of one user...
    if (keys.length) {
      await redis.del(...keys)
    }
    return true
  })
}

export const incrementCounter = async (name, amount = 1) => {
  return withRedis(async () => {
    return redis.incrby(`counter:${name}`, amount)
  })
}

export const getCounter = async (name) => {
  return withRedis(async () => {
    return redis.get(`counter:${name}`)
  })
}
