import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { USDT } from '../components/USDT';
import { formatUSDT } from '../lib/utils';
import { 
  ShieldAlert, 
  Users, 
  Coins, 
  Search, 
  TrendingDown, 
  TrendingUp, 
  ArrowUpDown, 
  UserCheck, 
  UserMinus, 
  Calendar,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminUserRecord {
  id: string;
  username: string;
  firstName: string;
  photoUrl: string;
  balance: number;
  referralsCount: number;
  createdAt: number;
  miningRate: number;
}

type SortField = 'balance' | 'referrals' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function AdminTab() {
  const { initData, showToast } = useApp();
  const [usersList, setUsersList] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': initData || ''
        }
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied. This page is only for authorized administrators.');
        }
        throw new Error('Failed to retrieve user accounts from server.');
      }
      const data = await res.json();
      if (data.users) {
        setUsersList(data.users);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      showToast(err.message || 'Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Compute overall statistics
  const totalUsers = usersList.length;
  const totalUSDTUnits = usersList.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  const totalReferrals = usersList.reduce((acc, curr) => acc + (curr.referralsCount || 0), 0);

  // Filter and sort user records
  const filteredUsers = usersList
    .filter(u => {
      const q = searchQuery.toLowerCase();
      const matchUsername = (u.username || '').toLowerCase().includes(q);
      const matchFirstName = (u.firstName || '').toLowerCase().includes(q);
      const matchId = (u.id || '').includes(q);
      return matchUsername || matchFirstName || matchId;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'balance') {
        comparison = (a.balance || 0) - (b.balance || 0);
      } else if (sortField === 'referrals') {
        comparison = (a.referralsCount || 0) - (b.referralsCount || 0);
      } else if (sortField === 'createdAt') {
        comparison = (a.createdAt || 0) - (b.createdAt || 0);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F5F7F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="Admin Dashboard" />

      <div className="p-4 space-y-4 pb-24">
        {/* Error Screen */}
        {error ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 border border-rose-100 text-center space-y-4 shadow-sm"
          >
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Restricted Access</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              {error}
            </p>
            <button 
              onClick={fetchUsers}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-5 py-2.5 rounded-xl transition-all"
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          <>
            {/* Elegant Admin Badge */}
            <div className="bg-slate-900 rounded-3xl p-4 text-white relative overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.1)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-[120px] -z-0"></div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="bg-emerald-500 text-slate-900 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                    System Admin Active
                  </span>
                  <h2 className="text-base font-black tracking-tight mt-1.5 flex items-center gap-1.5">
                    Welcome back, Boss <Sparkles className="w-4 h-4 text-emerald-400" />
                  </h2>
                  <p className="text-[10px] text-slate-300 font-medium">
                    Monitor, inspect, and manage active system accounts live.
                  </p>
                </div>
                <button 
                  onClick={fetchUsers}
                  disabled={loading}
                  className="w-10 h-10 bg-white/10 hover:bg-white/15 rounded-2xl flex items-center justify-center text-white transition-all shrink-0 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-3 border border-slate-100 flex flex-col justify-between shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Users</span>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-lg font-black text-slate-900 leading-none">
                    {loading ? '...' : totalUsers}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[8px] text-slate-500 font-bold mt-1">
                  <Users className="w-2.5 h-2.5 text-slate-400" />
                  <span>Verified Accounts</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 border border-slate-100 flex flex-col justify-between shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Vault Sum</span>
                <div className="flex items-baseline gap-1 mt-1.5 text-emerald-600 font-black">
                  <span className="text-sm leading-none">
                    {loading ? '...' : (totalUSDTUnits / 10000).toFixed(2)}
                  </span>
                  <span className="text-[8px] tracking-normal font-bold">USDT</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] text-slate-500 font-bold mt-1">
                  <Coins className="w-2.5 h-2.5 text-emerald-500" />
                  <span>Total Balances</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 border border-slate-100 flex flex-col justify-between shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Invites</span>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-lg font-black text-slate-900 leading-none">
                    {loading ? '...' : totalReferrals}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[8px] text-slate-500 font-bold mt-1">
                  <UserCheck className="w-2.5 h-2.5 text-slate-400" />
                  <span>Net Growth</span>
                </div>
              </div>
            </div>

            {/* Filter Hub */}
            <div className="bg-white rounded-3xl p-4 border border-slate-100 space-y-3 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="text"
                  placeholder="Search by username, ID, or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-150 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Sorting Tabs */}
              <div className="flex items-center justify-between pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Sort List:</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleSort('balance')}
                    className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${sortField === 'balance' ? 'bg-slate-900 border-slate-900 text-white font-black' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <span>USDT</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={() => toggleSort('referrals')}
                    className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${sortField === 'referrals' ? 'bg-slate-900 border-slate-900 text-white font-black' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <span>Invites</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={() => toggleSort('createdAt')}
                    className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${sortField === 'createdAt' ? 'bg-slate-900 border-slate-900 text-white font-black' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    <span>Date</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Users List Container */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                <span>Active Users ({filteredUsers.length})</span>
                {sortField && (
                  <span className="text-slate-500 font-medium lowercase">
                    sorting by {sortField} ({sortOrder})
                  </span>
                )}
              </div>

              {loading ? (
                // Skeletons
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(idx => (
                    <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-150 animate-pulse h-16 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-xl"></div>
                        <div className="space-y-1.5">
                          <div className="h-2.5 bg-slate-100 w-24 rounded-full"></div>
                          <div className="h-2 bg-slate-100 w-16 rounded-full"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-slate-100 w-20 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center text-slate-400 space-y-1 shadow-sm">
                  <p className="text-xs font-bold text-slate-500">No users found matching your search</p>
                  <p className="text-[10px] text-slate-300">Try adjusting your filters or query</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {filteredUsers.map((userRecord, index) => {
                      const avatarLetter = (userRecord.firstName || userRecord.username || 'U')[0].toUpperCase();
                      const hasUsername = !!userRecord.username;
                      
                      return (
                        <motion.div
                          layout
                          key={userRecord.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.4) }}
                          className="bg-white rounded-2xl p-3 border border-slate-100 hover:border-slate-200 transition-colors flex items-center justify-between gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] relative overflow-hidden group"
                        >
                          {/* Left Details */}
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar Display */}
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-50 border border-slate-150 flex items-center justify-center text-slate-700 font-black text-sm shrink-0 shadow-sm relative overflow-hidden group-hover:scale-105 transition-transform">
                              {userRecord.photoUrl ? (
                                <img 
                                  src={userRecord.photoUrl} 
                                  alt={userRecord.firstName} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover" 
                                  onError={(e) => {
                                    (e.target as any).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span>{avatarLetter}</span>
                              )}
                            </div>

                            {/* Usernames */}
                            <div className="min-w-0 space-y-0.5">
                              <h4 className="text-xs font-black text-slate-850 truncate flex items-center gap-1">
                                {userRecord.firstName || 'Anonymous User'}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {hasUsername ? (
                                  <span className="text-[10px] text-emerald-700 font-extrabold lowercase tracking-tight bg-emerald-50/70 border border-emerald-100/40 px-1.5 py-0.5 rounded-md">
                                    @{userRecord.username}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-bold italic bg-slate-50 px-1.5 py-0.5 rounded">
                                    no username
                                  </span>
                                )}
                                <span className="text-[8px] text-slate-350 font-bold flex items-center gap-0.5">
                                  ID: {userRecord.id}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right Stats Column */}
                          <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                            {/* USDT Balance Badge */}
                            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/40 px-2 py-1 rounded-xl">
                              <USDT amount={formatUSDT(userRecord.balance || 0)} size="text-[11px]" iconSize="w-3 h-3" />
                            </div>

                            {/* Referrals & Sign Date */}
                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400">
                              <span className="flex items-center gap-0.5 bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-150">
                                <Users className="w-2.5 h-2.5 text-slate-400" />
                                <span>{userRecord.referralsCount || 0} ref</span>
                              </span>
                              <span className="flex items-center gap-0.5 text-slate-350 font-bold">
                                <Calendar className="w-2.5 h-2.5 text-slate-300" />
                                <span>{formatDate(userRecord.createdAt)}</span>
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
