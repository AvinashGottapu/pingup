import { setSession } from '../utils/redisStore.js'

const protect = async (req, res, next) => {
  try {
    //    // 1. Read userId from req.auth() (already verified by Layer 1!) (ClerkMiddleware)
    const { userId } = req.auth()

    if (!userId) return res.json({ success: false, message: 'Not Authenticated' })

    await setSession(userId, {}) // HeartBeat used for the lastSeen...
    next()
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

export default protect