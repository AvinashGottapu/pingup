import React, { useEffect, useRef, useState } from 'react'
import 'regenerator-runtime/runtime'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Login from './Pages/Login'
import Feed from './Pages/Feed'
import Messages from './Pages/Messages'
import ChatBox from './Pages/ChatBox'
import Connections from './Pages/Connections'
import Discover from './Pages/Discover'
import Profile from './Pages/Profile'
import CreatePost from './Pages/CreatePost'
import AIPage from './Pages/AIPage'
import PhotoMagicPage from './Pages/PhotoMagicPage'
import Layout from './Pages/Layout'
import { useUser, useAuth } from '@clerk/clerk-react'
import { toast, Toaster } from 'react-hot-toast'
import { useDispatch, useSelector } from 'react-redux'
import { fetchUser } from './features/user/userSlice'
import { fetchConnections } from './features/connections/connectionsSlice'
import { addMessages, deleteMessage } from './features/messages/messagesSlice'
import { clearPresence, setPresenceSnapshot, setPresenceStatus } from './features/presence/presenceSlice'
import Notification from './components/Notification'
import Roompage from './calling/Roompage'
import CallNotification from './components/CallNotification'
import { createSocket, disconnectSocket, getSocket } from './api/socket'

const App = () => {
  const { user } = useUser()
  const { getToken } = useAuth()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { pathname } = useLocation()
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    let retryTimer
    let retryCount = 0
    const MAX_RETRIES = 15
    let cancelled = false

    const fetchData = async () => {
      if (user && !cancelled) {
        try {
          const token = await getToken()
          const result = await dispatch(fetchUser(token))
          dispatch(fetchConnections(token))

          if (!result.payload && retryCount < MAX_RETRIES && !cancelled) {
            retryCount += 1
            retryTimer = setTimeout(fetchData, 2000)
          }
        } catch (error) {
          if (retryCount < MAX_RETRIES && !cancelled) {
            retryCount += 1
            retryTimer = setTimeout(fetchData, 2000)
          }
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [user, getToken, dispatch])

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const dbUser = useSelector((state) => state.user.value)

  useEffect(() => {
    const root = window.document.documentElement
    if (dbUser?.theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [dbUser])

  const [incomingCall, setIncomingCall] = useState(null)
  const audioRef = useRef(new Audio('/horror-bgm.mp3'))

  useEffect(() => {
    audioRef.current.loop = true
  }, [])

  useEffect(() => {
    if (!user) {
      disconnectSocket()
      return
    }

    let cancelled = false
    let currentSocket

    const setupSocket = async () => {
      const token = await getToken()
      if (cancelled) return

      currentSocket = createSocket(token)

      const handleNewMessage = (payload) => {
        const message = payload?.message ?? payload
        const sender = message?.sender
        const senderId = sender?._id || message?.from_user_id

        if (pathnameRef.current === `/messages/${senderId}`) {
          dispatch(addMessages(message))
          return
        }

        toast.custom(
          (t) => <Notification t={t} message={message} />,
          { position: 'bottom-right' },
        )
      }

      const handleDeletedMessage = ({ messageId }) => {
        dispatch(deleteMessage(messageId))
      }

      const handleIncomingCall = (payload) => {
        setIncomingCall(payload)
        audioRef.current.play().catch((error) => console.log('Audio play failed:', error))
      }

      const handleCallRejected = (payload) => {
        toast.error('Call Declined')
        if (pathnameRef.current.startsWith('/room')) {
          navigate('/messages/' + payload.from_user_id)
        }
      }

      const handleSocketError = (error) => {
        console.error('Socket error:', error)
      }

      const handlePresenceSync = (onlineUsers) => {
        dispatch(setPresenceSnapshot(onlineUsers))
      }

      const handlePresenceStatus = ({ userId, isOnline }) => {
        dispatch(setPresenceStatus({ userId, isOnline }))
      }

      currentSocket.on('message:new', handleNewMessage)
      currentSocket.on('message:deleted', handleDeletedMessage)
      currentSocket.on('call:incoming', handleIncomingCall)
      currentSocket.on('call:rejected', handleCallRejected)
      currentSocket.on('presence:sync', handlePresenceSync)
      currentSocket.on('presence:status', handlePresenceStatus)
      currentSocket.on('connect_error', handleSocketError)
    }

    setupSocket()

    return () => {
      cancelled = true
      const socket = getSocket()
      if (socket) {
        socket.off('message:new')
        socket.off('message:deleted')
        socket.off('call:incoming')
        socket.off('call:rejected')
        socket.off('presence:sync')
        socket.off('presence:status')
        socket.off('connect_error')
      }
      dispatch(clearPresence())
    }
  }, [user, getToken, dispatch, navigate])

  const handleAcceptCall = () => {
    setIncomingCall(null)
    audioRef.current.pause()
    audioRef.current.currentTime = 0
  }

  const handleDeclineCall = () => {
    const callerId = incomingCall?.from_user_id
    setIncomingCall(null)
    audioRef.current.pause()
    audioRef.current.currentTime = 0

    if (!callerId) return

    const socket = getSocket()

    if (!socket) {
      console.error('Socket not available for call rejection')
      return
    }

    socket.emit('call:reject', { to_user_id: callerId })
  }

  useEffect(() => {
    let timer
    if (incomingCall) {
      timer = setTimeout(() => {
        handleDeclineCall()
      }, 24000)
    }
    return () => clearTimeout(timer)
  }, [incomingCall])

  return (
    <>
      <Toaster />
      <Routes>
        <Route path='/' element={user ? <Layout /> : <Login />}>
          <Route index element={<Feed />} />
          <Route path='messages' element={<Messages />} />
          <Route path='messages/:userId' element={<ChatBox />} />
          <Route path='connections' element={<Connections />} />
          <Route path='discover' element={<Discover />} />
          <Route path='profile' element={<Profile />} />
          <Route path='profile/:profileId' element={<Profile />} />
          <Route path='create-post' element={<CreatePost />} />
          <Route path='ai' element={<AIPage />} />
          <Route path='photo-magic' element={<PhotoMagicPage />} />
        </Route>
        <Route path='/room/:roomId' element={<Roompage />} />
      </Routes>
      {incomingCall && (
        <CallNotification
          caller={incomingCall.callerName}
          roomId={incomingCall.roomId}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          callerId={incomingCall.from_user_id}
        />
      )}
    </>
  )
}

export default App
