import React, { useRef } from "react";
import { Routes, Route,  useLocation } from "react-router-dom";
import Login from "./Pages/Login";
import Feed from "./Pages/Feed";
import Messages from "./Pages/Messages";
import ChatBox from "./Pages/ChatBox";
import Connections from "./Pages/Connections";
import Discover from "./Pages/Discover";
import Profile from "./Pages/Profile";
import CreatePost from "./Pages/CreatePost";
import Layout from "./Pages/Layout";
import { useUser, useAuth } from "@clerk/clerk-react";
import { toast,  Toaster } from 'react-hot-toast'
import { useEffect } from "react"
import { useDispatch } from 'react-redux'
import { fetchUser  } from './features/user/userSlice'
import { fetchConnections } from "./features/connections/connectionsSlice";
import { addMessages } from "./features/messages/messagesSlice";
import Notification from "./components/Notification";

const App = () => { 
    
      const { user } = useUser()
      const { getToken } = useAuth()   
      const dispatch = useDispatch() 
      
      const { pathname } = useLocation();
      const pathnameRef = useRef(pathname)
    
      useEffect(() => { 
         const fetchData = async () => { 
            if(user) { 
               const token = await getToken() 
               dispatch(fetchUser(token)) 
               dispatch(fetchConnections(token))
            }
         } 
           fetchData()
       },[user,getToken,dispatch])

      useEffect(() => { 
           pathnameRef.current = pathname;
       },[pathname])

       useEffect(() => { 
           if(user) { 
              const eventSource = new EventSource(import.meta.env.VITE_BASEURL + '/api/message/' + user.id);
              eventSource.onmessage = (event) => { 
                   const message = JSON.parse(event.data)
                   if(pathnameRef.current === ('/messages/' + message.from_user_id._id)) { 
                          dispatch(addMessages(message))
                   } 
                   else { 
                          toast.custom((t) => (
                           <Notification t={t} message={message}/>
                          ),{position : "bottom-right"})
                   }
              } 
              return () => { 
                 eventSource.close();
              }
           }
       },[user,dispatch])

  return (
    <> 
       <Toaster/>   {/* NOW WE CAN USE TOASTER ANY WHERE IN THE PROJECT */}
      <Routes>
        <Route path="/" element={ user ? <Layout/> : <Login />}>
          <Route index element={<Feed />} />  {/* WITH OUT SUB-PATHS BY DEFAULT IT WILL BE RENDERED */}
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:userId" element={<ChatBox />} />
          <Route path="connections" element={<Connections />} />
          <Route path="discover" element={<Discover />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/:profileId" element={<Profile />} />
          <Route path="create-post" element={<CreatePost />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;
