import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Users, CheckCircle, XCircle, Clock, RefreshCw, Search, ArrowLeft, ArrowRight, DollarSign, Wallet, Percent, Tag, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface UserData {
  id: string;
  username?: string;
  firstName?: string;
  balance?: number;
  totalEarned?: number;
  totalWithdrawn?: number;
  miningRate?: number;
  referralsCount?: number;
  lastActive?: any;
}

interface WithdrawalData {
  id: string;
  localId?: number;
  userId: string;
  username?: string;
  firstName?: string;
  amount: number;
  walletAddress: string;
  status: string;
  transactionId?: string;
  createdAt: number;
  processedAt?: number;
}

interface AdminStats {
  totalUsers: number;
  totalBalance: number;
  approvedUSDT: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  rejectedWithdrawals: number;
  totalClaims: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function AdminTab() {
  const { initData } = useApp();
  const [users, setUsers] = useState<UserData[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalData[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'withdrawals' | 'users'>('withdrawals');
  
  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>('all');
  const [usersPage, setUsersPage] = useState(1);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [usersMeta, setUsersMeta] = useState<PaginationMeta | null>(null);
  const [withdrawalsMeta, setWithdrawalsMeta] = useState<PaginationMeta | null>(null);

  // Modal / Transaction input state
  const [approvalModalId, setApprovalModalId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  const fetchWithAuth = (url: string, options: any = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': initData || '',
        ...(options.headers || {})
      }
    });
  };

  const loadStats = async () => {
    try {
      const res = await fetchWithAuth('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Error loading admin stats:', e);
    }
  };

  const loadUsers = async (page: number, search: string) => {
    try {
      const url = `/api/admin/users?page=${page}&limit=10&search=${encodeURIComponent(search)}`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUsersMeta(data.pagination || null);
      }
    } catch (e) {
      console.error('Error loading admin users:', e);
    }
  };

