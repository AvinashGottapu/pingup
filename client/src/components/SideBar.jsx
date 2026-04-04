  import React from 'react'
  import { assets } from '../assets/assets'
  import { Link, useNavigate } from 'react-router-dom'
  import MenuItems from './MenuItems';
  import { CirclePlus, LogOut, Moon, Sun } from 'lucide-react';
  import { UserButton, useClerk } from '@clerk/clerk-react'
  import { useSelector } from 'react-redux';
  import { useDispatch } from 'react-redux';
  import { updateUser } from "../features/user/userSlice";
  import { useAuth } from '@clerk/clerk-react';

  const SideBar = ({ sidebarOpen, setSidebarOpen }) => {

    const navigate = useNavigate();
    const user = useSelector((state) => state.user.value)   // dummyUserData;
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
      <div className={`w-60 xl:w-72 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-gray-700 flex flex-col justify-between items-center fixed left-0 top-0 bottom-0 z-30 ${sidebarOpen ? 'translate-x-0' : 'max-sm:-translate-x-full'} 
        transition-all duration-300 ease-in-out`}>

        <div className='w-full'>
          <img src={assets.logo} onClick={() => navigate('/')} className='w-26 ml-7 my-2 cursor-pointer' alt="" />

          <hr className='border-gray-300 dark:border-gray-700 mb-8' />
          <MenuItems setSidebarOpen={setSidebarOpen} />

          <Link to={'/create-post'} className='flex items-center justify-center gap-2 py-2.5 mt-6 mx-6 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-700 hover:to-purple-800 active: scale-95 transition text-white cursor-pointer' >
            <CirclePlus className='w-5 h-5' />  {/*  GOT THE (+) IMG */}
            Create Post
          </Link>
        </div>
        <div className='w-full'>
          <div className='w-full p-4 px-7 flex items-center justify-start cursor-pointer' onClick={handleSaveProfile}>
            <div className='flex gap-4 items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all w-full'>
              {user.theme === 'light' ? <Moon className='w-6 h-6 text-gray-600 dark:text-gray-300' /> : <Sun className='w-6 h-6 text-yellow-500' />}
              <span className='font-medium text-gray-700 dark:text-gray-200 hidden xl:block'> {user.theme === 'light' ? 'Dark Mode' : 'Light Mode'} </span>
            </div>
          </div>
          <div className='w-full border-t border-gray-200 dark:border-gray-700 p-4 px-7 flex items-center justify-between'>
            <div className='flex gap-2 items-center cursor-pointer'>
              <UserButton />
              <div className='hidden xl:block'>
                <h1 className='text-sm font-medium dark:text-white'>{user.full_name} </h1>
                <p className='text-xs text-gray-500 dark:text-gray-400'> @{user.username} </p>
              </div>
            </div>
            <LogOut onClick={signOut} className='w-4.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer' />
          </div>
        </div>
      </div>
    )
  }

  export default SideBar
