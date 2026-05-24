import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import moment from 'moment'
import api from '../api/axios'
import { useAuth, useUser } from '@clerk/clerk-react'
import { toast } from 'react-hot-toast'

const RecentMessages = () => {
  const [messages, setMessages] = useState([])
  const [nextCursor, setNextCursor] = useState(null)

  const user = useUser()
  const { getToken } = useAuth()

  const buildConversationList = (currentMessages, incomingMessages) => {
    const merged = [...currentMessages, ...incomingMessages]

    const groupedMessages = merged.reduce((acc, message) => {
      const senderId = message?.from_user_id?._id

      if (!senderId) {
        return acc
      }

      if (!acc[senderId] || new Date(message.createdAt) > new Date(acc[senderId].createdAt)) {
        acc[senderId] = message
      }

      return acc
    }, {})

    return Object.values(groupedMessages).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
  }

  const fetchRecentMessages = useCallback(async ({ refresh = false } = {}) => {
    try {
      const token = await getToken()

      const { data } = await api.get('/api/user/recent-messages', {
        params: {
          cursor: refresh ? undefined : nextCursor,
          limit: 25,
        },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!data.success) {
        throw new Error(data.message)
      }

      setMessages((currentMessages) => buildConversationList(currentMessages, data.messages))

      if (!refresh) {
        setNextCursor(data.nextCursor || null)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }, [getToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) {
      return
    }

    fetchRecentMessages()

    const interval = setInterval(() => {
      fetchRecentMessages({ refresh: true })
    }, 30000)

    return () => clearInterval(interval)
  }, [user, getToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className='bg-white dark:bg-slate-900 w-full mt-2 p-4 min-h-20 rounded-md text-xs text-slate-800 dark:text-slate-200 shadow'>
      <h3 className='font-semibold text-slate-8 dark:text-white mb-4'> Recent Messages </h3>
      <div className='flex flex-col max-h-56 overflow-y-scroll no-scrollbar'>
        {messages.map((message, index) => (
          <Link
            to={`/messages/${message.from_user_id._id}`}
            key={index}
            className='flex items-start gap-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded'
          >
            <img src={message.from_user_id.profile_picture} alt='' className='w-8 h-8 rounded-full' />
            <div className='w-full'>
              <div className='flex justify-between'>
                <p className='font-medium dark:text-white'> {message.from_user_id.full_name} </p>
                <p className='text-slate-400 dark:text-slate-500 text-[10px]'> {moment(message.createdAt).fromNow()} </p>
              </div>
              <div className='flex justify-between'>
                <p> {message.text ? message.text : 'Media'} </p>
                {!message.seen && (
                  <p className='bg-indigo-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px]'> 1 </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default RecentMessages
