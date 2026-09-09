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
          throw new Error('Access denied. This page is only for authorized administrators (sekanedr_is).');
        }
        if (res.status === 401) {
          throw new Error('Authentication failed. Please restart the app from Telegram.');
        }
        const errorText = await res.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server error (${res.status}): ${errorText.substring(0, 100)}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Received non-JSON response:', text);
        if (text.toLowerCase().includes('<!doctype')) {
          throw new Error('The server returned an HTML page instead of data. This usually means the API route was not found or the server crashed.');
        }
        throw new Error(`Unexpected response format: ${contentType || 'unknown'}`);
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
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#0A0B0D] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="إدارة النظام" />

      <div className="p-4 space-y-6 pb-24">
        {/* Error Screen */}
        {error ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#16181D] rounded-[2rem] p-8 border border-red-500/20 text-center space-y-4 shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-white">دخول محدود</h3>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
              {error}
            </p>
            <button 
              onClick={fetchUsers}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-black px-8 py-3 rounded-2xl transition-all active:scale-95"
            >
              إعادة المحاولة
            </button>
          </motion.div>
        ) : (
          <>
            {/* Elegant Admin Badge */}
            <div className="bg-gradient-to-br from-[#1A1C23] to-[#0D0E12] rounded-[2.5rem] p-6 text-white relative overflow-hidden border border-white/5 shadow-2xl">
              <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/5 rounded-bl-full -z-0"></div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-yellow-500 text-[10px] font-black uppercase tracking-widest">
                      لوحة المدير العام
                    </span>
                  </div>
                  <h2 className="text-xl font-black tracking-tight mt-1 flex items-center gap-2">
                    مرحباً بك، أيها القائد <Sparkles className="w-5 h-5 text-yellow-400" />
                  </h2>
                  <p className="text-xs text-gray-400 font-medium">
                    راقب وقم بإدارة حسابات النظام النشطة لحظياً وبدقة.
                  </p>
                </div>
                <button 
                  onClick={fetchUsers}
                  disabled={loading}
                  className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-white transition-all shrink-0 active:scale-95 disabled:opacity-50 border border-white/10"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#16181D] rounded-3xl p-4 border border-white/5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 w-12 h-12 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all"></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">المستخدمين</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-white leading-none tracking-tighter">
                    {loading ? '...' : totalUsers}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold mt-2">
                  <Users className="w-3 h-3 text-blue-500" />
                  <span>حساب موثق</span>
                </div>
              </div>

              <div className="bg-[#16181D] rounded-3xl p-4 border border-white/5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 w-12 h-12 bg-yellow-500/5 rounded-full blur-xl group-hover:bg-yellow-500/10 transition-all"></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">الخزنة</span>
                <div className="flex items-baseline gap-1 mt-2 text-yellow-500 font-black">
                  <span className="text-xl leading-none tracking-tighter">
                    {loading ? '...' : (totalUSDTUnits / 10000).toFixed(2)}
                  </span>
                  <span className="text-[9px] tracking-normal font-bold">USDT</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold mt-2">
                  <Coins className="w-3 h-3 text-yellow-500" />
                  <span>إجمالي الرصيد</span>
                </div>
              </div>

              <div className="bg-[#16181D] rounded-3xl p-4 border border-white/5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 w-12 h-12 bg-green-500/5 rounded-full blur-xl group-hover:bg-green-500/10 transition-all"></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">الإحالات</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-black text-white leading-none tracking-tighter">
                    {loading ? '...' : totalReferrals}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold mt-2">
                  <UserCheck className="w-3 h-3 text-green-500" />
                  <span>صافي النمو</span>
                </div>
              </div>
            </div>

            {/* Filter Hub */}
            <div className="bg-[#16181D] rounded-[2rem] p-5 border border-white/5 space-y-4 shadow-2xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text"
                  placeholder="ابحث بالاسم، المعرف، أو اليوزر..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-5 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50 transition-all"
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                <span>ترتيب حسب:</span>
                <div className="flex items-center gap-2">
                  {[
                    { field: 'balance', label: 'الرصيد' },
                    { field: 'referrals', label: 'الإحالات' },
                    { field: 'createdAt', label: 'التاريخ' }
                  ].map((btn) => (
                    <button 
                      key={btn.field}
                      onClick={() => toggleSort(btn.field as SortField)}
                      className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${sortField === btn.field ? 'bg-yellow-500 border-yellow-500 text-black font-black' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                    >
                      <span>{btn.label}</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Users List Container */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-black text-gray-500 uppercase tracking-widest px-2">
                <span className="flex items-center gap-2">
                  المستخدمين النشطين 
                  <span className="text-yellow-500/50">({filteredUsers.length})</span>
                </span>
                {sortField && (
                  <span className="text-gray-600 font-medium">
                    فرز حسب {sortField === 'balance' ? 'الرصيد' : sortField === 'referrals' ? 'الإحالات' : 'التاريخ'}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(idx => (
                    <div key={idx} className="bg-[#16181D] rounded-3xl p-5 border border-white/5 animate-pulse h-20 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl"></div>
                        <div className="space-y-2">
                          <div className="h-3 bg-white/5 w-32 rounded-full"></div>
                          <div className="h-2 bg-white/5 w-20 rounded-full"></div>
                        </div>
                      </div>
                      <div className="h-8 bg-white/5 w-24 rounded-xl"></div>
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="bg-[#16181D] rounded-[2.5rem] p-12 border border-white/5 text-center space-y-3 shadow-xl">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-600">
                    <UserMinus className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-400">لم يتم العثور على مستخدمين</p>
                    <p className="text-xs text-gray-600">جرب تعديل معايير البحث أو الفلاتر</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filteredUsers.map((userRecord, index) => {
                      const avatarLetter = (userRecord.firstName || userRecord.username || 'U')[0].toUpperCase();
                      const hasUsername = !!userRecord.username;
                      
                      return (
                        <motion.div
                          layout
                          key={userRecord.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.5) }}
                          className="bg-[#16181D] rounded-[2rem] p-4 border border-white/5 hover:border-yellow-500/30 transition-all flex items-center justify-between gap-4 shadow-xl relative overflow-hidden group active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Avatar Display */}
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1E2028] to-[#12141A] border border-white/10 flex items-center justify-center text-gray-300 font-black text-lg shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                              {userRecord.photoUrl ? (
                                <img 
                                  src={userRecord.photoUrl} 
                                  alt={userRecord.firstName} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover rounded-2xl" 
                                  onError={(e) => {
                                    (e.target as any).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span>{avatarLetter}</span>
                              )}
                            </div>

                            {/* User Info */}
                            <div className="min-w-0 space-y-1">
                              <h4 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                                {userRecord.firstName || 'مستخدم مجهول'}
                                {userRecord.balance > 100000 && <Sparkles className="w-3.5 h-3.5 text-yellow-500" />}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2">
                                {hasUsername ? (
                                  <span className="text-[10px] text-yellow-500 font-black tracking-tight bg-yellow-500/5 border border-yellow-500/20 px-2 py-0.5 rounded-lg">
                                    @{userRecord.username}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-gray-600 font-bold italic bg-white/5 px-2 py-0.5 rounded-lg">
                                    بدون يوزر
                                  </span>
                                )}
                                <span className="text-[9px] text-gray-500 font-medium">
                                  ID: {userRecord.id}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Stats Column */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="flex items-center gap-1.5 bg-yellow-500/5 text-yellow-500 border border-yellow-500/10 px-3 py-1.5 rounded-xl shadow-sm group-hover:bg-yellow-500/10 transition-all">
                              <Coins className="w-3.5 h-3.5" />
                              <span className="text-sm font-black tracking-tight">
                                {formatUSDT(userRecord.balance || 0)}
                              </span>
                              <span className="text-[9px] font-bold opacity-70">USDT</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(userRecord.id);
                                  showToast('تم نسخ المعرف بنجاح', 'success');
                                }}
                                className="flex items-center gap-1 text-[8px] bg-white/5 text-gray-500 hover:text-white px-1.5 py-0.5 rounded-md border border-white/5 transition-all"
                              >
                                {userRecord.id}
                              </button>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3 text-gray-600" />
                                  <span>{userRecord.referralsCount || 0} إحالة</span>
                                </span>
                              </div>
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
