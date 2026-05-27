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

const redis = new Redis(REDIS_URL, REDIS_OPTIONS)  // Main Redis client for publishing + normal commands..
const redisSubscriber = new Redis(REDIS_URL, REDIS_OPTIONS) // listening/subscribing 

redis.on('error', (error) => {
  console.warn('[Redis] client error:', error.message)
})

redisSubscriber.on('error', (error) => {
  console.warn('[Redis] subscriber error:', error.message)
})

export { redis, redisSubscriber }

export const getRedisStatus = async () => {
  try {
    return await redis.ping()  // Returns 'PONG' if Redis is working...
  } catch (error) {
    return null   // If there's an error (e.g., connection issue), return null to indicate Redis is not available
  }
}