  const loadWithdrawals = async (page: number, status: string, search: string) => {
    try {
      const url = `/api/admin/withdrawals?page=${page}&limit=10&status=${status}&search=${encodeURIComponent(search)}`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
        setWithdrawalsMeta(data.pagination || null);
      }
    } catch (e) {
      console.error('Error loading admin withdrawals:', e);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadStats(),
      activeView === 'users' ? loadUsers(usersPage, searchQuery) : loadWithdrawals(withdrawalsPage, withdrawalStatus, searchQuery)
    ]);
    setLoading(false);
  };

  useEffect(() => {
    if (initData) {
      loadAllData();
    }
  }, [initData, activeView, usersPage, withdrawalsPage, withdrawalStatus]);

  // Handle live search with debounce or button click
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeView === 'users') {
      setUsersPage(1);
      loadUsers(1, searchQuery);
    } else {
      setWithdrawalsPage(1);
      loadWithdrawals(1, withdrawalStatus, searchQuery);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (activeView === 'users') {
      setUsersPage(1);
      loadUsers(1, '');
    } else {
      setWithdrawalsPage(1);
      loadWithdrawals(1, withdrawalStatus, '');
    }
  };

  const triggerApproveModal = (id: string) => {
    setApprovalModalId(id);
    setTransactionId('');
  };

  const handleApprove = async () => {
    if (!approvalModalId) return;
    setProcessingAction(true);
    try {
      const res = await fetchWithAuth(`/api/admin/withdrawals/${approvalModalId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ transactionId })
      });
      if (res.ok) {
        setApprovalModalId(null);
        loadAllData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to approve withdrawal');
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to the server');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this withdrawal and refund the user?')) return;
    setProcessingAction(true);
    try {
      const res = await fetchWithAuth(`/api/admin/withdrawals/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        loadAllData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to reject withdrawal');
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to the server');
    } finally {
      setProcessingAction(false);
    }
  };

  const formatUSDT = (units: number) => (units / 10000).toFixed(2);
  const formatUSDTPrecise = (units: number) => (units / 10000).toFixed(4);

  const getJoinedDate = (u: any) => {
    if (u.createdAt) return new Date(u.createdAt).toLocaleDateString();
    if (u.lastActive && u.lastActive.seconds) return new Date(u.lastActive.seconds * 1000).toLocaleDateString();
    return 'Active Recently';
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] text-slate-900 pb-24 relative overflow-hidden">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">Admin Dashboard</h1>
            <p className="text-[11px] font-bold text-slate-400">Authority management console</p>
          </div>
        </div>
        <button 
          onClick={loadAllData}
          disabled={loading}
          className="p-2 bg-slate-50 text-slate-600 rounded-full hover:bg-slate-100 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Statistics Grid */}
        {stats && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Users</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-slate-800">{stats.totalUsers}</span>
                <span className="text-[10px] font-bold text-slate-400">members</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pool Liquidity</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-emerald-600">{formatUSDT(stats.totalBalance)}</span>
                <span className="text-[10px] font-bold text-emerald-500">USDT</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paid Out</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-slate-800">{formatUSDT(stats.approvedUSDT)}</span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">USDT</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Requests</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-amber-600">{stats.pendingWithdrawals}</span>
                <span className="text-[10px] font-bold text-amber-500">claims</span>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder={activeView === 'users' ? "Search users by name, username, or ID..." : "Search by user ID or wallet address..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
          <button 
            type="submit"
            className="px-4 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors"
          >
            Search
          </button>
        </form>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => { setActiveView('withdrawals'); setSearchQuery(''); }}
            className={cn(
              "flex-1 py-2 rounded-lg font-bold text-xs transition-all",
              activeView === 'withdrawals' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            Payments Requests
          </button>
          <button
            onClick={() => { setActiveView('users'); setSearchQuery(''); }}
            className={cn(
              "flex-1 py-2 rounded-lg font-bold text-xs transition-all",
              activeView === 'users' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            User Base
          </button>
        </div>

        {/* Withdrawal specific Status Tabs */}
        {activeView === 'withdrawals' && (
          <div className="flex gap-1 overflow-x-auto pb-1" dir="ltr">
            {['all', 'pending', 'approved', 'rejected'].map((st) => (
              <button
                key={st}
                onClick={() => { setWithdrawalStatus(st); setWithdrawalsPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold border capitalize transition-colors whitespace-nowrap",
                  withdrawalStatus === st 
                    ? "bg-slate-800 text-white border-slate-800" 
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {/* Data Container */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-500 border-t-transparent"></div>
          </div>
        ) : activeView === 'withdrawals' ? (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400">No payment requests found.</p>
              </div>
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-black text-slate-800">{formatUSDTPrecise(w.amount)} USDT</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5" dir="ltr">
                        {w.firstName ? `${w.firstName} (@${w.username || 'none'})` : `ID: ${w.userId}`}
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide",
                      w.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      w.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      'bg-rose-50 text-rose-600 border border-rose-100'
                    )}>
                      {w.status}
                    </span>
                  </div>
                  
                  <div className="text-[10px] font-mono bg-slate-50 p-2.5 rounded-lg break-all border border-slate-100 flex flex-col gap-1 select-all" dir="ltr">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">DESTINATION WALLET:</span>
                    <span className="text-slate-700 block font-bold leading-normal">{w.walletAddress}</span>
                  </div>

                  {w.transactionId && (
                    <div className="text-[10px] font-mono bg-emerald-50/50 p-2.5 rounded-lg break-all border border-emerald-100 flex flex-col gap-1 select-all" dir="ltr">
                      <span className="text-[9px] font-bold text-emerald-600 block uppercase">TRANSACTION ID (TxID):</span>
                      <span className="text-emerald-800 block font-bold leading-normal">{w.transactionId}</span>
                    </div>
                  )}
                  
                  <div className="text-[9px] font-bold text-slate-400 flex justify-between">
                    <span>Requested: {new Date(w.createdAt).toLocaleString()}</span>
                    {w.processedAt && (
                      <span>Processed: {new Date(w.processedAt).toLocaleString()}</span>
                    )}
                  </div>

                  {w.status === 'pending' && (
                    <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => triggerApproveModal(w.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button 
                        onClick={() => handleReject(w.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Withdrawals Pagination */}
            {withdrawalsMeta && withdrawalsMeta.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={withdrawalsPage <= 1}
                  onClick={() => setWithdrawalsPage(p => Math.max(1, p - 1))}
                  className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-500">
                  Page {withdrawalsMeta.page} of {withdrawalsMeta.totalPages}
                </span>
                <button
                  disabled={withdrawalsPage >= withdrawalsMeta.totalPages}
                  onClick={() => setWithdrawalsPage(p => p + 1)}
                  className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {users.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400">No users found matching query.</p>
              </div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-black text-slate-800">{u.firstName || 'User'}</div>
                      <div className="text-[10px] font-bold text-slate-400 font-mono" dir="ltr">ID: {u.id}</div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-lg",
                      u.username ? "text-emerald-600 bg-emerald-50" : "text-slate-400 bg-slate-100"
                    )} dir="ltr">
                      {u.username ? `@${u.username}` : 'No username'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Wallet Balance</span>
                      <span className="text-xs font-black text-slate-800 block mt-0.5">{u.balance !== undefined ? formatUSDTPrecise(u.balance) : '0.0000'} USDT</span>
                    </div>

                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">USDT Collected</span>
                      <span className="text-xs font-black text-slate-800 block mt-0.5">{u.totalEarned !== undefined ? formatUSDTPrecise(u.totalEarned) : '0.0000'} USDT</span>
                    </div>

                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Active Boost Rate</span>
                      <span className="text-xs font-black text-emerald-600 block mt-0.5">+{u.miningRate ? (u.miningRate / 10000).toFixed(2) : '0.10'}/24h</span>
                    </div>

                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Direct Referrals</span>
                      <span className="text-xs font-black text-slate-800 block mt-0.5">{u.referralsCount || 0} friends</span>
                    </div>

                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Joined Platform</span>
                      <span className="text-xs font-bold text-slate-500 block mt-0.5">{getJoinedDate(u)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Users Pagination */}
            {usersMeta && usersMeta.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={usersPage <= 1}
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-500">
                  Page {usersMeta.page} of {usersMeta.totalPages}
                </span>
                <button
                  disabled={usersPage >= usersMeta.totalPages}
                  onClick={() => setUsersPage(p => p + 1)}
                  className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval Modal for entering blockchain TxID */}
      {approvalModalId && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm border border-slate-100 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-0.5">Approve Settlement</span>
              <h3 className="text-base font-black text-slate-800">Assign Transaction ID</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-1 leading-normal">
                Enter the blockchain TXID or Hash below to notify the recipient that the funds have been settled.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">TxID / Hash (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. 0x98f6d744bfae..."
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                disabled={processingAction}
                onClick={() => setApprovalModalId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={processingAction}
                onClick={handleApprove}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1"
              >
                {processingAction ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>Approve Pay</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
