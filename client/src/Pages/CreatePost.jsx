import React, { useState } from 'react'
import { Image as ImageIcon, X, Sparkles, Send, Eye, ShieldAlert, BadgeCheck, Heart, MessageCircle, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import PingBuddyModal from '../components/PingBuddyModal'

const CreatePost = () => {
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)

  // PingBuddy modal states
  const [showBuddyModal, setShowBuddyModal] = useState(false)
  const [buddyPrompt, setBuddyPrompt] = useState('')

  const navigate = useNavigate()
  const user = useSelector((state) => state.user.value)
  const { getToken } = useAuth()

  const handleSubmit = async () => {
    if (content.includes('@buddy')) {
      const regex = /@buddy\s*(.*)/i;
      const match = content.match(regex);
      const prompt = match && match[1] ? match[1].trim() : content.replace(/@buddy/g, '').trim();
      setBuddyPrompt(prompt);
      setShowBuddyModal(true);
      return;
    }

    if (!images.length && !content.trim()) {
      return toast.error('Please add at least one image or text')
    }

    setLoading(true)

    const postType =
      images.length && content.trim()
        ? 'text_with_image'
        : images.length
        ? 'image'
        : 'text'

    try {
      const formData = new FormData()
      formData.append('content', content)
      formData.append('post_type', postType)

      images.forEach((image) => formData.append('images', image))

      const token = await getToken()

      const { data } = await api.post('/api/post/add', formData, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (data.success) {
        toast.success('Post created successfully')
        navigate('/')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Pre-process hashtags for preview rendering
  const previewContent = content.replace(
    /(#\w+)/g,
    '<span class="text-indigo-500 dark:text-purple-400 font-extrabold"> $1 </span>'
  );

  return (
    <div className='min-h-screen bg-slate-50 dark:bg-zinc-950 transition-colors duration-300 pb-12'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6'>
        
        {/* Header bar */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div className='text-left'>
            <h1 className='text-2xl font-extrabold text-slate-800 dark:text-zinc-100 font-display'>
              New Post
            </h1>
            <p className='text-slate-500 dark:text-zinc-550 text-xs font-semibold'>
              Publish updates and thoughts to the feed
            </p>
          </div>

          {/* AI Magic Shortcut */}
          <button
            onClick={() => navigate('/photo-magic')}
            className='flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:opacity-95 text-white font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-2xl shadow-md cursor-pointer hover:scale-[1.01] transition-transform active:scale-98'
          >
            <Sparkles className='w-4 h-4' />
            AI Photo Magic
          </button>
        </div>

        {/* Form & Live Preview Grid */}
        <div className='grid md:grid-cols-12 gap-8 items-start'>
          
          {/* Left: Input Form */}
          <div className='md:col-span-7 bg-white dark:bg-zinc-900/40 border border-slate-200/50 dark:border-zinc-900/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 text-left'>
            
            {/* User Row */}
            <div className='flex items-center gap-3'>
              <img
                src={user?.profile_picture || 'https://images.clerk.dev/static/profile.png'}
                alt=''
                className='w-10 h-10 rounded-full border border-slate-100 dark:border-zinc-850 shadow object-cover'
              />
              <div>
                <h2 className='font-extrabold text-xs text-slate-800 dark:text-zinc-200'>
                  {user?.full_name}
                </h2>
                <p className='text-[10px] text-slate-500 dark:text-zinc-500 font-bold'>
                  @{user?.username}
                </p>
              </div>
            </div>

            {/* Input Text */}
            <div className='space-y-1.5 flex flex-col'>
              <div className='flex items-center justify-between'>
                <label className='text-[9px] font-black uppercase text-zinc-500 tracking-wider ml-1'>Caption content</label>
                {content.includes('@buddy') && (
                  <button
                    type="button"
                    onClick={() => {
                      const regex = /@buddy\s*(.*)/i;
                      const match = content.match(regex);
                      const prompt = match && match[1] ? match[1].trim() : content.replace(/@buddy/g, '').trim();
                      setBuddyPrompt(prompt);
                      setShowBuddyModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer shadow hover:scale-[1.01] active:scale-98 animate-pulse border-0"
                  >
                    <Sparkles className="w-3 h-3 text-white" />
                    <span>Let PingBuddy write this post</span>
                  </button>
                )}
              </div>
              <textarea
                className='w-full resize-none min-h-[120px] max-h-32 text-xs sm:text-sm outline-none placeholder-gray-400 dark:placeholder-zinc-650 bg-zinc-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-2xl p-4 text-slate-800 dark:text-zinc-200 focus:border-indigo-500 dark:focus:border-purple-400 transition-colors'
                placeholder="What's on your mind? Share hashtags too!"
                onChange={(e) => setContent(e.target.value)}
                value={content}
              />
            </div>

            {/* Attached Images preview scroll list */}
            {images.length > 0 && (
              <div className='space-y-1.5'>
                <label className='text-[9px] font-black uppercase text-zinc-500 tracking-wider ml-1'>Attached Photos ({images.length})</label>
                <div className='flex flex-wrap gap-2.5 p-2 bg-zinc-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-2xl'>
                  {images.map((image, i) => (
                    <div key={i} className='relative group h-16 w-16 overflow-hidden rounded-xl border border-slate-100 dark:border-zinc-800 shadow-sm shrink-0'>
                      <img
                        src={URL.createObjectURL(image)}
                        alt=''
                        className='h-full w-full object-cover'
                      />
                      <button
                        onClick={() => setImages(images.filter((_, index) => index !== i))}
                        className='absolute inset-0 bg-black/40 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white'
                        title="Remove photo"
                      >
                        <X className='w-5 h-5' />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions row */}
            <div className='flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-zinc-900/40'>
              {/* Photo Input Picker */}
              <label
                htmlFor='images'
                className='flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-850 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition cursor-pointer border border-transparent'
                title="Add Photos"
              >
                <ImageIcon className='w-4.5 h-4.5 text-indigo-500 dark:text-purple-400' />
                <span className='text-[10px] font-black uppercase tracking-wider'>Add Photo</span>
              </label>

              <input
                type='file'
                id='images'
                accept='image/*'
                hidden
                multiple
                onChange={(e) =>
                  setImages([...images, ...Array.from(e.target.files)])
                }
              />

              {/* Submit Share button */}
              <button
                disabled={loading}
                onClick={handleSubmit}
                className='bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:opacity-95 text-white font-black text-[10px] uppercase tracking-wider px-6 py-3 rounded-2xl shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 hover:scale-[1.01] transition-transform'
              >
                {loading ? 'Publishing...' : 'Share Post'} <Send className='w-3.5 h-3.5 -rotate-12' />
              </button>
            </div>
          </div>

          {/* Right: Live Preview Mockup */}
          <div className='md:col-span-5 space-y-3'>
            <div className='flex items-center gap-1.5 px-2 text-zinc-550 text-xs font-bold text-left'>
              <Eye className='w-4 h-4 text-indigo-500 dark:text-purple-400' />
              <span>Live Card Feed Preview</span>
            </div>

            {/* PostCard Mockup */}
            <div className='glass-panel rounded-3xl p-5 space-y-4 w-full border border-slate-200/40 dark:border-zinc-900/40 shadow-xl pointer-events-none opacity-85 scale-[0.98]'>
              {/* Header */}
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <img
                    src={user?.profile_picture || 'https://images.clerk.dev/static/profile.png'}
                    alt=''
                    className='w-10 h-10 rounded-full border border-slate-200 dark:border-zinc-850 shadow object-cover'
                  />
                  <div className='flex flex-col text-left'>
                    <div className='flex items-center space-x-1'>
                      <span className='font-extrabold text-xs text-slate-800 dark:text-zinc-200'>
                        {user?.full_name || 'Your Name'}
                      </span>
                      <BadgeCheck className='w-3.5 h-3.5 text-indigo-500 dark:text-purple-400 fill-indigo-500/10' />
                    </div>
                    <div className='text-zinc-550 text-[10px] font-bold'>
                      @{user?.username || 'your_username'} &middot; Just now
                    </div>
                  </div>
                </div>
              </div>

              {/* Caption */}
              <div className='text-slate-700 dark:text-zinc-300 text-xs sm:text-sm text-left px-1 font-medium leading-relaxed min-h-[40px]'>
                {content ? (
                  <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                ) : (
                  <span className='text-zinc-650 italic'>Post caption draft... Type details in input.</span>
                )}
              </div>

              {/* Images preview inside Mockup */}
              {images.length > 0 && (
                <div className='grid grid-cols-2 gap-2 mt-1'>
                  {images.map((image, idx) => (
                    <div key={idx} className={`overflow-hidden rounded-2xl border border-slate-100 dark:border-zinc-850 shadow-sm ${
                      images.length === 1 ? "col-span-2" : ""
                    }`}>
                      <img
                        src={URL.createObjectURL(image)}
                        alt=""
                        className="w-full h-36 object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Actions footer mock */}
              <div className='flex items-center justify-between pt-3 border-t border-slate-200/50 dark:border-zinc-900/40 text-zinc-500 dark:text-zinc-550 text-xs'>
                <div className='flex items-center gap-4'>
                  <span className='flex items-center gap-1 hover:text-rose-500'><Heart className='w-4.5 h-4.5' /> 0</span>
                  <span className='flex items-center gap-1 hover:text-indigo-500'><MessageCircle className='w-4.5 h-4.5' /> 0</span>
                </div>
                <span className='flex items-center gap-1'><Share2 className='w-4.5 h-4.5' /> Share</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {showBuddyModal && (
        <PingBuddyModal
          initialPrompt={buddyPrompt}
          onClose={() => setShowBuddyModal(false)}
          onInsert={(text) => {
            const cleanContent = content.replace(/@buddy.*/i, '').trim();
            setContent(cleanContent ? cleanContent + "\n\n" + text : text);
            setShowBuddyModal(false);
          }}
        />
      )}
    </div>
  )
}

export default CreatePost