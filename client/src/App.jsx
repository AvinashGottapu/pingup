import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./Pages/Login";
import Feed from "./Pages/Feed";
import Messages from "./Pages/Messages";
import ChatBox from "./Pages/ChatBox";
import Connections from "./Pages/Connections";
import Discover from "./Pages/Discover";
import Profile from "./pages/Profile";
import CreatePost from "./Pages/CreatePost";
import Layout from "./Pages/Layout";
import { useUser, useAuth } from "@clerk/clerk-react";
import { Toaster } from 'react-hot-toast'
import { useEffect } from "react";

const App = () => { 
    
      const { user } = useUser()
      const { getoken } = useAuth()  

      useEffect(() => { 
        if(user) { 
          getoken().then((token) => console.log(token))
        }
       },[])

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
