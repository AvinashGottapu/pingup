import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const REDIS_OPTIONS = {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  retryStrategy: () => null,
  reconnectOnError: (error) => {
    const message = error?.message || ''
    return !message.includes('READONLY')
  },
}

// Main Redis client for Caching, Sessions, and Presence Sets
const redis = new Redis(REDIS_URL, REDIS_OPTIONS)

redis.on('error', (error) => {
  console.warn('[Redis] client error:', error.message)
})

export { redis }

export const getRedisStatus = async () => {
  try {
    return await redis.ping() // Returns 'PONG' if Redis is working
  } catch (error) {
    return null // If there's an error, return null
  }
}
