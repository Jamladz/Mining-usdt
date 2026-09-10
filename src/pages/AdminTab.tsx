import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Users, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface UserData {
  id: string;
  username: string;
  firstName: string;
  balance: number;
  totalWithdrawn: number;
  createdAt: number;
}

interface WithdrawalData {
  id: number;
  userId: string;
  username?: string;
  firstName?: string;
  amount: number;
  walletAddress: string;
  status: string;
  createdAt: number;
  processedAt?: number;
}

export function AdminTab() {
  const { fetchWithAuth } = useApp();
  const [users, setUsers] = useState<UserData[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'users' | 'withdrawals'>('withdrawals');

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, withdrawalsRes] = await Promise.all([
        fetchWithAuth('/api/admin/users'),
        fetchWithAuth('/api/admin/withdrawals')
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
      if (withdrawalsRes.ok) {
        const withData = await withdrawalsRes.json();
        setWithdrawals(withData.withdrawals || []);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: number) => {
    if (!window.confirm('Are you sure you want to approve this withdrawal?')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/withdrawals/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        alert('Withdrawal approved!');
        loadData();
      } else {
        alert('Failed to approve');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm('Are you sure you want to reject this withdrawal and refund the user?')) return;
    try {
      const res = await fetchWithAuth(`/api/admin/withdrawals/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        alert('Withdrawal rejected & refunded!');
        loadData();
      } else {
        alert('Failed to reject');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatUSDT = (units: number) => (units / 10000).toFixed(4);

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-slate-200 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
          <p className="text-sm text-slate-500">Manage withdrawals and users</p>
        </div>
        <button 
          onClick={loadData}
          disabled={loading}
          className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 py-4 gap-2">
        <button
          onClick={() => setActiveView('withdrawals')}
          className={cn(
            "flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-colors",
            activeView === 'withdrawals' ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200"
          )}
        >
          Withdrawals
        </button>
        <button
          onClick={() => setActiveView('users')}
          className={cn(
            "flex-1 py-2 px-4 rounded-xl font-medium text-sm transition-colors",
            activeView === 'users' ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200"
          )}
        >
          Users
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-12">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : activeView === 'withdrawals' ? (
          <div className="space-y-4">
            {withdrawals.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No withdrawals found.</p>
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-slate-900">{formatUSDT(w.amount)} USDT</div>
                      <div className="text-xs text-slate-500 mt-1">User: {w.username || w.firstName || w.userId}</div>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-xs font-medium uppercase tracking-wide",
                      w.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      w.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-rose-100 text-rose-700'
                    )}>
                      {w.status}
                    </div>
                  </div>
                  
                  <div className="text-xs font-mono bg-slate-50 p-2 rounded break-all border border-slate-100">
                    <span className="text-slate-400">Wallet: </span>
                    <span className="text-slate-700">{w.walletAddress}</span>
                  </div>
                  
                  <div className="text-xs text-slate-400">
                    Requested: {new Date(w.createdAt).toLocaleString()}
                  </div>

                  {w.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => handleApprove(w.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button 
                        onClick={() => handleReject(w.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl border border-indigo-100 text-sm font-medium">
              Total Users: {users.length}
            </div>
            {users.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No users found.</p>
            ) : (
              users.map((u) => (
                <div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between">
                    <div className="font-medium text-slate-900">{u.firstName || 'Unknown'}</div>
                    <div className="text-sm text-slate-600 font-mono">@{u.username || 'none'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Balance</div>
                      <div className="text-sm font-medium text-slate-900">{formatUSDT(u.balance)} USDT</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Joined</div>
                      <div className="text-xs text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
