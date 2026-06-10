import React from "react";
import { Eye, MessageSquare, Compass, Sparkles } from "lucide-react";
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

const Messages = () => {
  const navigate = useNavigate();
  const { connections } = useSelector((state) => state.connections)

  return (
    <div className="min-h-screen relative bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-12">
      <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Title & Explorer Header */}
        <div className="text-left space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-zinc-100 font-display">Inbox Chat</h1>
          <p className="text-slate-500 dark:text-zinc-550 text-xs font-semibold">Message your connections and start calling</p>
        </div>

        {/* Connected Users list */}
        <div className="flex flex-col gap-4">
          {connections.map((user) => (
            <div
              key={user._id}
              className="glass-panel flex gap-4 p-4 rounded-3xl border border-slate-200/40 dark:border-zinc-900/40 shadow-md hover:shadow-lg transition-all items-center"
            >
              {/* Avatar circle */}
              <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 shadow shrink-0">
                <img
                  src={user.profile_picture || 'https://images.clerk.dev/static/profile.png'}
                  alt={user.full_name}
                  className="rounded-full w-full h-full object-cover border-2 border-white dark:border-zinc-950"
                />
              </div>

              {/* Text info */}
              <div className="flex-1 text-left min-w-0">
                <p className="font-extrabold text-xs text-slate-800 dark:text-zinc-200 truncate"> {user.full_name} </p>
                <p className="text-slate-500 dark:text-zinc-500 text-[10px] font-bold"> @{user.username} </p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-450 mt-1 leading-snug truncate max-w-[200px] font-medium"> 
                  {user.bio || "Hey there! I am using Pingup."} 
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 shrink-0">
                {/* Chat button */}
                <button 
                  onClick={() => navigate(`/messages/${user._id}`)} 
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-pink-500 hover:from-blue-600 hover:to-pink-600 text-white transition cursor-pointer hover:scale-105 shadow-md shadow-pink-500/10 border-0"
                  title="Message"
                >
                  <MessageSquare className="w-4 h-4 stroke-[2]" />
                </button>

                {/* Profile button */}
                <button 
                  onClick={() => navigate(`/profile/${user._id}`)} 
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition cursor-pointer border border-transparent hover:scale-105"
                  title="View Profile"
                >
                  <Eye className="w-4 h-4 stroke-[2]" />
                </button>
              </div>
            </div>
          ))}

          {/* Fallback connection */}
          {connections.length === 0 && (
            <div className="bg-zinc-900/10 dark:bg-zinc-900/20 border border-slate-200/40 dark:border-zinc-900/40 rounded-3xl p-12 text-center space-y-4">
              <div className="inline-flex bg-zinc-900 text-teal-400 p-5 rounded-full ring-8 ring-zinc-900/40">
                <Compass className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">No Chats Available</h3>
              <p className="text-slate-500 dark:text-zinc-555 text-xs max-w-xs mx-auto font-semibold leading-relaxed">
                Connect with users on the Discover tab to start messaging!
              </p>
              <div className="pt-2">
                <button
                  onClick={() => navigate('/discover')}
                  className="bg-indigo-600 dark:bg-teal-400 text-white dark:text-zinc-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-md"
                >
                  Discover Connections
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
