import { io } from 'socket.io-client'

let socket = null
let currentUserId = null

const SOCKET_URL = import.meta.env.VITE_BASEURL

const getUserIdFromToken = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const payload = JSON.parse(jsonPayload)
    return payload.sub
  } catch (error) {
    return null
  }
}

export const createSocket = (token) => {
  const userId = getUserIdFromToken(token)

  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    currentUserId = userId
    return socket
  }

  const userChanged = userId && currentUserId && currentUserId !== userId
  socket.auth = { token }

  
  if (userChanged) {
    currentUserId = userId
    socket.disconnect()
    socket.connect()
    return socket
  }

  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
  currentUserId = null
}
