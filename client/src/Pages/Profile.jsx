import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import UserProfileInfo from "../components/UserProfileInfo";
import PostCard from "../components/PostCard";
import moment from "moment";
import ProfileModal from "../components/ProfileModal";
import { useAuth } from "@clerk/clerk-react";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import api from "../api/axios";
import { Grid, Image as ImageIcon, Sparkles } from "lucide-react";

const Profile = () => {
  const currentUser = useSelector((state) => state.user.value);

  const { profileId } = useParams();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("posts");
  const [showEdit, setShowEdit] = useState(false);

  const { getToken } = useAuth();

  const fetchUser = async (profileId) => {
    try {
      const token = await getToken();

      const { data } = await api.post(
        `/api/user/profiles`,
        { profileId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (data.success) {
        setUser(data.profile);
        setPosts(data.posts);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    if (profileId) {
      fetchUser(profileId);
    } else {
      fetchUser(currentUser._id);
    }
  }, [profileId, currentUser]);

  return user ? (
    <div className="relative h-full overflow-y-scroll bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 no-scrollbar pb-16">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Cover Photo & User Info Card */}
        <div className="bg-white dark:bg-zinc-900/40 rounded-3xl overflow-hidden shadow-xl border border-slate-200/50 dark:border-zinc-900/40 backdrop-blur-md">
          {/* Cover Photo */}
          <div className="h-40 md:h-52 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 relative">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10"></div>
            {user.cover_photo && (
              <img
                src={user.cover_photo}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>
          
          {/* User Info details */}
          <UserProfileInfo
            user={user}
            posts={posts}
            profileId={profileId}
            setShowEdit={setShowEdit}
          />
        </div>

        {/* Navigation Tabs (Instagram style) */}
        <div className="space-y-6">
          <div className="flex border-b border-slate-200 dark:border-zinc-900 justify-center gap-12">
            {[
              { id: "posts", label: "Posts", icon: Grid },
              { id: "media", label: "Media", icon: ImageIcon }
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isSelected = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3.5 px-4 font-extrabold text-xs transition-all border-b-2 flex items-center gap-2 cursor-pointer uppercase tracking-wider ${
                    isSelected
                      ? "border-indigo-600 dark:border-purple-400 text-indigo-600 dark:text-purple-400"
                      : "border-transparent text-gray-400 dark:text-zinc-550 hover:text-gray-650"
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Posts Tab Content */}
          {activeTab === "posts" && (
            <div className="flex flex-col items-center gap-5">
              {posts.map((post) => (
                <PostCard 
                  key={post._id} 
                  post={post} 
                  onDeletePost={(postId) => setPosts((prev) => prev.filter((p) => p._id !== postId))}
                  onUpdatePost={(updatedPost) => setPosts((prev) => prev.map((p) => p._id === updatedPost._id ? { ...p, ...updatedPost } : p))}
                />
              ))}
              {posts.length === 0 && (
                <div className="bg-zinc-900/10 dark:bg-zinc-900/20 border border-slate-200/40 dark:border-zinc-900/40 rounded-3xl p-12 text-center space-y-3 w-full max-w-xl">
                  <Grid className="w-8 h-8 mx-auto text-zinc-650" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-350">No Posts Yet</h4>
                  <p className="text-slate-500 dark:text-zinc-550 text-[10px] font-semibold max-w-xs mx-auto">Share updates, photos, or thoughts to start posting on feed card grids.</p>
                </div>
              )}
            </div>
          )}

          {/* Media Tab Content */}
          {activeTab === "media" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {posts
                .filter((post) => post.image_urls?.length > 0)
                .map((post) =>
                  post.image_urls.map((image, index) => (
                    <Link
                      target="_blank"
                      to={image}
                      key={`${post._id}-${index}`}
                      className="relative group overflow-hidden rounded-2xl border border-slate-200/60 dark:border-zinc-900/60 aspect-square bg-slate-100 dark:bg-zinc-950 flex items-center justify-center shadow-sm hover:shadow-md hover:scale-[1.01] transition-all"
                    >
                      <img
                        src={image}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                        <span className="text-[10px] font-black uppercase text-white tracking-widest bg-zinc-950/80 px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                          {moment(post.createdAt).fromNow()}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              {posts.filter((post) => post.image_urls?.length > 0).length === 0 && (
                <div className="bg-zinc-900/10 dark:bg-zinc-900/20 border border-slate-200/40 dark:border-zinc-900/40 rounded-3xl p-12 text-center space-y-3 col-span-3">
                  <ImageIcon className="w-8 h-8 mx-auto text-zinc-650" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-350">No Media Yet</h4>
                  <p className="text-slate-500 dark:text-zinc-550 text-[10px] font-semibold max-w-xs mx-auto text-center">Images you attach in feed posts will be showcased here.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      {showEdit && <ProfileModal setShowEdit={setShowEdit} />}
    </div>
  ) : (
    <Loading />
  );
};

export default Profile;
