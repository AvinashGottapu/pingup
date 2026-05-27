import fs from 'fs'
import mongoose from 'mongoose'
import imagekit from '../configs/imageKit.js'
import Message from '../models/Message.js'
import { emitToUser, isUserOnline } from '../socketManager.js'
import { checkRateLimit, incrementCounter } from '../utils/redisStore.js'

const MESSAGE_LIMIT = 25

const normalizeMessagePayload = (message) => {
  const fromUser = message.from_user_id
  const toUser = message.to_user_id

  return {
    _id: message._id,
    from_user_id: typeof fromUser === 'string' ? fromUser : fromUser?._id?.toString(),
    to_user_id: typeof toUser === 'string' ? toUser : toUser?._id?.toString(),
    text: message.text,
    message_type: message.message_type,
    media_url: message.media_url,
    seen: message.seen,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    sender: typeof fromUser === 'string'
      ? null
      : {
          _id: fromUser?._id,
          full_name: fromUser?.full_name,
          username: fromUser?.username,
          profile_picture: fromUser?.profile_picture,
        },
  }
}

const parseCursor = (cursor) => {
  if (!cursor) return null

  const [createdAt, id] = cursor.split('|')

  if (!createdAt || !id) return null

  return {
    createdAt: new Date(createdAt),
    id,
  }
}

const buildCursorFilter = (cursor) => {
  const parsedCursor = parseCursor(cursor)

  if (!parsedCursor) {
    return {}
  }

  return {
    $or: [
      { createdAt: { $lt: parsedCursor.createdAt } },
      { createdAt: parsedCursor.createdAt, _id: { $lt: new mongoose.Types.ObjectId(parsedCursor.id) } },
    ],
  }
}

export const sendMessage = async (req, res) => {
  try {
    const { userId } = req.auth()
    const { to_user_id, text } = req.body
    const image = req.file

    const rateLimit = await checkRateLimit(`rate:message:${userId}`, 20, 60)

    if (rateLimit && !rateLimit.allowed) {
      return res.status(429).json({
  success: false,
  message: 'Too many messages. Please wait a minute before sending more.',
  retryAfter: rateLimit.ttl,
})
    }

    let media_url = ''
    const message_type = image ? 'image' : 'text'

    if (message_type === 'image') {
      const fileBuffer = fs.readFileSync(image.path)
      const response = await imagekit.upload({
        file: fileBuffer,
        fileName: image.originalname,
      })

      media_url = imagekit.url({
        path: await response.filePath,
        transformation: [
          { quality: 'auto' },
          { format: 'webp' },
          { width: '1280' },
        ],
      })
    }

    const message = await Message.create({
      from_user_id: userId,
      to_user_id,
      text,
      message_type,
      media_url,
    })

    const messageWithUserData = await Message.findById(message._id).populate('from_user_id')
    const normalizedMessage = normalizeMessagePayload(messageWithUserData)

    await incrementCounter('messages.sent')
    res.json({ success: true, message: normalizedMessage })

    emitToUser(to_user_id, 'message:new', {
      type: 'message:new',
      message: normalizedMessage,
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export const getChatMessages = async (req, res) => {
  try {
    const { userId } = req.auth()
    const { to_user_id, cursor, limit = MESSAGE_LIMIT } = req.body

    const pageSize = Math.min(Number(limit) || MESSAGE_LIMIT, MESSAGE_LIMIT)
    const cursorFilter = buildCursorFilter(cursor)

    const messages = await Message.find({
      $and: [
        {
          $or: [
            { from_user_id: userId, to_user_id },
            { from_user_id: to_user_id, to_user_id: userId },
          ],
        },
        cursorFilter,
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize + 1)

    const hasMore = messages.length > pageSize
    const paginatedMessages = hasMore ? messages.slice(0, pageSize) : messages

    await Message.updateMany(
      { from_user_id: to_user_id, to_user_id: userId },
      { seen: true },
    )

    const nextCursor = hasMore
      ? `${paginatedMessages[paginatedMessages.length - 1].createdAt.toISOString()}|${paginatedMessages[paginatedMessages.length - 1]._id.toString()}`
      : null

    res.json({
      success: true,
      messages: paginatedMessages,
      nextCursor,
      hasMore,
    })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export const getUserRecentMessages = async (req, res) => {
  try {
    const { userId } = req.auth()
    const { cursor, limit = MESSAGE_LIMIT } = req.query

    const pageSize = Math.min(Number(limit) || MESSAGE_LIMIT, MESSAGE_LIMIT)
    const cursorFilter = buildCursorFilter(cursor)

    const messages = await Message.find({
      $and: [
        { to_user_id: userId },
        cursorFilter,
      ],
    })
      .populate('from_user_id to_user_id')
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize + 1)

    const hasMore = messages.length > pageSize
    const paginatedMessages = hasMore ? messages.slice(0, pageSize) : messages

    const nextCursor = hasMore
      ? `${paginatedMessages[paginatedMessages.length - 1].createdAt.toISOString()}|${paginatedMessages[paginatedMessages.length - 1]._id.toString()}`
      : null

    res.json({
      success: true,
      messages: paginatedMessages,
      nextCursor,
      hasMore,
    })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

export const initiateCall = async (req, res) => {
  try {
    const { userId } = req.auth()
    const { to_user_id, roomId, callerName } = req.body

    if (!isUserOnline(to_user_id)) {
      res.json({ success: false, message: 'User is not available' })
      return
    }

    emitToUser(to_user_id, 'call:incoming', {
      type: 'call',
      roomId,
      callerName,
      from_user_id: userId,
    })

    res.json({ success: true, message: 'Call initiated' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export const rejectCall = async (req, res) => {
  try {
    const { userId } = req.auth()
    const { to_user_id } = req.body

    if (!isUserOnline(to_user_id)) {
      res.json({ success: false, message: 'User is not available' })
      return
    }

    emitToUser(to_user_id, 'call:rejected', {
      type: 'call_rejected',
      from_user_id: userId,
    })

    res.json({ success: true, message: 'Call rejected' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.body

    const message = await Message.findById(messageId)

    if (!message) {
      res.json({ success: false, message: 'Message not found' })
      return
    }

    await Message.findByIdAndDelete(messageId)
    await incrementCounter('messages.deleted')

    const targets = new Set([
      message.from_user_id?.toString(),
      message.to_user_id?.toString(),
    ].filter(Boolean))

    for (const userId of targets) {
      emitToUser(userId, 'message:deleted', {
        messageId,
      })
    }

    res.json({ success: true, message: 'Message deleted' })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}