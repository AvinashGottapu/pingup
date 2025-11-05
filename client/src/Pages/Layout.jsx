import React , { useState } from 'react'
import SideBar from '../components/SideBar'
import { Outlet } from 'react-router-dom'
import { Menu,X } from 'lucide-react'
import { dummyUserData } from '../assets/assets'
import Loading from '../components/Loading'

const Layout = () => { 
   
    const [sidebarOpen,setSidebarOpen] = useState(false);
    const user = dummyUserData;

  return user ? (
    <div className='w-full flex h-screen'>
      <SideBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className='flex-1 bg-slate-50'>  
        {/* / → renders Layout first. Inside Layout, React Router finds <Outlet /> */}
          <Outlet/>
          {/* When a child route matches, render it here inside this component */}
      </div>
        {  sidebarOpen 
         ? <X className='absolute top-3 right-3 p-2 z-100 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden' onClick = { () => setSidebarOpen(false) } /> 
         : <Menu className='absolute top-3 right-3 p-2 z-100 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden' onClick = { () => setSidebarOpen(true) } />  } 
    </div>
  ) : (
      <Loading/>
  )
}

export default Layout;
