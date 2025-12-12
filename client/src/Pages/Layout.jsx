import React , { useState } from 'react'
import SideBar from '../components/SideBar'
import { Outlet } from 'react-router-dom'
import { Menu,X } from 'lucide-react'
import { dummyUserData } from '../assets/assets'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'

const Layout = () => { 
   
    const [sidebarOpen,setSidebarOpen] = useState(false);
    const user = useSelector((state) => state.user.value)         // dummyUserData;

  return user ? (
    <div className='min-h-screen bg-slate-50'>
      <SideBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className='min-h-screen bg-slate-50 sm:pl-60 xl:pl-72'>  
        {/* / → renders Layout first. Inside Layout, React Router finds <Outlet /> */}
          <Outlet/>
          {/* When a child route matches, render it here inside this component */}
      </div>
        {  sidebarOpen 
         ? <X className='fixed top-4 right-4 p-2 z-50 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden' onClick = { () => setSidebarOpen(false) } /> 
         : <Menu className='fixed top-4 right-4 p-2 z-50 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden' onClick = { () => setSidebarOpen(true) } />  } 
    </div>
  ) : (
      <Loading/>
  )
}

export default Layout;
