import React from "react";
import { MapPin, UserPlus, MessageCircle, Users } from "lucide-react";
import { useSelector } from "react-redux";
import { useAuth } from '@clerk/clerk-react';
import { useDispatch } from "react-redux";
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { fetchUser } from '../features/user/userSlice';
import { toast } from 'react-hot-toast';

const UserCard = ({ user }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const currentUser = useSelector((state) => state.user.value);

  const handleFollow = async () => {
    try {
      const token = await getToken();
      const { data } = await api.post("/api/user/follow", { id: user._id },
        { headers: { Authorization: `Bearer ${token}` } });

      if (data.success) {
        toast.success(data.message);
        dispatch(fetchUser(token));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleConnectionRequest = async () => {
    if (currentUser.connections.includes(user._id)) {
      return navigate("/messages/" + user._id);
    }
    try {
      const token = await getToken();
      const { data } = await api.post("/api/user/connect", { id: user._id },
        { headers: { Authorization: `Bearer ${token}` } });

      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const isFollowing = currentUser && currentUser.following?.includes(user._id);
  const isConnected = currentUser && currentUser.connections?.includes(user._id);

  return (
    <div className="group relative w-full">
      {/* Gradient border glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 via-purple-400 to-pink-300 rounded-2xl opacity-0 group-hover:opacity-30 blur-sm transition-all duration-300"></div>

      <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="h-20 bg-gradient-to-r from-indigo-500 via-purple-600 to-purple-900 relative">
          <div className="absolute inset-0 bg-black/5"></div>
        </div>

        {/* Profile Section */}
        <div className="px-5 pb-5">
          {/* Avatar */}
          <div className="flex justify-center -mt-12 mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-md opacity-50"></div>
              <img
                src={user.profile_picture}
                alt={user.full_name}
                className="relative w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-2xl"
              />
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-800 shadow-lg"></div>
            </div>
          </div>

          {/* User Info */}
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-0.5 truncate px-2">
              {user.full_name}
            </h3>
            {user.username && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2.5 truncate">
                @{user.username}
              </p>
            )}
            {user.bio && (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed px-3 line-clamp-2 min-h-[32px]">
                {user.bio}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {user.location && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-white/50 dark:bg-slate-700/50 rounded-full backdrop-blur-sm">
                <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]">{user.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1 px-2.5 py-1 bg-white/50 dark:bg-slate-700/50 rounded-full backdrop-blur-sm">
              <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-bold">{user.followers.length}</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleFollow}
              disabled={isFollowing}
              className={`
                flex-1 py-2 px-3 rounded-lg font-semibold text-xs
                flex items-center justify-center gap-1.5
                transition-all duration-200
                ${isFollowing
                  ? 'bg-white/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 cursor-default border border-slate-300 dark:border-slate-600'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                }
              `}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isFollowing ? 'Following' : 'Follow'}
            </button>

            <button
              onClick={handleConnectionRequest}
              className={`
                p-2 rounded-lg font-semibold transition-all duration-200
                ${isConnected
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg border-none'
                }
                hover:-translate-y-0.5 active:translate-y-0
              `}
            >
              {isConnected ? (
                <MessageCircle className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCard;