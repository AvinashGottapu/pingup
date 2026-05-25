import { configureStore } from '@reduxjs/toolkit'
import userReducer from '../features/user/userSlice.js'
import connectionsReducer from '../features/connections/connectionsSlice.js'
import messagesReducer from '../features/messages/messagesSlice.js'
import presenceReducer from '../features/presence/presenceSlice.js'

export const store = configureStore({ 
    reducer : { 
        user : userReducer,
        connections : connectionsReducer,
        messages : messagesReducer,
        presence : presenceReducer,
    }
})