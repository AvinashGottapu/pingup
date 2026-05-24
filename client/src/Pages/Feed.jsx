import React, { useEffect, useRef, useState } from 'react'
import { assets } from '../assets/assets'
import Loading from '../components/Loading';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import RecentMessages from '../components/RecentMessages';
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import { toast } from 'react-hot-toast'

const Feed = () => {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);

  const { getToken } = useAuth();

  const fetchFeeds = async ({ append = false } = {}) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const token = await getToken();
      const { data } = await api.get("/api/post/feed", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          cursor: append ? nextCursor : undefined,
          limit: 10,
        },
      });

      if (data.success) {
        setFeeds((currentPosts) => append ? [...currentPosts, ...data.posts] : data.posts);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFeeds();
  }, []);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchFeeds({ append: true });
        }
      },
      { rootMargin: '240px' }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, nextCursor]);



  return !loading ? (
    <div className='min-h-screen overflow-y-auto no-scrollbar py-8 px-3 sm:px-4 lg:px-6 xl:grid xl:grid-cols-[minmax(0,1fr)_384px] xl:items-start xl:gap-10'>
      <div className='w-full max-w-5xl mx-auto xl:mx-0'>
        <StoriesBar />
        <div className='p-2 sm:p-4 space-y-6'>
          {feeds.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}

          <div ref={sentinelRef} className='h-6' />

          {loadingMore && (
            <div className='flex justify-center py-2'>
              <div className='w-8 h-8 rounded-full border-3 border-purple-500 border-t-transparent animate-spin' />
            </div>
          )}

          {!hasMore && feeds.length > 0 && (
            <p className='text-center text-sm text-slate-500 dark:text-slate-400 pb-6'>You’re all caught up.</p>
          )}
        </div>
      </div>

      <div className='max-xl:hidden sticky top-0 w-full space-y-4'>
        <div className='w-full bg-white dark:bg-slate-900 text-xs p-4 rounded-md inline-flex flex-col gap-2 shadow'>
          <h3 className='text-slate-800 dark:text-slate-200 font-semibold'> Sponsored </h3>
          <img src={assets.sponsored_img} alt="" className='w-full rounded-md' />
          <p className='text-slate-600 dark:text-slate-400'> Email marketing </p>
          <p className='text-slate-400 dark:text-slate-500'> Supercharge your marketing with a powerful, easy-to-use platform built for results. </p>
        </div>
        <RecentMessages />
      </div>
    </div>
  )
    : <Loading />
}

export default Feed
