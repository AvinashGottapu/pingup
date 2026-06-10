import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/axios'

const initialState = {
    messages: []
}

export const fetchMessages = createAsyncThunk(
    'messages/fetchMessages',
    async ({ token, userId, cursor = null, limit = 15, mode = 'replace' }) => {
        const { data } = await api.post(
            'api/message/get',
            { to_user_id: userId, cursor, limit },
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        )

        return data.success ? { ...data, mode } : null
    }
)

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        setMessages: (state, action) => {
            state.messages = action.payload
        },
        addMessages: (state, action) => {
            const nextMessage = action.payload

            if (state.messages.some((message) => message._id === nextMessage._id)) {
                return
            }

            state.messages = [nextMessage, ...state.messages]
        },
        resetMessages: (state) => {
            state.messages = [];
        },
        deleteMessage: (state, action) => {
            state.messages = state.messages.filter(msg => msg._id !== action.payload)
        },
        markMessagesAsSeen: (state, action) => {
            const readerId = action.payload.from_user_id
            state.messages = state.messages.map((msg) => {
                if (msg.to_user_id === readerId) {
                    return { ...msg, seen: true }
                }
                return msg
            })
        }
    },
    extraReducers: (builder) => {
        builder.addCase(fetchMessages.fulfilled, (state, action) => {
            if (!action.payload) {
                return
            }

            if (action.payload.mode === 'prepend') {
                state.messages = [...action.payload.messages, ...state.messages]
                return
            }

            state.messages = action.payload.messages
        })
    }
})

export const { setMessages, addMessages, resetMessages, deleteMessage, markMessagesAsSeen } = messagesSlice.actions;

export default messagesSlice.reducer