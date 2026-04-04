import React, { useRef } from "react";
import 'regenerator-runtime/runtime';
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import api from "./api/axios";
import Login from "./Pages/Login";
import Feed from "./Pages/Feed";
import Messages from "./Pages/Messages";
import ChatBox from "./Pages/ChatBox";
import Connections from "./Pages/Connections";
import Discover from "./Pages/Discover";
import Profile from "./Pages/Profile";
import CreatePost from "./Pages/CreatePost";
import AIPage from "./Pages/AIPage";
import Layout from "./Pages/Layout";
import { useUser, useAuth } from "@clerk/clerk-react";
import { toast, Toaster } from 'react-hot-toast'
import { useEffect } from "react"
import { useDispatch, useSelector } from 'react-redux'
import { fetchUser } from './features/user/userSlice'
import { fetchConnections } from "./features/connections/connectionsSlice";
import { addMessages } from "./features/messages/messagesSlice";
import Notification from "./components/Notification";
import Roompage from "./calling/Roompage";
import CallNotification from "./components/CallNotification";
import { useState } from "react";

const App = () => {

   const { user } = useUser()
   const { getToken } = useAuth()
   const dispatch = useDispatch()
   const navigate = useNavigate();

   const { pathname } = useLocation();
   const pathnameRef = useRef(pathname)

   useEffect(() => {
      let retryTimer;
      let retryCount = 0;
      const MAX_RETRIES = 15;
      let cancelled = false;

      const fetchData = async () => {
         if (user && !cancelled) {
            try {
               const token = await getToken()
               const result = await dispatch(fetchUser(token))
               dispatch(fetchConnections(token))

               if (!result.payload && retryCount < MAX_RETRIES && !cancelled) {
                  retryCount++
                  retryTimer = setTimeout(fetchData, 2000)
               }
            } catch (error) {
               if (retryCount < MAX_RETRIES && !cancelled) {
                  retryCount++
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
      pathnameRef.current = pathname;
   }, [pathname])

   const dbUser = useSelector((state) => state.user.value);

   useEffect(() => {
      const root = window.document.documentElement;
      if (dbUser?.theme === 'dark') {
         root.classList.add('dark');
      } else {
         root.classList.remove('dark');
      }
   }, [dbUser]);



   const [incomingCall, setIncomingCall] = useState(null);
   const audioRef = useRef(new Audio("/horror-bgm.mp3"));

   useEffect(() => {
      audioRef.current.loop = true;
   }, []);

   useEffect(() => {
      if (user) {
         const eventSource = new EventSource(import.meta.env.VITE_BASEURL + '/api/message/' + user.id);
         eventSource.onmessage = (event) => {
            const message = JSON.parse(event.data)

            if (message.type === 'call') {
               setIncomingCall(message);
               audioRef.current.play().catch(e => console.log("Audio play failed:", e));
            } else if (message.type === 'call_rejected') {
               toast.error("Call Declined");
               if (pathnameRef.current.startsWith('/room')) {
                  navigate('/messages/' + message.from_user_id);
               }
            } else if (pathnameRef.current === ('/messages/' + message.from_user_id._id)) {
               dispatch(addMessages(message))
            }
            else {
               toast.custom((t) => (
                  <Notification t={t} message={message} />
               ), { position: "bottom-right" })
            }
         }
         return () => {
            eventSource.close();
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
         }
      }
   }, [user, dispatch])

   const handleAcceptCall = () => {
      setIncomingCall(null);
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
   }

   const handleDeclineCall = async () => {
      const callerId = incomingCall?.from_user_id;
      setIncomingCall(null);
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      if (callerId) {
         try {
            const token = await getToken();
            await api.post('/api/message/reject', { to_user_id: callerId }, {
               headers: { Authorization: `Bearer ${token}` }
            });

         } catch (error) {
            console.error("Failed to reject call", error);
         }
      }
   }

   useEffect(() => {
      let timer;
      if (incomingCall) {
         timer = setTimeout(() => {
            handleDeclineCall();
         }, 24000);
      }
      return () => clearTimeout(timer);
   }, [incomingCall]);


   return (
      <>
         <Toaster />   {/* NOW WE CAN USE TOASTER ANY WHERE IN THE PROJECT */}
         <Routes>
            <Route path="/" element={user ? <Layout /> : <Login />}>
               <Route index element={<Feed />} />  {/* WITH OUT SUB-PATHS BY DEFAULT IT WILL BE RENDERED */}
               <Route path="messages" element={<Messages />} />
               <Route path="messages/:userId" element={<ChatBox />} />
               <Route path="connections" element={<Connections />} />
               <Route path="discover" element={<Discover />} />
               <Route path="profile" element={<Profile />} />
               <Route path="profile/:profileId" element={<Profile />} />
               <Route path="create-post" element={<CreatePost />} />
               <Route path="ai" element={<AIPage />} />
            </Route>
            <Route path="/room/:roomId" element={<Roompage />} />
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
   );
};

export default App;
