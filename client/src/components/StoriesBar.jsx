import React, { useEffect, useState } from 'react'
import { dummyStoriesData } from '../assets/assets';
import { Plus } from 'lucide-react'
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

  return (
    <div className='w-full max-w-2xl no-scrollbar overflow-x-auto px-2 sm:px-4'>

      <div className='flex gap-4 pb-5'>
        {/* Add story-Cart */}
        <div onClick={() => setShowModal(true)} className='rounded-lg shadow-sm min-w-[120px] max-w-[140px] max-h-40 aspect-[3/4] cursor-pointer hover:shadow:lg transition-all duration-200 border-2 border-dashed border-indigo-300 bg-gradient-to-b from-indigo-50 to-white'>
          <div className='h-full flex flex-col items-center justify-center p-4'>
            <div className='size-10 bg-indigo-500 rounded-full flex items-center justify-center mb-3'>
              <Plus className='w-5 h-5 text-white' />
            </div>
            <p className='text-sm font-medium text-slate-700 text-center'> Create Story </p>
          </div>

        </div>

        {/* My Story Card */}
        {stories.map((storyGroup, index) => {
          if (storyGroup.user._id === userId) {
            const userStories = storyGroup.stories;
            const latestStory = userStories[userStories.length - 1]; // Show latest story preview
            return (
              <div onClick={() => setViewStory(storyGroup)} key={storyGroup.user._id} className={`relative rounded-lg shadow min-w-[120px] max-w-[140px] max-h-40 cursor-pointer 
                   hover:shadow-lg transition-all duration-200 bg-gradient-to-b from-indigo-500 to-purple-600 hover:from-indigo-700  hover:to-purple-700 active:scale-95`}>
                <img src={storyGroup.user.profile_picture} alt="" className='absolute size-8 top-3 left-3 z-10 
                   rounded-full ring ring-gray-100 shadow'/>

                <p className='absolute top-18 left-3 text-white/60 text-sm truncate max-w-24'> My Stories </p>
                <p className='text-white absolute bottom-1 right-2 z-10 text-xs'>
                  {moment(latestStory.createdAt).fromNow()} </p>
             

              </div>
            )
          }
          return null
        })}

        {/* Other Story cards */}
        {
          stories.filter(storyGroup => storyGroup.user._id !== userId).map((storyGroup, index) => {
            const user = storyGroup.user;
            const userStories = storyGroup.stories;
            const latestStory = userStories[userStories.length - 1]; // Show latest story preview

            return (
              <div onClick={() => setViewStory(storyGroup)} key={index} className={`relative rounded-lg shadow min-w-[120px] max-w-[140px] max-h-40 cursor-pointer 
                hover:shadow-lg transition-all duration-200 bg-gradient-to-b from-indigo-500 to-purple-600 hover:from-indigo-700  hover:to-purple-700 active:scale-95`}>
                <img src={user.profile_picture} alt="" className='absolute size-8 top-3 left-3 z-10 
                rounded-full ring ring-gray-100 shadow'/>

                <p className='absolute top-18 left-3 text-white/60 text-sm truncate max-w-24'> {latestStory.content} </p>
                <p className='text-white absolute bottom-1 right-2 z-10 text-xs'>
                  {moment(latestStory.createdAt).fromNow()} </p>
                {
                  latestStory.media_type !== 'text' && (
                    <div className='absolute inset-0 z-1 rounded-lg bg-black overflow-hidden'>
                      {
                        latestStory.media_type === 'image'
                          ? <img src={latestStory.media_url} alt="" className='h-full w-full object-cover hover:scale-110 transition duration-500 opacity-70 hover:opacity-80' />
                          :
                          <video src={latestStory.media_url} className='h-full w-full object-cover hover:scale-110 transition duration-500 opacity-70 hover:opacity-80' />
                      }
                    </div>
                  )
                }

              </div>
            )
          })
        }

      </div>
      {/* Add StoryModal  */}
      {showModal && <StoryModal setShowModal={setShowModal} fetchStories={fetchStories} />}
      {/* View StoryModal */}
      {
        viewStory && <StoryViewer viewStory={viewStory} setViewStory={setViewStory} fetchStories={fetchStories} />
      }

    </div>
  )
}

export default StoriesBar
