import React, { useEffect, useState } from 'react'
import { dummyStoriesData } from '../assets/assets';
import { Plus, Sparkles, BookOpen } from 'lucide-react'
import moment from 'moment'
import StoryModal from './StoryModal';
import StoryViewer from './StoryViewer';
import { toast } from 'react-hot-toast'
import api from '../api/axios'
import { useAuth } from '@clerk/clerk-react'

const StoriesBar = () => {
  const [stories, setStories] = useState([]);
  const [showModal, setShowModal] = useState(false)
  const [viewStory, setViewStory] = useState(null)

  const { getToken, userId } = useAuth()

  const fetchStories = async () => {
    try {
      const token = await getToken();
      const { data } = await api.get("/api/story/get", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setStories(data.stories);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const isStoryGroupSeen = (storyGroup) => {
    if (!storyGroup || !storyGroup.stories || storyGroup.stories.length === 0) return true;
    return storyGroup.stories.every(item => item.view_count && item.view_count.includes(userId));
  };

  return (
    <div className='w-full max-w-2xl no-scrollbar overflow-x-auto px-2 sm:px-4'>
      <div className='flex gap-4 pb-3.5 pt-1'>
        
        {/* 1. Add Story Card */}
        <div 
          onClick={() => setShowModal(true)} 
          className='rounded-2xl shadow-sm min-w-[110px] max-w-[130px] h-38 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-2 border-dashed border-indigo-300 dark:border-zinc-800 bg-gradient-to-b from-indigo-50/50 to-white dark:from-zinc-900/30 dark:to-zinc-950/20 flex flex-col items-center justify-center p-3 group shrink-0'
        >
          <div className='w-9 h-9 bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 text-white rounded-full flex items-center justify-center mb-2.5 shadow-md shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-350'>
            <Plus className='w-5 h-5 stroke-[2.5]' />
          </div>
          <p className='text-[10px] uppercase font-black text-slate-700 dark:text-zinc-400 tracking-wider text-center'> Create Story </p>
        </div>

        {/* 2. My Story Card */}
        {stories.map((storyGroup, index) => {
          if (storyGroup.user._id === userId) {
            const userStories = storyGroup.stories;
            const latestStory = userStories[userStories.length - 1]; 
            return (
              <div 
                onClick={() => setViewStory(storyGroup)} 
                key={storyGroup.user._id} 
                className='relative rounded-2xl shadow-md min-w-[110px] max-w-[130px] h-38 cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-br from-indigo-950/80 via-purple-900/40 to-zinc-950 p-3 flex flex-col justify-between shrink-0 overflow-hidden border border-zinc-900 group'
              >
                {/* Media backdrop for My Stories */}
                {latestStory.media_type !== 'text' && (
                  <div className='absolute inset-0 z-0 bg-zinc-950'>
                    {latestStory.media_type === 'image' ? (
                      <img src={latestStory.media_url} alt="" className='h-full w-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500' />
                    ) : (
                      <video src={latestStory.media_url} className='h-full w-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500' />
                    )}
                  </div>
                )}
                
                <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center z-10 ${isStoryGroupSeen(storyGroup) ? 'bg-zinc-800' : 'bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500'} ring-2 ring-zinc-950 shadow`}>
                  <img 
                    src={storyGroup.user.profile_picture || 'https://images.clerk.dev/static/profile.png'} 
                    alt="" 
                    className='w-7.5 h-7.5 rounded-full object-cover border border-zinc-950'
                  />
                </div>

                <div className='z-10 space-y-1 text-left'>
                  <p className='text-white font-extrabold text-[10px] tracking-wide truncate max-w-[90px] drop-shadow-md'> My Stories </p>
                  <p className='text-zinc-300 dark:text-zinc-400 text-[9px] font-semibold drop-shadow-sm'>
                    {moment(latestStory.createdAt).fromNow()}
                  </p>
                </div>
              </div>
            )
          }
          return null
        })}

        {/* 3. Other Story cards */}
        {stories.filter(storyGroup => storyGroup.user._id !== userId).map((storyGroup, index) => {
          const user = storyGroup.user;
          const userStories = storyGroup.stories;
          const latestStory = userStories[userStories.length - 1]; 

          return (
            <div 
              onClick={() => setViewStory(storyGroup)} 
              key={index} 
              className='relative rounded-2xl shadow-md min-w-[110px] max-w-[130px] h-38 cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-gradient-to-br from-zinc-900 via-indigo-950/20 to-zinc-950 p-3 flex flex-col justify-between shrink-0 overflow-hidden border border-zinc-900 group'
            >
              {/* Media backdrop */}
              {latestStory.media_type !== 'text' ? (
                <div className='absolute inset-0 z-0 bg-zinc-950'>
                  {latestStory.media_type === 'image' ? (
                    <img src={latestStory.media_url} alt="" className='h-full w-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-500' />
                  ) : (
                    <video src={latestStory.media_url} className='h-full w-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-500' />
                  )}
                </div>
              ) : (
                <div 
                  className='absolute inset-0 z-0 opacity-40' 
                  style={{ backgroundColor: latestStory.background_color || '#4f46e5' }}
                ></div>
              )}

              <div className={`w-8.5 h-8.5 rounded-full flex items-center justify-center z-10 ${isStoryGroupSeen(storyGroup) ? 'bg-zinc-800' : 'bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500'} ring-2 ring-zinc-950 shadow`}>
                <img 
                  src={user.profile_picture || 'https://images.clerk.dev/static/profile.png'} 
                  alt="" 
                  className='w-7.5 h-7.5 rounded-full object-cover border border-zinc-950'
                />
              </div>

              <div className='z-10 space-y-1 text-left'>
                <p className='text-white font-extrabold text-[10px] tracking-wide truncate max-w-[90px] drop-shadow-md'>
                  {latestStory.media_type === 'text' ? latestStory.content : user.full_name.split(' ')[0]}
                </p>
                 <p className='text-zinc-300 dark:text-zinc-400 text-[9px] font-semibold drop-shadow-sm'>
                  {moment(latestStory.createdAt).fromNow()}
                </p>
              </div>
            </div>
          )
        })}

      </div>

      {/* Story Modals */}
      {showModal && <StoryModal setShowModal={setShowModal} fetchStories={fetchStories} />}
      {viewStory && <StoryViewer viewStory={viewStory} setViewStory={setViewStory} fetchStories={fetchStories} />}

    </div>
  )
}

export default StoriesBar
