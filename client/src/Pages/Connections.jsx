import React, { useState, useEffect } from "react";
import { Users, UserPlus, UserCheck, UserRoundPen, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import { fetchConnections } from '../features/connections/connectionsSlice'
import api from '../api/axios'
import { toast } from 'react-hot-toast'


const Connections = () => {
  const [currentTab, setCurrentTab] = useState("Followers");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getToken } = useAuth();

  const { connections, pendingConnections, followers, following } = useSelector((state) => state.connections)

  const dataArray = [
    { label: "Followers", value: followers, icon: Users },
    { label: "Following", value: following, icon: UserCheck },
    { label: "Pending", value: pendingConnections, icon: UserRoundPen },
    { label: "Connections", value: connections, icon: UserPlus },
  ];


  const handleUnfollow = async (userId) => {
    try {
      const token = await getToken();
      const { data } = await api.post("/api/user/unfollow", { id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success(data.message);
        dispatch(fetchConnections(token));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const acceptConnection = async (userId) => {
    try {
      const token = await getToken();
      const { data } = await api.post("/api/user/accept", { id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success(data.message);
        dispatch(fetchConnections(token));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };


  useEffect(() => { getToken().then((token) => { dispatch(fetchConnections(token)) }) }, [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto p-6">
        {/* Title  */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {" "}
            Connections{" "}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {" "}
            Manage your network and discover new connections{" "}
          </p>
        </div>

        {/* Counts */}
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {dataArray.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center gap-1 border h-20 w-full border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow rounded-md"
            >
              <b className="dark:text-white"> {item.value.length} </b>
              <p className="tetx-slate-600 dark:text-slate-400"> {item.label} </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 sm:inline-flex sm:flex-wrap sm:items-center border border-gray-200 dark:border-slate-800 rounded-md p-1 bg-white dark:bg-slate-900 shadow-sm">
          {dataArray.map((tab) => (
            <button
              onClick={() => setCurrentTab(tab.label)}
              key={tab.label}
              className={`flex items-center justify-center sm:justify-start px-3 py-1 text-sm rounded-md transition-colors ${currentTab === tab.label
                  ? "bg-white dark:bg-slate-800 font-medium text-black dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
                } cursor-pointer`}
            >
              <tab.icon className="w-4 h-4" />
              <p className="ml-1"> {tab.label} </p>
              {tab.count !== undefined && (
                <span className="ml-2 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                  {" "}
                  {tab.count}{" "}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Connnections */}

        <div className="flex flex-wrap gap-6 mt-6">
          {dataArray
            .find((item) => item.label === currentTab)
            .value.map((user) => (
              <div
                key={user._id}
                className="w-full max-w-88 flex gap-5 p-6 bg-white dark:bg-slate-900 shadow rounded-md border dark:border-slate-800"
              >
                <img
                  src={user.profile_picture}
                  alt=""
                  className="rounded-full w-12 h-12 shadow-md mx-auto"
                />

                <div className="flex-1">
                  <p className="font-medium text-slate-700 dark:text-white">
                    {" "}
                    {user.full_name}{" "}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400"> @{user.username} </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {" "}
                    {user.bio.slice(0, 30)}...{" "}
                  </p>
                  <div className="flex max-sm:flex-col gap-2 mt-4">
                    {
                      <button
                        onClick={() => navigate(`/profile/${user._id}`)}
                        className="w-full p-2 text-sm rounded bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition text-white cursor-pointer"
                      >
                        View Profile
                      </button>
                    }
                    {currentTab === "Following" && (
                      <button onClick={() => handleUnfollow(user._id)} className="w-full p-2 text-sm rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-black dark:text-white active:scale-95 transition cursor-pointer">
                        Unfollow
                      </button>
                    )}
                    {currentTab === "Pending" && (
                      <button onClick={() => acceptConnection(user._id)} className="w-full p-2 text-sm rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-black dark:text-white active:scale-95 transition cursor-pointer">
                        Accept
                      </button>
                    )}
                    {currentTab === "Connections" && (
                      <button
                        onClick={() => { navigate(`/message/${user._id}`) }}
                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition active:scale-95"
                      >
                        <MessageSquare className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                        Message
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Connections;
