import React from 'react'
import { assets } from '../assets/assets'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import MenuItems from './MenuItems';
import { CirclePlus, LogOut, Moon, Sun, Compass, Bot } from 'lucide-react';
import { UserButton, useClerk } from '@clerk/clerk-react'
import { useSelector, useDispatch } from 'react-redux';
import { updateUser } from "../features/user/userSlice";
import { useAuth } from '@clerk/clerk-react';

const SideBar = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const user = useSelector((state) => state.user.value)   
  const { signOut } = useClerk();
  const dispatch = useDispatch();
  const { getToken } = useAuth();

  const handleSaveProfile = async () => { 
    const newTheme = user.theme === 'light' ? 'dark' : 'light';
    if (user) {
      try {
        const token = await getToken();
        dispatch(updateUser({
          userData: { theme: newTheme },
          token
        }));
      } catch (error) {
        console.error("Failed to persist theme preference", error);
      }
    }
  }

  return (
    <div className={`w-60 xl:w-72 bg-white/90 dark:bg-zinc-950/80 border-r border-slate-200/50 dark:border-zinc-900/40 flex flex-col justify-between items-center fixed left-0 top-0 bottom-0 z-30 max-sm:-translate-x-full sm:translate-x-0 transition-all duration-300 ease-in-out backdrop-blur-lg`}>
      
      <div className='w-full space-y-6'>
        {/* Branding Logo */}
        <div className='px-7 py-3 flex items-center cursor-pointer' onClick={() => navigate('/')}>
          <img src={assets.logo} alt="Pingup" className='h-8 object-contain' />
        </div>

        <hr className='border-slate-200/50 dark:border-zinc-900/40 mx-6' />
        
        {/* Menu Navigation list */}
        <MenuItems setSidebarOpen={setSidebarOpen} />

        {/* Create Post Button */}
        <Link 
          to='/create-post' 
          className={`flex items-center justify-center gap-2 py-3 mt-6 mx-6 rounded-2xl text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:shadow-lg ${
            currentPath === '/create-post'
              ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 scale-[1.02] font-black'
              : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 opacity-90 hover:opacity-100 hover:scale-[1.01]'
          }`}
        >
          <CirclePlus className='w-4.5 h-4.5 stroke-[2]' />
          Create Post
        </Link>
      </div>

      <div className='w-full space-y-2'>
        {/* Theme Switcher Toggle */}
        <div className='w-full p-4 px-6 flex items-center justify-start cursor-pointer' onClick={handleSaveProfile}>
          <div className='flex gap-3.5 items-center p-2.5 rounded-2xl hover:bg-slate-100/60 dark:hover:bg-zinc-900/50 transition-all w-full border border-transparent hover:border-slate-200/40 dark:hover:border-zinc-800/30'>
            {user.theme === 'light' ? (
              <Moon className='w-5 h-5 text-slate-500 transition-colors' />
            ) : (
              <Sun className='w-5 h-5 text-amber-400 animate-spin-slow' />
            )}
            <span className='font-bold text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider hidden xl:block'>
              {user.theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
        </div>

        {/* Profile Card / User details */}
        <div className='w-full border-t border-slate-200/50 dark:border-zinc-900/40 p-4 px-6 flex items-center justify-between'>
          <div className='flex gap-2.5 items-center cursor-pointer'>
            <UserButton appearance={{
              elements: {
                avatarBox: 'w-9 h-9 border border-slate-200 dark:border-zinc-800'
              }
            }} />
            <div className='hidden xl:block text-left min-w-0'>
              <h1 className='text-xs font-bold dark:text-zinc-200 truncate max-w-[110px]'>{user.full_name}</h1>
              <p className='text-[10px] text-gray-500 dark:text-zinc-500 font-semibold truncate max-w-[110px]'>@{user.username}</p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className='text-slate-400 hover:text-rose-500 dark:text-zinc-550 dark:hover:text-rose-400 transition cursor-pointer p-1.5 rounded-xl hover:bg-rose-500/5 dark:hover:bg-rose-500/10'
            title="Log Out"
          >
            <LogOut className='w-4.5 h-4.5' />
          </button>
        </div>
      </div>

    </div>
  )
}

export default SideBar
