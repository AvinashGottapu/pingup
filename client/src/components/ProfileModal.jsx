import React, { useState } from 'react'
import { dummyUserData } from '../assets/assets' 
import  { Pencil } from 'lucide-react'

const ProfileModal = ({setShowEdit}) => { 
      const user = dummyUserData;
      const [editform,setEditform] = useState({ 
        username : user.username,
        bio : user.bio,
        location : user.location,
        profile_picture : null,
        cover_photo : null,
        full_name : user.full_name,
      })
     
      const handleSaveProfile = async () => {
               e.preventDefault(); 
      }

  return (
    <div className='fixed top-0 bottom-0 left-0 right-0 z-110 h-screen overflow-y-scroll bg-black/50'>
           <div className='max-w-2xl sm:py-6 mx-auto'> 
                <div className='bg-white rounded-lg shadow p-6'>  
                    <h1 className='text-2xl font-bold text-gray-900 mb-6'> Edit Profile </h1>
                      <form className='space-y-4' onSubmit={handleSaveProfile}> 
                         {/* Profile Picture */} 
                         <div className='flex flex-col items-start gap-3'> 
                            <label htmlFor="profile_picture" className='block text-sm font-medium text-gray-700 mb-1'> 
                              Picture Picture 
                              <input hidden type="file" accept='image/*' id='profile_picture' className='w-full p-3 border border-gray-200 rounded-lg' onChange={(e) => setEditform({...editform,profile_picture : e.target.files[0] })}/> 
                                <div className='group/profile relative'> 
                                    <img src={editform.profile_picture ? URL.createObjectURL(editform.profile_picture) : 
                                     user.profile_picture   } alt="" className='w-24 h-24 rounded-full object-cover mt-2'/> 
                                     <div className='absolute hidden group-hover/profile:flex top-0 left-0 right-0 bottom-0 bg-black/20 rounded-full items-center justify-center'> 
                                        <Pencil className='w-5 h-5 text-white'/>
                                     </div>
                                </div>
                            </label> 
                         </div> 
                          {/* Cover Photo */} 
                           
                           <div className='flex flex-col items-start gap-3'> 
                               <label htmlFor="cover_photo" className='block text-sm font-medium text-gray-700 mb-1'>
                                       Cover Photo 
                                       </label>
                                       <input type="file" accept='image/*' id='cover_photo' className='hidden w-full p-3 border border-gray-200 rounded-lg' onChange={(e) => setEditform({...editform, cover_photo : e.target.files[0] })}/> 
                                         <div className='group/cover relative'> 
                                            <img src={editform.cover_photo ? URL.createObjectURL(editform.cover_photo) : 
                                                user.cover_photo } alt="" className='w-80 h-40 rounded-lg bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 object-cover mt-2'/> 
                                                 <div className='absolute hidden group-hover/cover:flex top-0 left-0 right-0 bottom-0 bg-black/20 rounded-lg items-center justify-center'> 
                                                  <Pencil className='w-5 h-5 text-white'/>
                                         </div> 
                                     </div> 
                                     </div>
                                     <div className='block text-sm font-medium tetx-gray-700 mb-1'> 
                                        <label htmlFor=""> 
                                             Name </label>
                                             <input type="text" className='w-full p-3 border border-gray-200 rounded-lg' placeholder='Please enter your full name' onChange={(e) => setEditform({...editform,full_name : e.target.value})} value={editform.full_name}/>
                                     </div>      
                                     <div className='block text-sm font-medium tetx-gray-700 mb-1'> 
                                        <label htmlFor=""> 
                                            Username  </label>
                                             <input type="text" className='w-full p-3 border border-gray-200 rounded-lg' placeholder='Please enter a username' onChange={(e) => setEditform({...editform,username : e.target.value})} value={editform.username}/>
                                     </div>   
                                     <div className='block text-sm font-medium tetx-gray-700 mb-1'> 
                                        <label htmlFor=""> 
                                            Bio  </label>
                                             <textarea rows={3} className='w-full p-3 border border-gray-200 rounded-lg' placeholder='Please enter short bio' onChange={(e) => setEditform({...editform,bio : e.target.value})} value={editform.bio}/>
                                     </div>        
                                       <div className='block text-sm font-medium tetx-gray-700 mb-1'> 
                                        <label htmlFor=""> 
                                            Location </label>
                                             <input type="text" className='w-full p-3 border border-gray-200 rounded-lg' placeholder='Please enter a Location' onChange={(e) => setEditform({...editform,location : e.target.value})} value={editform.location}/>
                                     </div>   

                                     <div className='flex justify-end space-x-3 pt-6'> 
                                        <button onClick={() => setShowEdit(false)} type='button' className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer'> Cancel </button> 
                                        <button type='submit' className='px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hoer:to-purple-700 transition cursor-pointer'> Save Changes  </button>
                                        </div>                                           
                      </form>
                </div>
           </div>
    </div>
  )
}

export default ProfileModal
