import React, { useState } from 'react'
import { Image, X, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const CreatePost = () => {
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const user = useSelector((state) => state.user.value)
  const { getToken } = useAuth()

  const handleSubmit = async () => {
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

  return (
    <div className='min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 min-h-screen flex flex-col'>
        {/* Top Section */}
        <div className='w-full mb-6 md:mb-8'>
          <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
            <div className='text-center sm:text-left'>
              <h1 className='text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2'>
                Create Post
              </h1>
              <p className='text-slate-600 dark:text-slate-400'>
                Share your thoughts with the world
              </p>
            </div>

            {/* AI Button */}
            <button
              onClick={() => navigate('/photo-magic')}
              className='w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition text-white font-medium px-4 py-2.5 rounded-xl shadow-md'
            >
              <Sparkles className='w-4 h-4' />
              AI Magic
            </button>
          </div>
        </div>

        {/* Centered Form Area */}
        <div className='flex-1 flex items-start md:items-center justify-center'>
          <div className='w-full max-w-xl bg-white dark:bg-slate-900 p-4 sm:p-8 sm:pb-3 rounded-2xl shadow-md space-y-4 border border-slate-200/70 dark:border-slate-800'>
            {/* Header */}
            <div className='flex items-center gap-3'>
              <img
                src={user?.profile_picture}
                alt=''
                className='w-12 h-12 rounded-full shadow object-cover'
              />
              <div>
                <h2 className='font-semibold dark:text-white'>
                  {user?.full_name}
                </h2>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  @{user?.username}
                </p>
              </div>
            </div>

            {/* Text-area */}
            <textarea
              className='w-full resize-none min-h-[110px] max-h-32 mt-4 text-sm outline-none placeholder-gray-400 dark:placeholder-gray-500 bg-transparent dark:text-white'
              placeholder="What's Happening"
              onChange={(e) => setContent(e.target.value)}
              value={content}
            />

            {/* Images Preview */}
            {images.length > 0 && (
              <div className='flex flex-wrap gap-2 mt-4'>
                {images.map((image, i) => (
                  <div key={i} className='relative group'>
                    <img
                      src={URL.createObjectURL(image)}
                      alt=''
                      className='h-20 w-20 object-cover rounded-md'
                    />
                    <div
                      onClick={() =>
                        setImages(images.filter((_, index) => index !== i))
                      }
                      className='absolute hidden group-hover:flex justify-center items-center top-0 right-0 bottom-0 left-0 bg-black/40 rounded-md cursor-pointer'
                    >
                      <X className='w-6 h-6 text-white' />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom bar */}
            <div className='flex items-center justify-between pt-3 border-t border-gray-300 dark:border-slate-700'>
              <label
                htmlFor='images'
                className='flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer'
              >
                <Image className='size-6 dark:text-gray-50' />
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

              <button
                disabled={loading}
                onClick={handleSubmit}
                className='text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition text-white font-medium px-8 py-2 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading ? 'Publishing...' : 'Publish Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePost