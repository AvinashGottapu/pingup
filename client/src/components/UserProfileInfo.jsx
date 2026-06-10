import { Calendar, MapPin, PenBox, BadgeCheck } from 'lucide-react'
import React from 'react'
import moment from 'moment'

const UserProfileInfo = ({ user, posts, profileId, setShowEdit }) => {
  return (
    <div className='relative py-5 px-6 md:px-8 bg-white dark:bg-zinc-900/60 transition-colors duration-300'>
      <div className='flex flex-col md:flex-row items-start gap-6'>
        
        {/* Profile Avatar Frame (Instagram Style Gradient Border) */}
        <div className='w-28 h-28 sm:w-32 sm:h-32 border-4 border-white dark:border-zinc-950 shadow-xl absolute -top-14 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 p-0.5 shrink-0 z-10'>
          <img 
            src={user.profile_picture || 'https://images.clerk.dev/static/profile.png'} 
            alt={user.full_name} 
            className='w-full h-full rounded-full object-cover border-2 border-white dark:border-zinc-900' 
          />
        </div>

        {/* User Details Area */}
        <div className='w-full pt-16 md:pt-0 md:pl-36 text-left space-y-4'>
          
          {/* Upper Info Row: Name & Edit Actions */}
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div>
              <div className='flex items-center gap-1.5'>
                <h1 className='text-xl font-extrabold text-slate-800 dark:text-zinc-100 font-display'>
                  {user.full_name}
                </h1>
                {user.is_verified && (
                  <BadgeCheck className='w-4.5 h-4.5 text-indigo-500 dark:text-purple-400 fill-indigo-500/10' />
                )}
              </div>
              <p className='text-slate-500 dark:text-zinc-550 text-[10px] font-bold uppercase tracking-wider mt-0.5'>
                {user.username ? `@${user.username}` : 'Add a username'}
              </p>
            </div>
            
            {/* Edit button */}
            {!profileId && (
              <button 
                onClick={() => setShowEdit(true)} 
                className='flex items-center justify-center gap-1.5 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-850 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-colors mt-2 sm:mt-0 cursor-pointer text-slate-600 dark:text-zinc-350 shadow-sm'
              >
                <PenBox className='w-3.5 h-3.5' />
                Edit Profile
              </button>
            )}
          </div>

          {/* Bio Caption */}
          {user.bio ? (
            <p className='text-xs text-slate-700 dark:text-zinc-350 leading-relaxed font-semibold max-w-md'>
              "{user.bio}"
            </p>
          ) : (
            <p className='text-xs text-zinc-400 dark:text-zinc-650 italic'>
              No bio added yet.
            </p>
          )}

          {/* Location / Join Date specs */}
          <div className='flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold text-slate-500 dark:text-zinc-550'>
            <span className='flex items-center gap-1.5'>
              <MapPin className='w-4 h-4 text-indigo-500 dark:text-purple-400' />
              {user.location ? user.location : 'Add location'}
            </span>
            <span className='flex items-center gap-1.5'>
              <Calendar className='w-4 h-4 text-indigo-500 dark:text-purple-400' />
              Joined <span className='text-slate-700 dark:text-zinc-400 font-extrabold'> {moment(user.createdAt).fromNow()} </span>
            </span>
          </div>

          {/* Statistics Grid */}
          <div className='flex items-center justify-center gap-8 pt-4 border-t border-slate-200/50 dark:border-zinc-900/40 w-full'>
            <div className='text-center cursor-default'>
              <span className='text-base font-black text-slate-800 dark:text-zinc-200 block sm:inline leading-none'> {posts.length} </span>
              <span className='text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-550 sm:ml-1.5 tracking-wide'>Posts</span>
            </div>
            <div className='text-center cursor-default'>
              <span className='text-base font-black text-slate-800 dark:text-zinc-200 block sm:inline leading-none'> {user.followers?.length || 0} </span>
              <span className='text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-550 sm:ml-1.5 tracking-wide'>Followers</span>
            </div>
            <div className='text-center cursor-default'>
              <span className='text-base font-black text-slate-800 dark:text-zinc-200 block sm:inline leading-none'> {user.following?.length || 0} </span>
              <span className='text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-550 sm:ml-1.5 tracking-wide'>Following</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default UserProfileInfo
