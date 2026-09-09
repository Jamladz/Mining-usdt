import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Coins, UserCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface UserRecord {
  id: string;
  username: string;
  firstName: string;
  balance: number;
  referralsCount: number;
  createdAt: number;
}

export function AdminTab() {
  const { user, initData } = useApp();
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.username?.toLowerCase() === 'sekanedr_is';

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': initData || '' }
      });
      
      if (!res.ok) {
        if (res.status === 403) throw new Error('غير مسموح لك بالدخول (sekanedr_is فقط)');
        throw new Error('فشل في جلب البيانات من السيرفر');
      }

      const data = await res.json();
      setUsersList(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 bg-[#0A0B0D]">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold text-white">دخول محدود</h2>
        <p className="text-gray-400">هذه الصفحة مخصصة للمدير (sekanedr_is) فقط.</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0A0B0D] text-white p-4 pb-24 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">لوحة التحكم البسيطة</h1>
        <button 
          onClick={fetchUsers}
          className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-500 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-gray-500 py-10">جاري تحميل قائمة المستخدمين...</p>
        ) : usersList.length === 0 ? (
          <p className="text-center text-gray-500 py-10">لا يوجد بيانات لعرضها.</p>
        ) : (
          usersList.map((u) => (
            <div key={u.id} className="bg-[#16181D] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  {u.firstName || 'مستخدم'} 
                  <span className="text-yellow-500 ml-2">@{u.username || 'بدون_يوزر'}</span>
                </div>
                <div className="text-[10px] text-gray-500">ID: {u.id}</div>
              </div>
              
              <div className="flex items-center gap-4 text-right">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1 text-yellow-500 font-black">
                    <Coins className="w-3 h-3" />
                    <span>{(u.balance / 10000).toFixed(2)}</span>
                  </div>
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">USDT</div>
                </div>

                <div className="flex flex-col items-end border-r border-white/10 pl-4">
                  <div className="flex items-center gap-1 text-blue-500 font-black">
                    <UserCheck className="w-3 h-3" />
                    <span>{u.referralsCount || 0}</span>
                  </div>
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">إحالات</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

