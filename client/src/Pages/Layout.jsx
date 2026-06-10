import React, { useState } from 'react'
import SideBar from '../components/SideBar'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, MessageCircle, Search, PlusSquare, Users,User, Bot, Compass, Bell, Send, Sun, Moon } from 'lucide-react'
import Loading from '../components/Loading'
import { useSelector, useDispatch } from 'react-redux'
import { UserButton, useAuth } from '@clerk/clerk-react'
import { assets } from '../assets/assets'
import { updateUser } from '../features/user/userSlice'

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useSelector((state) => state.user.value)        
  const location = useLocation();
  const currentPath = location.pathname;

  const dispatch = useDispatch();
  const { getToken } = useAuth();

  const handleToggleTheme = async () => { 
    const newTheme = user?.theme === 'light' ? 'dark' : 'light';
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
  };

  const mobileNavItems = [
    { to: '/', label: 'Feed', icon: Home },
    { to: '/discover', label: 'Discover', icon: Search },
    { to: '/create-post', label: 'Create', icon: PlusSquare },
    { to: '/messages', label: 'Messages', icon: MessageCircle },
    { to: '/profile', label: 'Profile', icon: User } // custom avatar
  ];

  return user ? (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-zinc-150 transition-colors duration-300 flex flex-col sm:flex-row'>
      
      {/* 1. Desktop Left Sidebar */}
      <SideBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      {/* 2. Mobile Top Header */}
      <header className='sm:hidden fixed top-0 left-0 right-0 h-14 bg-white/85 dark:bg-zinc-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-zinc-900/60 flex items-center justify-between px-4 z-40 shadow-sm'>
        <Link to='/' className='flex items-center gap-2'>
          <img src={assets.logo} alt="Pingup" className="h-7 object-contain" />
        </Link>
        
        <div className='flex items-center gap-2.5'>
          {/* Quick Connections shortcut */}
          <Link to='/connections' className={`p-1.5 rounded-full transition ${currentPath === '/connections' ? 'text-indigo-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <Users className='w-5 h-5' />
          </Link>
          
          {/* Quick AI Buddy shortcut */}
          <Link to='/ai' className={`p-1.5 rounded-full transition ${currentPath === '/ai' ? 'text-indigo-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <Bot className='w-5 h-5' />
          </Link>
          
          {/* Mobile Theme Toggle Button */}
          <button 
            onClick={handleToggleTheme}
            className='p-1.5 rounded-full transition text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-amber-400 cursor-pointer'
            title="Toggle Theme"
          >
            {user.theme === 'light' ? (
              <Moon className='w-5 h-5' />
            ) : (
              <Sun className='w-5 h-5 text-amber-400' />
            )}
          </button>
          
          {/* User Button */}
          <div className='pl-2 border-l border-slate-200 dark:border-zinc-800'>
            <UserButton appearance={{
              elements: {
                avatarBox: 'w-7 h-7 border border-slate-200 dark:border-zinc-800'
              }
            }} />
          </div>
        </div>
      </header>

      {/* 3. Mobile Bottom Sticky Navigation */}
      <nav className='sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-lg border-t border-slate-200 dark:border-zinc-900 z-40 flex items-center justify-around px-2 pb-safe-bottom shadow-lg'>
        {mobileNavItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = item.to === '/' ? currentPath === '/' : currentPath.startsWith(item.to);
          
          return (
            <Link
              key={idx}
              to={item.to}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
                isActive ? 'text-indigo-600 dark:text-purple-400 scale-110' : 'text-gray-400 dark:text-zinc-650 hover:text-gray-600'
              }`}
            >
             
                <Icon className={`w-5.5 h-5.5 ${isActive ? 'stroke-[1.5]' : ''}`} />
              
              {isActive && (
                <div className='w-1 h-1 rounded-full bg-indigo-600 dark:bg-purple-400 mt-1 shadow shadow-indigo-500/50 dark:shadow-purple-400/50'></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 4. Main Page Content View */}
      <div className='flex-grow min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pt-14 pb-16 sm:pt-0 sm:pb-0 sm:pl-60 xl:pl-72 w-full'>
        <Outlet />
      </div>

    </div>
  ) : (
    <Loading />
  )
}

export default Layout;
