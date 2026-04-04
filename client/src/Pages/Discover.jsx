import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import UserCard from '../components/UserCard';
import Loading from '../components/Loading';
import { useAuth } from '@clerk/clerk-react';
import { useDispatch } from 'react-redux';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { fetchUser } from '../features/user/userSlice';

const Discover = () => {
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const { getToken } = useAuth();
  const dispatch = useDispatch();

  const handleSearch = async (e) => {
    if (e.key === "Enter") {
      try {
        setLoading(true);
        setUsers([]);

        const token = await getToken();
        const { data } = await api.post("/api/user/discover", { input },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success) {
          setUsers(data.users);
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
        setInput('');
      }
    }
  };

  useEffect(() => {
    getToken().then((token) => dispatch(fetchUser(token)));
  }, [getToken, dispatch]);

  return (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-950'>
      <div className='max-w-6xl mx-auto p-6'>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Connections</h1>
          <p className="text-slate-600 dark:text-slate-400">Connect with amazing people and grow your network</p>
        </div>

        {/* Search */}
        <div className='mb-8 shadow-md rounded-md border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900'>
          <div className='p-6'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5' />
              <input
                type="text"
                placeholder='Search people by name, username, bio or location...'
                className='pl-10 sm:pl-12 py-2 w-full border border-gray-300 dark:border-slate-700 rounded-md max-sm:text-sm dark:bg-slate-800 dark:text-white outline-none'
                onChange={(e) => setInput(e.target.value)}
                value={input}
                onKeyUp={handleSearch}
              />
            </div>
          </div>
        </div>

        {/* Users Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
          {users.map((user) => (
            <UserCard user={user} key={user._id} />
          ))}
        </div>

        {loading && <Loading height='60vh' />}

      </div>
    </div>
  );
};

export default Discover;