import { redis } from '../configs/redis.js'

const SESSION_TTL = 60 * 60
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
    const clearBefore = now - windowMs

    // Use a transaction (multi) to make operations atomic
    const result = await redis
      .multi() // Queue multiple commands. They execute together.
      .zremrangebyscore(key, 0, clearBefore) // remove timestamps outside the current window
      .zcard(key)                            // count elements inside the window
      .exec();

    // Redis returns => [ [null, removedCount], [null, currentCount] ]
    const currentCount = result[1][1];

    if (currentCount >= Number(limit)) {
      const oldestTimestamp = await redis.zrange(key, 0, 0, 'WITHSCORES');
      // It returns elements based on their position in the sorted set. [ZRANGE key start stop]
      let retryAfter = Math.ceil(windowMs / 1000);
      
      if (oldestTimestamp && oldestTimestamp.length > 0) {
        const oldestTime = parseInt(oldestTimestamp[1], 10);
        retryAfter = Math.ceil((oldestTime + windowMs - now) / 1000);
      }
      
      retryAfter = retryAfter > 0 ? retryAfter : 1;

      return {
        allowed: false,
        count: currentCount,
        remaining: 0,
        ttl: retryAfter,
      }
    }

    // Add current request timestamp to the sorted set and set expiration
    await redis
      .multi()
      .zadd(key, now, `${now}-${Math.random().toString(36).slice(2, 10)}`)
      .expire(key, Math.ceil(windowMs / 1000))
      .exec();

    const nextCount = currentCount + 1;

    return {
      allowed: true,
      count: nextCount,
      remaining: Math.max(0, Number(limit) - nextCount),
      ttl: 0,
    }
  })
}

// THESE 3 => used for ✅ last seen tracking ✅ active session management..
// If key expires.... MONGO DB is for truth..

export const setSession = async (userId, payload = {}) => {
  if (!userId) return false
  // // hset Handles the different tabs..
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
  // inside the broadcastPresenceUpdate function, and inside userController.js when someone fetches a user's profile.
  // When User A visits User B's profile, the Node server needs to know when User B was last seen. Instead of instantly doing a slow query on MongoDB, the server runs getSession(userId)
  return withRedis(async () => {
    const data = await redis.hgetall(`session:${userId}`)
    return Object.keys(data || {}).length ? data : null
  })
}

export const deleteSession = async (userId) => {
  if (!userId) return false
  //  user explicitly logs out of the app, or if they permanently delete their account. 
  // We never call this in the codebase..
  return withRedis(async () => {
    await redis.del(`session:${userId}`)
    return true
  })
}


const ONLINE_SOCKET_TTL = 24 * 60 * 60 // 24 hours

export const registerOnlineUser = async (userId, socketId) => {
  if (!userId) return false
  // I originally put a 24-hour TTL on my active socket tracking in Redis to prevent memory leaks in case of a server crash.
  // I realized this creates a bug for power users who leave the app open for more than a day
  return withRedis(async () => {
    const key = `online:users`
    await redis.sadd(key, userId)  // SADD stores only unique elements.
    // May be used in the future...
    // Key: online:users { user1, user2, user3} 
    // To display easily how many online users in this appication(O(1)) But hset => O(N)...
    
    await redis.hset(`online:socket:${userId}`, socketId, Date.now().toString()) 
    // Diff tabs..  user1 may be connected from: - Chrome tab - Mobile app - Another laptop...
    // Run KEYS online:socket:* to find every single hash in the entire database. (This scans your entire database and is O(N) extremely slow).  Count the results.
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
    // Already TAB 1,2 are deleted..
    // Tab 3 runs hdel(socket3) -> deletes socket3.
    //Tab 3 checks hlen(online:socket:UserA) -> sees 0 remaining sockets.
    // Tab 3 is supposed to run srem('online:users', UserA).  (This why Source of truth requried..)
    // Returns all users.. in online:users
    if (!users || users.length === 0) return []

    // Verify which users actually have active socket registrations
    const pipeline = redis.pipeline()
    users.forEach((userId) => {
      pipeline.exists(`online:socket:${userId}`)
      // Check
      //  To prevent "Ghost Users" (Fake Online Users).
      // online:socket:${userId} is the Primary Source of Truth (the actual active sockets).
      // online:users is just a Secondary Fast Index (the master list).
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
      // If it finds any ghost users, it automatically deletes them from the online:users
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
