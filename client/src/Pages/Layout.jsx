import React, { useState } from 'react'
import SideBar from '../components/SideBar'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'

const Layout = () => {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useSelector((state) => state.user.value)        

  return user ? (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300'>
      <SideBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className='min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 sm:pl-60 xl:pl-72'>
        {/* / → renders Layout first. Inside Layout, React Router finds <Outlet /> */}
        <Outlet />
        {/* When a child route matches, render it here inside this component */}
      </div>
      {sidebarOpen
        ? <X className='fixed top-4 right-4 p-2 z-50 bg-white dark:bg-slate-800 rounded-md shadow w-10 h-10 text-gray-600 dark:text-gray-200 sm:hidden' onClick={() => setSidebarOpen(false)} />
        : <Menu className='fixed top-4 right-4 p-2 z-50 bg-white dark:bg-slate-800 rounded-md shadow w-10 h-10 text-gray-600 dark:text-gray-200 sm:hidden' onClick={() => setSidebarOpen(true)} />}
    </div>
  ) : (
    <Loading />
  )
}

export default Layout;
