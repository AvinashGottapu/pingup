import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/axios.js'
import { toast } from 'react-hot-toast'

const initialState = {
    value : null,
    activeRoomId: null,
    isMinimized: false,
}


export const fetchUser = createAsyncThunk('user/fetchUser', async (token) => { 
    const { data } = await api.get('/api/user/data',{  // Goes to getUserData() Function.....
      headers : { Authorization : `Bearer ${token}`  }
    }) 
     return data.success ? data.user : null
})


export const updateUser = createAsyncThunk('user/update', async ({userData,token}) => { 
    const { data } = await api.post('/api/user/update', userData , {
      headers : { Authorization : `Bearer ${token}`  }
    }) 
     if(data.success) { 
        toast.success(data.message)
        return data.user
     }
     else { 
        toast.error(data.message)
        return null 
     }
})


const userSlice = createSlice({ 
    name : 'user',
    initialState,
    reducers : { 
        setActiveRoom: (state, action) => {
            state.activeRoomId = action.payload;
        },
        setIsMinimized: (state, action) => {
            state.isMinimized = action.payload;
        },
        clearActiveRoom: (state) => {
            state.activeRoomId = null;
            state.isMinimized = false;
        }
    },
    extraReducers : (builder) => { 
        builder.addCase(fetchUser.fulfilled, (state, action) => { 
            state.value = action.payload
        }).addCase(updateUser.fulfilled, (state, action) => { 
            state.value = action.payload
        })
    }
})


export const { setActiveRoom, setIsMinimized, clearActiveRoom } = userSlice.actions;

export default userSlice.reducer