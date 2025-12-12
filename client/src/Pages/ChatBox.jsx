import React, { useEffect, useRef, useState } from "react";
import { ImageIcon, SendHorizonal } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { addMessages, fetchMessages, resetMessages } from "../features/messages/messagesSlice.js";

const ChatBox = () => {
  const { messages } = useSelector((state) => state.messages);
  const currentUser = useSelector((state) => state.user.value);

  const { userId } = useParams();
  const { getToken } = useAuth();
  const dispatch = useDispatch();

  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const connections = useSelector((state) => state.connections.connections);

  // Fetch conversation messages
  const fetchUserMessages = async () => {
    try {
      const token = await getToken();
      dispatch(fetchMessages({ token, userId }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Send Message
  const sendMessage = async () => {
    try {
      if (!text && !image) return;

      const token = await getToken();
      const formData = new FormData();

      formData.append("to_user_id", userId);
      formData.append("text", text); 
      if (image) formData.append("image", image);

      const { data } = await api.post("/api/message/send", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setText("");
        setImage(null);
        dispatch(addMessages(data.message));
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Load messages when userId changes
  useEffect(() => {
    fetchUserMessages();
    return () => {
      dispatch(resetMessages());
    };
  }, [userId]);

  // Load user info from connections list
  useEffect(() => {
    if (connections.length > 0) {
      const found = connections.find((c) => c._id === userId);
      setUser(found);
    }
  }, [connections, userId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      // ensure scroll after render
      requestAnimationFrame(() => {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return user && (
    <div className='flex flex-col h-screen bg-slate-100'>
         <div className='flex items-center gap-3 px-4 py-3 md:px-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 shadow-sm'> 
               <img src={user.profile_picture} alt="" className='size-9 rounded-full'/> 
               <div> 
                <p className='font-medium'> {user.full_name} </p> 
                <p className='text-sm text-gray-500 -mt-1.5'> @{user.username} </p>
               </div>
         </div> 
           
           <div ref={messagesContainerRef} className='flex-1 overflow-y-auto px-3 md:px-8 py-5'>  
              <div className='space-y-3 max-w-3xl w-full mx-auto'> 
                  { 
                    messages.toSorted((a,b) => new Date(a.createdAt) - new Date(b.createdAt)).map((message,index) => (
                        <div key={index} className={`flex flex-col ${message.to_user_id !== user._id ? 'items-start': 'items-end' }`}>  
                              <div className={`px-3 py-2 text-sm max-w-[75%] bg-white text-slate-700 rounded-2xl shadow ${ message.to_user_id !== user._id ? 'rounded-bl-sm' : 'rounded-br-sm' }`}>   
                                { message.message_type === 'image' && 
                                 <img src={message.media_url} className='w-full max-w-sm rounded-lg mb-1' alt="" /> }
                                <p> {message.text} </p>
                              </div>
                        </div>
                    ))
                  } 
                <div ref={messagesEndRef} />
          </div>
       </div> 
         <div className='px-3 pb-4 pt-1'> 
            <div className='flex items-center gap-3 pl-5 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow rounded-full md-5'> 
               <input type="text" className='flex-1 outline-none text-slate-700' placeholder='Type a message' 
               onKeyDown={e => e.key==='Enter' && sendMessage()} onChange={(e) => setText(e.target.value)} value={text} /> 
               <label htmlFor="image">   
                  { 
                    image 
                    ? <img src={URL.createObjectURL(image)} alt="" className='h-8 rounded'/> 
                    : <ImageIcon className='size-7 text-gray-400 cursor-pointer'/>
                  }
                 <input type="file" id='image' accept='image/*' hidden onChange={(e) => setImage(e.target.files[0])}/>
               </label> 
                 <button onClick={sendMessage} className='bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 cursor-pointer text-white p-2 rounded-full'>  
                   <SendHorizonal size={18}/>
                 </button>
            </div>
         </div>
    </div>
  )
}

export default ChatBox
