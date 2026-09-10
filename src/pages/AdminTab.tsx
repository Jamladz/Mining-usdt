import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Coins, UserCheck, ShieldAlert, RefreshCw, Search, Copy, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Stats {
  totalUsers: number;
  totalUSDT: number;
  totalReferrals: number;
}

interface UserRecord {
  id: string;
  username: string;
  firstName: string;
  balance: number;
  referralsCount: number;
  createdAt: number;
}

export function AdminTab() {
  const { user, initData, showToast } = useApp();
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const isAdmin = user?.username?.toLowerCase() === 'sekanedr_is';

  const fetchUsers = async (isLoadMore = false) => {
    if (!isAdmin) return;
    
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    
    setError(null);
    try {
      const lastId = isLoadMore && usersList.length > 0 ? usersList[usersList.length - 1].id : '';
      const url = new URL('/api/admin/users', window.location.origin);
      url.searchParams.append('search', searchQuery);
      url.searchParams.append('limit', '20');
      if (lastId) url.searchParams.append('lastId', lastId);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': initData || '' }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل في جلب البيانات');
      }

      const data = await res.json();
      if (isLoadMore) {
        setUsersList(prev => [...prev, ...data.users]);
      } else {
        setUsersList(data.users || []);
        setStats(data.stats);
      }
      setHasMore(data.hasMore);
    } catch (err: any) {
      setError(err.message);
      if (showToast) showToast(err.message, 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 bg-[#0A0B0D]">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Admin Dashboard</h2>
        <p className="text-gray-400">This area is restricted to @sekanedr_is</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0A0B0D] text-white p-4 pb-24 overflow-y-auto scroll-smooth">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white">Admin Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
              Live Firestore Monitoring
            </p>
          </div>
        </div>
        <button 
          onClick={() => fetchUsers()}
          disabled={loading}
          className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 text-yellow-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 gap-3 mb-8">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#16181D] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Total Users</div>
            <div className="text-xl font-black text-white">{stats?.totalUsers?.toLocaleString() || '0'}</div>
          </div>
          
          <div className="bg-[#16181D] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center text-center text-yellow-500">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-3">
              <Coins className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Total USDT</div>
            <div className="text-xl font-black mt-0.5">{stats?.totalUSDT?.toFixed(2) || '0.00'}</div>
          </div>

          <div className="bg-[#16181D] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center text-center text-blue-500">
            <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-3">
              <UserCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Referrals</div>
            <div className="text-xl font-black mt-0.5">{stats?.totalReferrals?.toLocaleString() || '0'}</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input 
          type="text"
          placeholder="Search by username or Telegram ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#16181D] border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50 transition-all"
        />
        {searchQuery && (
          <button 
            type="submit"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] bg-yellow-500 text-black px-3 py-1 rounded-lg font-black uppercase"
          >
            Search
          </button>
        )}
      </form>

      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">User List</h3>
        <span className="text-[10px] text-gray-600 font-bold uppercase">{usersList.length} shown</span>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl text-red-500 text-sm mb-6 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p className="font-bold">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {loading && usersList.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <RefreshCw className="w-10 h-10 text-yellow-500 animate-spin mx-auto opacity-50" />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Loading Firestore records...</p>
          </div>
        ) : usersList.length === 0 ? (
          <div className="bg-[#16181D] rounded-[2rem] p-12 border border-white/5 text-center space-y-2">
            <p className="text-gray-400 font-black">No users found</p>
            <p className="text-[10px] text-gray-600 uppercase font-bold">Try a different search term</p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {usersList.map((u, idx) => (
                <motion.div 
                  key={u.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (idx % 10) * 0.05 }}
                  className="bg-[#16181D] border border-white/5 p-4 rounded-3xl flex items-center justify-between group hover:border-yellow-500/30 transition-all shadow-lg"
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-4">
                    <div className="font-black text-sm text-white truncate flex items-center gap-2">
                      <span className="text-yellow-500">@{u.username || 'No username'}</span>
                      <span className="text-gray-500 text-xs font-normal">({u.firstName})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(u.id);
                          if (showToast) showToast('ID Copied: ' + u.id, 'success');
                        }}
                        className="text-[9px] text-gray-600 bg-white/5 px-2 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-all flex items-center gap-1 font-bold"
                      >
                        ID: {u.id}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-black text-white">{(u.balance / 10000).toFixed(2)} USDT</div>
                      <div className="text-[9px] text-gray-500 uppercase font-black tracking-tighter">Collected</div>
                    </div>

                    <div className="text-right border-l border-white/5 pl-6">
                      <div className="text-sm font-black text-blue-500">{u.referralsCount}</div>
                      <div className="text-[9px] text-gray-500 uppercase font-black tracking-tighter">Referrals</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {hasMore && (
              <button 
                onClick={() => fetchUsers(true)}
                disabled={loadingMore}
                className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Load More Users
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

