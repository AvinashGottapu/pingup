import React, { useEffect, useState, useCallback } from 'react'
import { BadgeCheck, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../api/axios'
import { useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import toast from 'react-hot-toast'
import moment from 'moment'

const StoryViewer = ({ viewStory, setViewStory, fetchStories }) => {

   // viewStory is now { user: {...}, stories: [...] }
   const [currentIndex, setCurrentIndex] = useState(0)
   const [progress, setProgress] = useState(0)
   const [isDeleting, setIsDeleting] = useState(false)
   const [isPaused, setIsPaused] = useState(false)
   const videoRef = React.useRef(null)
   const clickStartTimeRef = React.useRef(0)

   const currentUser = useSelector((state) => state.user.value)

   const stories = viewStory?.stories || []
   const currentStory = stories[currentIndex]

   // Check ownership against the user of the story group (assumes all stories in group belong to same user)
   const isOwner = viewStory?.user?._id === currentUser?._id

   const { getToken } = useAuth()

   const handleNext = useCallback(() => {
      if (currentIndex < stories.length - 1) {
         setCurrentIndex(prev => prev + 1)
         // Progress reset handled by effect
      } else {
         setViewStory(null)
      }
   }, [currentIndex, stories.length, setViewStory])

   const handlePrev = useCallback(() => {
      if (currentIndex > 0) {
         setCurrentIndex(prev => prev - 1)
         // Progress reset handled by effect
      } else {
         // Option: go to previous user? For now just reset or close if you want
         setProgress(0) // Restart current
      }
   }, [currentIndex])

   // Reset progress when story changes
   useEffect(() => {
      setProgress(0);
   }, [currentIndex, viewStory]); // Reset on story change

   // Timer for progress
   useEffect(() => {
      let progressInterval;

      if (currentStory && currentStory.media_type !== 'video' && !isPaused) {
         const duration = 5000; // 5 seconds per text/image story
         const intervalTime = 100;

         progressInterval = setInterval(() => {
            // Use functional update to avoid stale closure or dependency on 'progress' causing re-renders/resets
            setProgress(prev => {
               const elapsed = (prev / 100) * duration + intervalTime;
               const newProgress = (elapsed / duration) * 100;
               if (newProgress >= 100) {
                  clearInterval(progressInterval)
                  handleNext();
                  return 100;
               }
               return newProgress;
            });
         }, intervalTime);
      }
      return () => {
         clearInterval(progressInterval);
      }
   }, [currentStory, isPaused, handleNext]); // Depend on isPaused

   // Video Play/Pause
   useEffect(() => {
      if (currentStory?.media_type === 'video' && videoRef.current) {
         if (isPaused) {
            videoRef.current.pause();
         } else {
            videoRef.current.play();
         }
      }
   }, [isPaused, currentStory]);


   const handleHoldStart = () => {
      setIsPaused(true);
      clickStartTimeRef.current = Date.now();
   };

   const handleHoldEnd = (action) => {
      setIsPaused(false);
      const duration = Date.now() - clickStartTimeRef.current;
      if (duration < 500) {
         if (action === 'next') handleNext();
         if (action === 'prev') handlePrev();
      }  
   };


   const handleClose = () => {
      setViewStory(null)
   }

   const handleDelete = async () => {
      if (!window.confirm('Are you sure you want to delete this story?')) return;

      setIsDeleting(true);
      try {
         const token = await getToken();
         // Delete specific story segment by ID
         await api.delete(`/api/story/${currentStory._id}`, {
            headers: { Authorization: `Bearer ${token}` },
         });

         toast.success("Story Deleted successfully")

         // Remove from local view
         if (stories.length === 1) {
            // If it was the last story, close viewer
            setViewStory(null);
         } else {
            // Determine new index
            if (currentIndex === stories.length - 1) {
               // If deleting last item, go back one
               setCurrentIndex(prev => prev - 1)
            }
         }
         await fetchStories();
         setViewStory(null); // Force close to avoid sync issues for now

      } catch (error) {
         console.error('Failed to delete story:', error);
         alert('Failed to delete story');
      } finally {
         setIsDeleting(false);
      }
   }


   const renderContent = () => {
      if (!currentStory) return null;

      switch (currentStory.media_type) {
         case 'image': return (
            <img src={currentStory.media_url} alt="" className='max-w-full max-h-screen object-contain' />
         )
         case 'video': return (
            <video
               ref={videoRef}
               src={currentStory.media_url}
               className='max-h-screen'
               onEnded={handleNext} // Auto advance on video end
               // controls // Remove controls to avoid conflict with custom tap/hold, unless user really wants them
               autoPlay
               muted={false}
            />
         )
         case 'text': return (
            <div className='w-full h-full flex items-center justify-center p-8 text-white text-2xl text-center'>
               {currentStory.content}
            </div>
         )
         default: return null;
      }
   }

   if (!viewStory || !currentStory) return null;

   return (
      <div className='fixed inset-0 h-screen bg-black bg-opacity-90 z-[110] flex items-center justify-center'
         style={{ backgroundColor: currentStory.media_type === 'text' ? currentStory.background_color : '#000000' }}>

         {/* Progress Bars Container */}
         <div className='absolute top-0 left-0 w-full flex gap-1 p-2'>
            {stories.map((_, idx) => (
               <div key={idx} className='h-1 flex-1 bg-gray-700 rounded-full overflow-hidden'>
                  <div
                     className={`h-full bg-white transition-all duration-100 ${idx < currentIndex ? 'w-full' : idx === currentIndex ? '' : 'w-0'}`}
                     style={{ width: idx === currentIndex ? `${progress}%` : undefined }}
                  />
               </div>
            ))}
         </div>

         {/* User Info - Top Left */}
         <div className='absolute top-6 left-4 flex items-center space-x-3 p-2 px-4 sm:p-4 sm:px-8 
             backdrop-blur-2xl rounded bg-black/50 z-20'>
            <img src={viewStory.user?.profile_picture} alt="" className='size-7 sm:size-8 rounded-full object-cover border border-white' />
            <div className='text-white font-medium flex items-center gap-1.5'>
               <span>{viewStory.user?.full_name}</span>
               <BadgeCheck size={18} />
               <span className='text-xs text-gray-300 ml-2'>{moment(currentStory.createdAt).fromNow()}</span>
            </div>
         </div>

         {/* Top Right Buttons */}
         <div className='absolute top-6 right-4 flex items-center gap-3 z-20'>
            {/* Delete Button - Only for owner */}
            {isOwner && (
               <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  disabled={isDeleting}
                  className='text-white bg-red-500/80 hover:bg-red-600 p-2 rounded-full transition disabled:opacity-50'
               >
                  <Trash2 className='w-5 h-5' />
               </button>
            )}

            {/* Close Button */}
            <button onClick={handleClose} className='text-white text-3xl font-bold focus:outline-none'>
               <X className='w-8 h-8 hover:scale-110 transition cursor-pointer' />
            </button>
         </div>

         {/* Navigation Hit Areas */}
         <div
            className="absolute inset-y-0 left-0 w-1/3 z-10"
            onMouseDown={handleHoldStart}
            onMouseUp={() => handleHoldEnd('prev')}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={handleHoldStart}
            onTouchEnd={() => handleHoldEnd('prev')}
         ></div>

         <div
            className="absolute inset-y-0 right-0 w-1/3 z-10"
            onMouseDown={handleHoldStart}
            onMouseUp={() => handleHoldEnd('next')}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={handleHoldStart}
            onTouchEnd={() => handleHoldEnd('next')}
         ></div>

         {/* Content Wrapper */}
         <div className='max-w-[90vw] max-h-[90vh] flex items-center justify-center pointer-events-none'>
            {/* Pointer events none for wrapper so clicks go to hit areas, but enable for video controls if needed? 
                  Actually video has controls, so we might need z-index adjustment.
                  Let's keep pointer-events-auto for content so controls work.
              */}
            <div className='pointer-events-auto'>
               {renderContent()}
            </div>
         </div>
      </div>
   )
}

export default StoryViewer
