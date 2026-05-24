import { io } from 'socket.io-client'

let socket = null

const SOCKET_URL = import.meta.env.VITE_BASEURL

export const createSocket = (token) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    return socket
  }

  const tokenChanged = socket.auth?.token !== token
  socket.auth = { token }

  if (tokenChanged) {
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
}
