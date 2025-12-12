import React, { useEffect, useState } from 'react'
import { assets, dummyPostsData } from '../assets/assets'
import Loading from '../components/Loading';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import RecentMessages from '../components/RecentMessages';
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import { toast } from 'react-hot-toast'

const Feed = () => { 
   const [feeds,setFeeds] = useState([]); 
   const [loading,setLoading] = useState(false); 

   const { getToken } = useAuth();

  const fetchFeeds = async () => {
    try {
      const token = await getToken();
      const { data } = await api.get("/api/post/feed", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setFeeds(data.posts);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeds();
  }, []);

 
   

  return !loading ? (
    <div className='min-h-screen overflow-y-auto no-scrollbar py-8 px-3 sm:px-4 lg:px-6 xl:grid xl:grid-cols-[minmax(0,1fr)_384px] xl:items-start xl:gap-10'>
      {/* stories and post list */}
      <div className='w-full max-w-5xl mx-auto xl:mx-0'>
        <StoriesBar/>
        <div className='p-2 sm:p-4 space-y-6'> 
          { 
            feeds.map((post) => (
              <PostCard key={post._id} post={post}/>
            ))
          }
        </div> 
      </div> 
      {/* Right-sidebar */} 
      <div className='max-xl:hidden sticky top-0 w-full space-y-4'> 
        <div className='w-full bg-white text-xs p-4 rounded-md inline-flex flex-col gap-2 shadow'> 
         <h3 className='text-slate-800 font-semibold'> Sponsored </h3>  
         <img src={assets.sponsored_img } alt="" className='w-full rounded-md'/> 
         <p className='text-slate-600'> Email marketing </p> 
         <p className='text-slate-400'> Supercharge your marketing with a powerful, easy-to-use platform built for results. </p>
        </div>
         <RecentMessages/>
      </div>

    </div>
  ) 
  : <Loading/>
}

export default Feed
