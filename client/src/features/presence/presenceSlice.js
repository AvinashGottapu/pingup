import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  onlineUsers: {},
}

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setPresenceSnapshot: (state, action) => {
      const payload = action.payload || {}

      // if backend sends array: ["user1", "user2"]
      if (Array.isArray(payload)) {
        state.onlineUsers = payload.reduce((acc, userId) => {
          acc[userId] = true
          return acc
        }, {})
      } 
      // if backend sends object: { user1: true, user2: true }
      else {
        state.onlineUsers = payload
      }
    },

    setPresenceStatus: (state, action) => {
      const { userId, isOnline } = action.payload

      if (!userId) return

      if (isOnline) {
        state.onlineUsers[userId] = true
      } else {
        delete state.onlineUsers[userId]
      }
    },

    clearPresence: (state) => {
      state.onlineUsers = {}
    },
  },
})

export const {
  setPresenceSnapshot,
  setPresenceStatus,
  clearPresence,
} = presenceSlice.actions

export default presenceSlice.reducer