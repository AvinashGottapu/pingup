import { touchSession } from '../utils/redisStore.js'

const protect = async (req, res, next) => {
  try {
    const { userId } = req.auth()

    if (!userId) return res.json({ success: false, message: 'Not Authenticated' })

    await touchSession(userId)
    next()
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

export default protect