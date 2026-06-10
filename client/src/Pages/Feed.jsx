import React, { useEffect, useRef, useState } from 'react'
import { assets } from '../assets/assets'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import RecentMessages from '../components/RecentMessages';
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import { toast } from 'react-hot-toast'
import { Bot, Users, Sparkles, Compass, Search } from 'lucide-react';

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
    <div className='min-h-screen overflow-y-auto no-scrollbar py-5 px-3 sm:px-4 lg:px-6 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-8'>
      
      {/* Left Column: Feed and stories */}
      <div className='w-full max-w-2xl mx-auto xl:mx-0 space-y-5'>
        {/* Stories bar */}
        <StoriesBar />

        {/* Post cards list */}
        <div className='space-y-5'>
          {feeds.map((post) => (
            <PostCard 
              key={post._id} 
              post={post} 
              onDeletePost={(postId) => setFeeds((prev) => prev.filter((p) => p._id !== postId))}
              onUpdatePost={(updatedPost) => setFeeds((prev) => prev.map((p) => p._id === updatedPost._id ? { ...p, ...updatedPost } : p))}
            />
          ))}

          <div ref={sentinelRef} className='h-4' />

          {loadingMore && (
            <div className='flex justify-center py-2'>
              <div className='w-7 h-7 rounded-full border-2 border-indigo-650 border-t-transparent animate-spin' />
            </div>
          )}

          {!hasMore && feeds.length > 0 && (
            <p className='text-center text-xs text-slate-500 dark:text-zinc-500 font-bold tracking-wide py-4'>You’re all caught up.</p>
          )}
        </div>
      </div>

      {/* Right Column: Sponsored & Recent Chats (desktop only) */}
      <div className='max-xl:hidden sticky top-5 w-full space-y-5'>
        {/* Sponsored card */}
        <div className='w-full bg-white dark:bg-zinc-900/40 text-xs p-4 rounded-3xl inline-flex flex-col gap-2.5 shadow-sm border border-slate-200/50 dark:border-zinc-900/50 backdrop-blur-md'>
          <h3 className='text-slate-800 dark:text-zinc-400 font-extrabold uppercase text-[9px] tracking-widest text-left'> Sponsored </h3>
          <img src={assets.sponsored_img} alt="Sponsored" className='w-full rounded-2xl border border-slate-100 dark:border-zinc-800/40' />
          <div className='text-left'>
            <p className='text-slate-700 dark:text-zinc-350 font-bold text-xs'> Email marketing </p>
            <p className='text-slate-400 dark:text-zinc-500 text-[10px] mt-1 leading-relaxed font-semibold'> Supercharge your marketing with a powerful, easy-to-use platform built for results. </p>
          </div>
        </div>
        
        {/* Recent Message lists */}
        <RecentMessages />
      </div>

    </div>
  ) : (
    <Loading />
  )
}

export default Feed
