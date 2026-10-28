import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Globe,
  Users,
  Activity,
  UserPlus,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Copy,
  Check,
  RefreshCw,
  X,
  ArrowUpRight,
  Sparkles,
  Award,
  TrendingUp,
  Layers,
  AlertCircle,
  ClipboardCheck,
  ChevronRight
} from 'lucide-react';
import { cn, formatUSDT } from '../lib/utils';
import { USDT } from './USDT';
import { getAllUsersFromFirebase, syncHistoryToFirebase } from '../lib/firebase';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  initData: string;
  showToast: (message: React.ReactNode, type?: 'success' | 'error' | 'info') => void;
}

type LangCode = 'AR' | 'EN' | 'RU' | 'FA';
type AdminSection = 'overview' | 'withdrawals' | 'users';
type WithdrawalFilter = 'all' | 'pending' | 'completed' | 'rejected' | 'eligible';
type UserFilter = 'active24h' | 'all' | 'topBalance' | 'manualTasks';

export function AdminPanelModal({ isOpen, onClose, initData, showToast }: AdminPanelModalProps) {
  const [activeLang, setActiveLang] = useState<LangCode>('AR');
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [withdrawalFilter, setWithdrawalFilter] = useState<WithdrawalFilter>('all');
  const [userFilter, setUserFilter] = useState<UserFilter>('active24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | string | null>(null);
  const [statsData, setStatsData] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isRTL = activeLang === 'AR' || activeLang === 'FA';

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchAndReconcileAdminData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Firestore users in parallel to ensure zero data loss across container restarts
      setIsSyncingCloud(true);
      let firestoreUsers: any[] = [];
      try {
        firestoreUsers = await getAllUsersFromFirebase();
        if (firestoreUsers.length > 0) {
          await fetch('/api/admin/sync-firestore', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': initData || ''
            },
            body: JSON.stringify({ users: firestoreUsers })
          });
        }
      } catch (syncErr) {
        console.warn('[ADMIN] Cloud reconciliation warning:', syncErr);
      } finally {
        setIsSyncingCloud(false);
      }

      // 2. Fetch comprehensive real-time stats from backend
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': initData || '' }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }
      const backendData = await res.json();

      // 3. Reconcile in-memory with Firestore users in case any user only exists in Firestore
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
      const mergedUsersMap = new Map<string, any>();

      for (const u of backendData.usersList || []) {
        mergedUsersMap.set(u.id.toString(), { ...u });
      }

      const existingWithdrawalKeys = new Set<string>();
      const mergedWithdrawals: any[] = [...(backendData.withdrawals || [])];
      for (const w of mergedWithdrawals) {
        existingWithdrawalKeys.add(`${w.userId}_${w.createdAt}`);
      }

      for (const fUser of firestoreUsers) {
        const uid = (fUser.id || '').toString();
        if (!uid) continue;
        const fLastActive = fUser.lastActiveMs || 0;
        const isFActive24h = fLastActive >= twentyFourHoursAgo;

        if (!mergedUsersMap.has(uid)) {
          mergedUsersMap.set(uid, {
            id: uid,
            username: fUser.username || '',
            firstName: fUser.firstName || 'User',
            photoUrl: fUser.photoUrl || '',
            balance: Number(fUser.balance) || 0,
            totalEarned: Number(fUser.totalEarned) || 0,
            totalWithdrawn: Number(fUser.totalWithdrawn) || 0,
            miningRate: Number(fUser.miningRate) || 100,
            referralsCount: Number(fUser.referralsCount) || 0,
            hasNft: Number(fUser.hasNft) || 0,
            createdAt: fLastActive || now - 48 * 3600 * 1000,
            lastActiveAt: fLastActive,
            isActive24h: isFActive24h
          });
        } else {
          const cur = mergedUsersMap.get(uid)!;
          const bestLastActive = Math.max(cur.lastActiveAt || 0, fLastActive);
          mergedUsersMap.set(uid, {
            ...cur,
            username: cur.username || fUser.username || '',
            firstName: cur.firstName || fUser.firstName || 'User',
            photoUrl: cur.photoUrl || fUser.photoUrl || '',
            balance: Math.max(cur.balance || 0, Number(fUser.balance) || 0),
            totalWithdrawn: Math.max(cur.totalWithdrawn || 0, Number(fUser.totalWithdrawn) || 0),
            referralsCount: Math.max(cur.referralsCount || 0, Number(fUser.referralsCount) || 0),
            hasNft: Math.max(cur.hasNft || 0, Number(fUser.hasNft) || 0),
            lastActiveAt: bestLastActive,
            isActive24h: Boolean(cur.isActive24h || bestLastActive >= twentyFourHoursAgo)
          });
        }

        if (fUser.withdrawalsHistory) {
          try {
            const parsed = typeof fUser.withdrawalsHistory === 'string'
              ? JSON.parse(fUser.withdrawalsHistory)
              : fUser.withdrawalsHistory;
            if (Array.isArray(parsed)) {
              for (const wd of parsed) {
                if (!wd || !wd.amount) continue;
                const key = `${uid}_${wd.createdAt}`;
                if (!existingWithdrawalKeys.has(key)) {
                  existingWithdrawalKeys.add(key);
                  mergedWithdrawals.push({
                    id: wd.id || `fs_${uid}_${wd.createdAt}`,
                    userId: uid,
                    username: fUser.username || '',
                    firstName: fUser.firstName || 'User',
                    photoUrl: fUser.photoUrl || '',
                    userBalance: Number(fUser.balance) || 0,
                    userTotalWithdrawn: Number(fUser.totalWithdrawn) || 0,
                    userReferralsCount: Number(fUser.referralsCount) || 0,
                    userHasNft: Number(fUser.hasNft) || 0,
                    amount: Number(wd.amount) || 0,
                    walletAddress: wd.walletAddress || 'TRC20/BEP20',
                    status: wd.status || 'pending',
                    transactionId: wd.transactionId || null,
                    createdAt: wd.createdAt || now,
                    processedAt: wd.processedAt || null
                  });
                }
              }
            }
          } catch {
            // Ignore malformed JSON
          }
        }
      }

      const allMergedUsers = Array.from(mergedUsersMap.values()).sort(
        (a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0)
      );

      mergedWithdrawals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const finalTotalUsers = Math.max(backendData.totalUsers || 0, allMergedUsers.length);
      const finalActive24h = Math.max(
        backendData.activeUsers24h || 0,
        allMergedUsers.filter((u) => u.isActive24h).length
      );
      const finalNew24h = Math.max(
        backendData.newUsers24h || 0,
        allMergedUsers.filter((u) => (u.createdAt || 0) >= twentyFourHoursAgo).length
      );

      let pendingCount = 0;
      let completedCount = 0;
      let rejectedCount = 0;
      let pendingAmount = 0;
      let completedAmount = 0;
      let totalWdAmount = 0;

      for (const w of mergedWithdrawals) {
        const st = (w.status || 'pending').toLowerCase();
        const amt = Number(w.amount) || 0;
        totalWdAmount += amt;
        if (st === 'completed' || st === 'approved') {
          completedCount++;
          completedAmount += amt;
        } else if (st === 'rejected') {
          rejectedCount++;
        } else {
          pendingCount++;
          pendingAmount += amt;
        }
      }

      setStatsData({
        ...backendData,
        totalUsers: finalTotalUsers,
        activeUsers24h: finalActive24h,
        newUsers24h: finalNew24h,
        usersList: allMergedUsers,
        withdrawals: mergedWithdrawals,
        withdrawalsSummary: {
          totalCount: mergedWithdrawals.length,
          pendingCount,
          completedCount,
          rejectedCount,
          totalAmount: totalWdAmount,
          pendingAmount,
          completedAmount: Math.max(completedAmount, backendData.totalPlatformWithdrawn || 0)
        }
      });
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[ADMIN FETCH ERROR]', err);
      showToast(err.message || 'فشل في جلب إحصائيات لوحة الإدارة', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAndReconcileAdminData();
    }
  }, [isOpen]);

  const handleUpdateWithdrawalStatus = async (
    withdrawal: any,
    newStatus: 'completed' | 'rejected',
    refundBalance: boolean = true
  ) => {
    if (!withdrawal || !withdrawal.id) return;
    setUpdatingId(withdrawal.id);
    try {
      const res = await fetch('/api/admin/withdrawals/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({
          withdrawalId: withdrawal.id,
          status: newStatus,
          refundBalance
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update withdrawal');
      }

      // Sync updated history to Firebase so user sees it immediately across sessions
      if (data.userId && Array.isArray(data.history)) {
        await syncHistoryToFirebase(data.userId, 'withdrawalsHistory', data.history);
      }

      showToast(
        newStatus === 'completed'
          ? '✅ تم اعتماد وإتمام عملية السحب بنجاح'
          : '❌ تم رفض طلب السحب وإرجاع الرصيد للمستخدم',
        'success'
      );
      await fetchAndReconcileAdminData();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء تحديث حالة السحب', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReviewManualTask = async (submissionId: number, status: 'approved' | 'rejected') => {
    setUpdatingId(`task_${submissionId}`);
    try {
      const res = await fetch('/api/admin/tasks/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({ submissionId, status })
      });
      if (!res.ok) throw new Error('Failed to update task');
      showToast(
        status === 'approved' ? '✅ تم قبول المهمة ومنح المكافأة (1 USDT)' : '❌ تم رفض المهمة',
        'success'
      );
      await fetchAndReconcileAdminData();
    } catch (err: any) {
      showToast(err.message || 'خطأ في تحديث المهمة', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatRelativeTime = (timestampMs: number) => {
    if (!timestampMs || timestampMs <= 0) {
      return activeLang === 'AR' ? 'غير معروف' : 'Unknown';
    }
    const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
    if (diffSec < 60) return activeLang === 'AR' ? 'الآن (نشط)' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return activeLang === 'AR' ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return activeLang === 'AR' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return activeLang === 'AR' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  };

  const eligibleUsers = useMemo(() => {
    if (!statsData?.usersList) return [];
    return statsData.usersList.filter(
      (u: any) =>
        (u.balance || 0) >= 60000 ||
        (u.totalWithdrawn || 0) > 0 ||
        ((u.referralsCount || 0) >= 3 && (u.hasNft || 0) >= 1)
    );
  }, [statsData]);

  const filteredWithdrawals = useMemo(() => {
    if (!statsData?.withdrawals) return [];
    const q = searchQuery.trim().toLowerCase();
    return statsData.withdrawals.filter((w: any) => {
      const status = (w.status || 'pending').toLowerCase();
      if (withdrawalFilter === 'pending' && status !== 'pending') return false;
      if (withdrawalFilter === 'completed' && status !== 'completed' && status !== 'approved') return false;
      if (withdrawalFilter === 'rejected' && status !== 'rejected') return false;

      if (!q) return true;
      return (
        (w.username || '').toLowerCase().includes(q) ||
        (w.firstName || '').toLowerCase().includes(q) ||
        (w.userId || '').toString().toLowerCase().includes(q) ||
        (w.walletAddress || '').toLowerCase().includes(q)
      );
    });
  }, [statsData, withdrawalFilter, searchQuery]);

  const filteredUsers = useMemo(() => {
    if (!statsData?.usersList) return [];
    const q = searchQuery.trim().toLowerCase();
    let list = [...statsData.usersList];

    if (userFilter === 'active24h') {
      list = list.filter((u: any) => u.isActive24h);
    } else if (userFilter === 'topBalance') {
      list.sort((a: any, b: any) => (b.balance || 0) - (a.balance || 0));
    }

    if (!q) return list;
    return list.filter(
      (u: any) =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.firstName || '').toLowerCase().includes(q) ||
        (u.id || '').toString().toLowerCase().includes(q)
    );
  }, [statsData, userFilter, searchQuery]);

  const activeRatePercent = useMemo(() => {
    if (!statsData || !statsData.totalUsers) return 0;
    return Math.min(100, Math.round((statsData.activeUsers24h / statsData.totalUsers) * 100));
  }, [statsData]);

  const pendingManualTasksCount = useMemo(() => {
    if (!statsData?.manualTasks) return 0;
    return statsData.manualTasks.filter((t: any) => t.status === 'pending').length;
  }, [statsData]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
          />

          {/* Main Dashboard Container */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="relative bg-[#F8FAFC] rounded-t-[32px] sm:rounded-[32px] max-w-md w-full h-[92vh] sm:h-[88vh] overflow-hidden border border-slate-200/80 shadow-[0_25px_70px_rgba(0,0,0,0.35)] flex flex-col z-10 text-slate-900"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Top Dark Executive Header */}
            <div className="bg-slate-900 text-white px-5 pt-4 pb-3.5 shrink-0 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

              {/* Grab bar for mobile */}
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

              <div className="flex items-center justify-between gap-2 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
                    <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-black tracking-tight text-white">
                        {activeLang === 'AR' && 'لوحة التحكم التنفيذية'}
                        {activeLang === 'EN' && 'Executive Admin Center'}
                        {activeLang === 'RU' && 'Панель Администратора'}
                        {activeLang === 'FA' && 'پنل مدیریت اجرایی'}
                      </h3>
                      <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        LIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1.5">
                      <span>@sekanedr_is</span>
                      {lastUpdated && (
                        <>
                          <span>•</span>
                          <span>
                            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={fetchAndReconcileAdminData}
                    disabled={isLoading}
                    title="Refresh Real Data"
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', (isLoading || isSyncingCloud) && 'animate-spin text-amber-400')} />
                  </button>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Language Switcher + Navigation Tabs */}
              <div className="mt-3.5 flex items-center justify-between gap-2 relative z-10">
                {/* Main Section Tabs */}
                <div className="flex-1 bg-slate-800/90 p-1 rounded-xl flex gap-1 border border-slate-700/70">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1',
                      activeSection === 'overview'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    )}
                  >
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>{activeLang === 'AR' ? 'الإحصائيات' : activeLang === 'RU' ? 'Обзор' : activeLang === 'FA' ? 'آمار' : 'Overview'}</span>
                  </button>

                  <button
                    onClick={() => setActiveSection('withdrawals')}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 relative',
                      activeSection === 'withdrawals'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    )}
                  >
                    <Wallet className="w-3 h-3 shrink-0" />
                    <span>{activeLang === 'AR' ? 'السحوبات' : activeLang === 'RU' ? 'Выплаты' : activeLang === 'FA' ? 'برداشت‌ها' : 'Withdrawals'}</span>
                    {(statsData?.withdrawalsSummary?.pendingCount || 0) > 0 && (
                      <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full">
                        {statsData.withdrawalsSummary.pendingCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveSection('users')}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 relative',
                      activeSection === 'users'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    )}
                  >
                    <Users className="w-3 h-3 shrink-0" />
                    <span>{activeLang === 'AR' ? 'المستخدمين' : activeLang === 'RU' ? 'Юзеры' : activeLang === 'FA' ? 'کاربران' : 'Users'}</span>
                    {pendingManualTasksCount > 0 && (
                      <span className="bg-indigo-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full">
                        {pendingManualTasksCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Compact Lang Selector */}
                <div className="bg-slate-800/90 p-1 rounded-xl flex gap-0.5 border border-slate-700/70 shrink-0">
                  {(['AR', 'EN'] as LangCode[]).map((code) => (
                    <button
                      key={code}
                      onClick={() => setActiveLang(code)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-[9px] font-black transition-all',
                        activeLang === code ? 'bg-slate-700 text-amber-400' : 'text-slate-400 hover:text-white'
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
              {isLoading && !statsData ? (
                <div className="h-72 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">
                      {activeLang === 'AR'
                        ? 'جاري جلب ومزامنة البيانات الحقيقية...'
                        : 'Synchronizing live database & cloud records...'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">
                      {activeLang === 'AR'
                        ? 'يتم فحص المستخدمين النشطين (24س) وسجل السحوبات'
                        : 'Checking 24h active users & withdrawal ledger'}
                    </p>
                  </div>
                </div>
              ) : statsData ? (
                <>
                  {/* ==================== TAB 1: OVERVIEW ==================== */}
                  {activeSection === 'overview' && (
                    <div className="space-y-4">
                      {/* Top 2 Hero Cards: Total Users & Active 24h */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Card 1: Total Users */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative overflow-hidden">
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                              <Users className="w-4 h-4" />
                            </div>
                            <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                              +{statsData.newUsers24h}{' '}
                              {activeLang === 'AR' ? 'اليوم' : 'today'}
                            </span>
                          </div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            {activeLang === 'AR' ? 'العدد الكلي للمستخدمين' : 'Total Registered Users'}
                          </p>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                              {(statsData.totalUsers || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {activeLang === 'AR' ? 'مستخدم' : 'users'}
                            </span>
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-bold text-slate-500">
                            <span>{activeLang === 'AR' ? 'منضمون آخر 24س:' : 'Joined 24h:'}</span>
                            <span className="font-black text-indigo-600 font-mono">{statsData.newUsers24h}</span>
                          </div>
                        </div>

                        {/* Card 2: Active Users 24h */}
                        <div
                          onClick={() => {
                            setActiveSection('users');
                            setUserFilter('active24h');
                          }}
                          className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-md shadow-emerald-600/15 relative overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white relative">
                              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-300 rounded-full animate-ping" />
                              <Activity className="w-4 h-4" />
                            </div>
                            <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">
                              {activeRatePercent}% {activeLang === 'AR' ? 'نشاط' : 'Active'}
                            </span>
                          </div>
                          <p className="text-[10px] font-extrabold text-emerald-100 uppercase tracking-wider">
                            {activeLang === 'AR' ? 'النشطون خلال 24 ساعة' : 'Active Users (24h)'}
                          </p>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-white font-mono tracking-tight">
                              {(statsData.activeUsers24h || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-100">
                              {activeLang === 'AR' ? 'نشط فعلياً' : 'online/24h'}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="mt-2.5 pt-2 border-t border-white/15">
                            <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-300 rounded-full transition-all duration-700"
                                style={{ width: `${Math.max(6, activeRatePercent)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Comprehensive Withdrawals Executive Box */}
                      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                              <Wallet className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900">
                                {activeLang === 'AR' ? 'ملخص سحوبات المستخدمين' : 'User Withdrawals Overview'}
                              </h4>
                              <p className="text-[9px] font-bold text-slate-400">
                                {activeLang === 'AR'
                                  ? 'إحصائيات حقيقية لطلبات السحب والأرصدة المؤهلة'
                                  : 'Real withdrawal requests & eligible balances'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveSection('withdrawals')}
                            className="text-[10px] font-black text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200/60 flex items-center gap-1 transition-colors"
                          >
                            <span>{activeLang === 'AR' ? 'إدارة السحوبات' : 'Manage'}</span>
                            <ChevronRight className={cn('w-3 h-3', isRTL && 'rotate-180')} />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div
                            onClick={() => {
                              setActiveSection('withdrawals');
                              setWithdrawalFilter('pending');
                            }}
                            className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 cursor-pointer hover:bg-amber-50 transition-colors"
                          >
                            <span className="text-[9px] font-extrabold text-amber-800 block">
                              {activeLang === 'AR' ? 'قيد الانتظار' : 'Pending'}
                            </span>
                            <span className="text-base font-black text-amber-700 font-mono">
                              {statsData.withdrawalsSummary?.pendingCount || 0}
                            </span>
                            <div className="text-[9px] font-black text-amber-900/80 mt-0.5 truncate">
                              {formatUSDT(statsData.withdrawalsSummary?.pendingAmount || 0)} USDT
                            </div>
                          </div>

                          <div
                            onClick={() => {
                              setActiveSection('withdrawals');
                              setWithdrawalFilter('completed');
                            }}
                            className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-2.5 cursor-pointer hover:bg-emerald-50 transition-colors"
                          >
                            <span className="text-[9px] font-extrabold text-emerald-800 block">
                              {activeLang === 'AR' ? 'المكتملة' : 'Completed'}
                            </span>
                            <span className="text-base font-black text-emerald-700 font-mono">
                              {statsData.withdrawalsSummary?.completedCount || 0}
                            </span>
                            <div className="text-[9px] font-black text-emerald-900/80 mt-0.5 truncate">
                              {formatUSDT(statsData.withdrawalsSummary?.completedAmount || 0)} USDT
                            </div>
                          </div>

                          <div
                            onClick={() => {
                              setActiveSection('withdrawals');
                              setWithdrawalFilter('eligible');
                            }}
                            className="bg-indigo-50/70 border border-indigo-200/60 rounded-xl p-2.5 cursor-pointer hover:bg-indigo-50 transition-colors"
                          >
                            <span className="text-[9px] font-extrabold text-indigo-800 block">
                              {activeLang === 'AR' ? 'مؤهلون للسحب' : 'Eligible Users'}
                            </span>
                            <span className="text-base font-black text-indigo-700 font-mono">
                              {eligibleUsers.length}
                            </span>
                            <div className="text-[9px] font-bold text-indigo-900/70 mt-0.5 truncate">
                              {activeLang === 'AR' ? '≥ 6 USDT أو NFT' : '≥ 6 USDT / NFT'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Platform Economy & Verification Metrics */}
                      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-2.5">
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {activeLang === 'AR' ? 'تفاصيل المنصة والاقتصاد' : 'Platform Economy & Verification'}
                          </span>
                        </h4>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block">
                                {activeLang === 'AR' ? 'إجمالي أرصدة المستخدمين' : 'Total User Balances'}
                              </span>
                              <span className="text-xs font-black text-slate-900 font-mono">
                                {formatUSDT(statsData.totalPlatformBalance || 0)} USDT
                              </span>
                            </div>
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block">
                                {activeLang === 'AR' ? 'مالكو بطاقات NFT' : 'NFT Holders'}
                              </span>
                              <span className="text-xs font-black text-indigo-600 font-mono">
                                {statsData.nftOwnersCount || 0}{' '}
                                <span className="text-[9px] text-slate-400 font-normal">
                                  (L1:{statsData.nftLvl1Count || 0} / L2:{statsData.nftLvl2Count || 0})
                                </span>
                              </span>
                            </div>
                            <Award className="w-4 h-4 text-indigo-500 shrink-0" />
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block">
                                {activeLang === 'AR' ? 'حققوا شرط 3 إحالات' : '3+ Referrals Met'}
                              </span>
                              <span className="text-xs font-black text-emerald-600 font-mono">
                                {statsData.verifiedReferrersCount || 0}{' '}
                                <span className="text-[9px] text-slate-400 font-normal">
                                  ({activeLang === 'AR' ? 'إجمالي الإحالات:' : 'Refs:'} {statsData.totalReferralsSum || 0})
                                </span>
                              </span>
                            </div>
                            <UserPlus className="w-4 h-4 text-emerald-500 shrink-0" />
                          </div>

                          <div
                            onClick={() => {
                              setActiveSection('users');
                              setUserFilter('manualTasks');
                            }}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block">
                                {activeLang === 'AR' ? 'مهام Baat للمراجعة' : 'Pending Manual Tasks'}
                              </span>
                              <span className="text-xs font-black text-amber-600 font-mono">
                                {pendingManualTasksCount}{' '}
                                <span className="text-[9px] text-slate-400 font-normal">
                                  {activeLang === 'AR' ? 'طلب' : 'pending'}
                                </span>
                              </span>
                            </div>
                            <ClipboardCheck className="w-4 h-4 text-amber-500 shrink-0" />
                          </div>
                        </div>
                      </div>

                      {/* Quick Preview of Latest Active Users (24h) */}
                      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>
                              {activeLang === 'AR'
                                ? 'أحدث المستخدمين النشطين (آخر 24 ساعة)'
                                : 'Recently Active Users (Last 24h)'}
                            </span>
                          </h4>
                          <button
                            onClick={() => {
                              setActiveSection('users');
                              setUserFilter('active24h');
                            }}
                            className="text-[10px] font-black text-indigo-600 hover:underline"
                          >
                            {activeLang === 'AR' ? 'عرض الكل' : 'View All'}
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(statsData.usersList || [])
                            .filter((u: any) => u.isActive24h)
                            .slice(0, 5)
                            .map((u: any) => (
                              <div
                                key={u.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-black text-[10px] text-slate-700 relative">
                                    {u.photoUrl ? (
                                      <img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      (u.firstName || u.username || 'U').slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <p className="text-[11px] font-black text-slate-900 truncate">
                                        {u.firstName || 'User'}
                                      </p>
                                      {u.username && (
                                        <span className="text-[9px] font-bold text-slate-400 truncate" dir="ltr">
                                          @{u.username}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[9px] font-bold text-emerald-600">
                                      {formatRelativeTime(u.lastActiveAt)} • ID: {u.id}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0" dir="ltr">
                                  <span className="text-[11px] font-black text-slate-900 block font-mono">
                                    {formatUSDT(u.balance || 0)} USDT
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400">
                                    Refs: {u.referralsCount || 0} | NFT: {u.hasNft || 0}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==================== TAB 2: USER WITHDRAWALS ==================== */}
                  {activeSection === 'withdrawals' && (
                    <div className="space-y-3.5">
                      {/* Filter Pills */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {[
                          {
                            id: 'all',
                            label: activeLang === 'AR' ? 'الكل' : 'All',
                            count: statsData.withdrawalsSummary?.totalCount || 0
                          },
                          {
                            id: 'pending',
                            label: activeLang === 'AR' ? 'قيد الانتظار' : 'Pending',
                            count: statsData.withdrawalsSummary?.pendingCount || 0
                          },
                          {
                            id: 'completed',
                            label: activeLang === 'AR' ? 'مكتملة' : 'Completed',
                            count: statsData.withdrawalsSummary?.completedCount || 0
                          },
                          {
                            id: 'rejected',
                            label: activeLang === 'AR' ? 'مرفوضة' : 'Rejected',
                            count: statsData.withdrawalsSummary?.rejectedCount || 0
                          },
                          {
                            id: 'eligible',
                            label: activeLang === 'AR' ? 'مؤهلون للسحب' : 'Eligible Users',
                            count: eligibleUsers.length
                          }
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setWithdrawalFilter(tab.id as WithdrawalFilter)}
                            className={cn(
                              'px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-1.5 border',
                              withdrawalFilter === tab.id
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            )}
                          >
                            <span>{tab.label}</span>
                            <span
                              className={cn(
                                'px-1.5 py-0.2 rounded-full text-[8px] font-mono',
                                withdrawalFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {tab.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Search Box */}
                      <div className="relative">
                        <Search
                          className={cn(
                            'w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2',
                            isRTL ? 'right-3.5' : 'left-3.5'
                          )}
                        />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={
                            activeLang === 'AR'
                              ? 'ابحث باسم المستخدم، المعرف ID، أو عنوان المحفظة...'
                              : 'Search by username, ID, or wallet address...'
                          }
                          className={cn(
                            'w-full bg-white border border-slate-200 rounded-xl py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900',
                            isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
                          )}
                        />
                      </div>

                      {/* Eligible Users Sub-view */}
                      {withdrawalFilter === 'eligible' ? (
                        <div className="space-y-2.5">
                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-[10px] font-bold text-indigo-900">
                            {activeLang === 'AR'
                              ? 'هذه القائمة تعرض المستخدمين الذين وصل رصيدهم إلى الحد الأدنى للسحب (6 USDT+) أو استوفوا شروط الإحالات و NFT.'
                              : 'Users who reached the minimum withdrawal threshold (6+ USDT) or met NFT + referral requirements.'}
                          </div>

                          {eligibleUsers.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/70">
                              <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-xs font-black text-slate-500">
                                {activeLang === 'AR'
                                  ? 'لا يوجد مستخدمون مؤهلون للسحب حالياً'
                                  : 'No users have reached withdrawal eligibility yet'}
                              </p>
                            </div>
                          ) : (
                            eligibleUsers.map((u: any) => (
                              <div
                                key={u.id}
                                className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm space-y-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center overflow-hidden shrink-0">
                                      {u.photoUrl ? (
                                        <img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        (u.firstName || u.username || 'U').slice(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-900 truncate">
                                        {u.firstName || 'User'}{' '}
                                        {u.username && (
                                          <span className="text-[10px] font-bold text-slate-400" dir="ltr">
                                            (@{u.username})
                                          </span>
                                        )}
                                      </p>
                                      <button
                                        onClick={() => copyToClipboard(u.id, `uid_${u.id}`)}
                                        className="text-[9px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1"
                                      >
                                        <span>ID: {u.id}</span>
                                        {copiedId === `uid_${u.id}` ? (
                                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-2.5 h-2.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="text-right" dir="ltr">
                                    <span className="text-sm font-black text-emerald-600 font-mono block">
                                      {formatUSDT(u.balance || 0)} USDT
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400">
                                      Withdrawn: {formatUSDT(u.totalWithdrawn || 0)} USDT
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[9px] font-black">
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-md',
                                      (u.referralsCount || 0) >= 3
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-700'
                                    )}
                                  >
                                    {activeLang === 'AR' ? 'الإحالات:' : 'Refs:'} {u.referralsCount || 0}/3
                                  </span>
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-md',
                                      (u.hasNft || 0) >= 1
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'bg-slate-100 text-slate-500'
                                    )}
                                  >
                                    NFT: {(u.hasNft || 0) >= 1 ? `Level ${u.hasNft}` : activeLang === 'AR' ? 'لا يوجد' : 'None'}
                                  </span>
                                  <span className="text-slate-400">{formatRelativeTime(u.lastActiveAt)}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        /* Standard Withdrawal Requests List */
                        <div className="space-y-2.5">
                          {filteredWithdrawals.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/70 space-y-2">
                              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
                                <Wallet className="w-6 h-6" />
                              </div>
                              <p className="text-xs font-black text-slate-600">
                                {activeLang === 'AR'
                                  ? 'لا توجد طلبات سحب في هذا القسم حالياً'
                                  : 'No withdrawal requests matching this filter'}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400">
                                {activeLang === 'AR'
                                  ? 'يمكنك أيضاً تصفح تبويب "مؤهلون للسحب" لمشاهدة المستخدمين الذين بلغوا الحد الأدنى.'
                                  : 'Check the "Eligible Users" filter to inspect users who reached minimum balance.'}
                              </p>
                            </div>
                          ) : (
                            filteredWithdrawals.map((w: any) => {
                              const st = (w.status || 'pending').toLowerCase();
                              const isPending = st === 'pending';
                              const isCompleted = st === 'completed' || st === 'approved';

                              return (
                                <div
                                  key={w.id}
                                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3"
                                >
                                  {/* User & Status Row */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                                        {w.photoUrl ? (
                                          <img src={w.photoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          (w.firstName || w.username || 'U').slice(0, 2).toUpperCase()
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs font-black text-slate-900 truncate">
                                            {w.firstName || 'User'}
                                          </span>
                                          {w.username && (
                                            <span className="text-[10px] font-bold text-slate-400 truncate" dir="ltr">
                                              @{w.username}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
                                          <span>ID: {w.userId}</span>
                                          <span>•</span>
                                          <span>
                                            {w.createdAt
                                              ? new Date(w.createdAt).toLocaleString([], {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })
                                              : ''}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <span
                                      className={cn(
                                        'text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0',
                                        isCompleted
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : st === 'rejected'
                                            ? 'bg-red-50 text-red-700 border-red-200'
                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                      )}
                                    >
                                      {isCompleted
                                        ? activeLang === 'AR'
                                          ? 'مكتمل ✓'
                                          : 'Completed'
                                        : st === 'rejected'
                                          ? activeLang === 'AR'
                                            ? 'مرفوض ✕'
                                            : 'Rejected'
                                          : activeLang === 'AR'
                                            ? 'قيد الانتظار'
                                            : 'Pending'}
                                    </span>
                                  </div>

                                  {/* Amount & User Verification Metadata */}
                                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                                    <div>
                                      <span className="text-[9px] font-bold text-slate-400 block">
                                        {activeLang === 'AR' ? 'المبلغ المطلوب سحبه' : 'Withdrawal Amount'}
                                      </span>
                                      <div className="text-base font-black text-slate-900 mt-0.5" dir="ltr">
                                        <USDT amount={formatUSDT(w.amount || 0)} size="text-base" iconSize="w-4 h-4" />
                                      </div>
                                    </div>
                                    <div className="text-right space-y-0.5 text-[9px] font-bold text-slate-500">
                                      <div>
                                        {activeLang === 'AR' ? 'الإحالات:' : 'Referrals:'}{' '}
                                        <span className="font-black text-slate-800">{w.userReferralsCount || 0}</span>
                                      </div>
                                      <div>
                                        NFT:{' '}
                                        <span className="font-black text-indigo-600">
                                          {(w.userHasNft || 0) >= 1 ? `Lvl ${w.userHasNft}` : 'None'}
                                        </span>
                                      </div>
                                      <div>
                                        {activeLang === 'AR' ? 'الرصيد المتبقي:' : 'Balance:'}{' '}
                                        <span className="font-black text-emerald-600">
                                          {formatUSDT(w.userBalance || 0)} USDT
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Wallet Address Copy Bar */}
                                  <div className="flex items-center justify-between gap-2 bg-slate-900 text-white px-3 py-2 rounded-xl">
                                    <div className="min-w-0 flex-1" dir="ltr">
                                      <span className="text-[8px] font-bold text-slate-400 uppercase block">
                                        Wallet Address (TRC20 / BEP20)
                                      </span>
                                      <p className="text-[10px] font-mono font-bold text-amber-300 truncate">
                                        {w.walletAddress}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => copyToClipboard(w.walletAddress, `wal_${w.id}`)}
                                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[9px] font-black text-white flex items-center gap-1 shrink-0 transition-colors"
                                    >
                                      {copiedId === `wal_${w.id}` ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-400" />
                                          <span>{activeLang === 'AR' ? 'تم النسخ' : 'Copied'}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>{activeLang === 'AR' ? 'نسخ' : 'Copy'}</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {/* Admin Action Buttons for Pending Withdrawals */}
                                  {isPending && typeof w.id === 'number' && w.id > 0 && (
                                    <div className="flex gap-2 pt-1">
                                      <button
                                        disabled={updatingId === w.id}
                                        onClick={() => handleUpdateWithdrawalStatus(w, 'completed', false)}
                                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl flex items-center justify-center gap-1 shadow-sm disabled:opacity-50 transition-colors"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>
                                          {activeLang === 'AR' ? 'اعتماد وإتمام الدفع' : 'Approve & Mark Paid'}
                                        </span>
                                      </button>
                                      <button
                                        disabled={updatingId === w.id}
                                        onClick={() => handleUpdateWithdrawalStatus(w, 'rejected', true)}
                                        className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-black rounded-xl flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>
                                          {activeLang === 'AR' ? 'رفض وإرجاع الرصيد' : 'Reject & Refund'}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ==================== TAB 3: ACTIVE 24H & ALL USERS ==================== */}
                  {activeSection === 'users' && (
                    <div className="space-y-3.5">
                      {/* Sub-navigation Pills */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        <button
                          onClick={() => setUserFilter('active24h')}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-1.5 border',
                            userFilter === 'active24h'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200'
                          )}
                        >
                          <Activity className="w-3 h-3" />
                          <span>{activeLang === 'AR' ? 'نشطون آخر 24س' : 'Active (24h)'}</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-black/15 font-mono">
                            {statsData.activeUsers24h || 0}
                          </span>
                        </button>

                        <button
                          onClick={() => setUserFilter('all')}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-1.5 border',
                            userFilter === 'all'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200'
                          )}
                        >
                          <Users className="w-3 h-3" />
                          <span>{activeLang === 'AR' ? 'كل المستخدمين' : 'All Users'}</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-black/15 font-mono">
                            {statsData.totalUsers || 0}
                          </span>
                        </button>

                        <button
                          onClick={() => setUserFilter('topBalance')}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-1.5 border',
                            userFilter === 'topBalance'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200'
                          )}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{activeLang === 'AR' ? 'الأعلى رصيداً' : 'Top Balances'}</span>
                        </button>

                        <button
                          onClick={() => setUserFilter('manualTasks')}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-1.5 border',
                            userFilter === 'manualTasks'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200'
                          )}
                        >
                          <ClipboardCheck className="w-3 h-3" />
                          <span>{activeLang === 'AR' ? 'مهام Baat' : 'Baat Tasks'}</span>
                          {pendingManualTasksCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-red-500 text-white font-mono">
                              {pendingManualTasksCount}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Search Input */}
                      {userFilter !== 'manualTasks' && (
                        <div className="relative">
                          <Search
                            className={cn(
                              'w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2',
                              isRTL ? 'right-3.5' : 'left-3.5'
                            )}
                          />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={
                              activeLang === 'AR'
                                ? 'ابحث عن مستخدم بالاسم أو @username أو ID...'
                                : 'Search user by name, @username, or ID...'
                            }
                            className={cn(
                              'w-full bg-white border border-slate-200 rounded-xl py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900',
                              isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'
                            )}
                          />
                        </div>
                      )}

                      {userFilter === 'manualTasks' ? (
                        <div className="space-y-2.5">
                          {(statsData.manualTasks || []).length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/70">
                              <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-xs font-black text-slate-500">
                                {activeLang === 'AR'
                                  ? 'لا توجد طلبات مراجعة يدوية لمهمة Baat حالياً'
                                  : 'No manual task submissions found'}
                              </p>
                            </div>
                          ) : (
                            (statsData.manualTasks || []).map((task: any) => (
                              <div
                                key={task.id}
                                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-black text-slate-900">
                                      {task.firstName || 'User'}{' '}
                                      {task.username && (
                                        <span className="text-[10px] font-bold text-slate-400" dir="ltr">
                                          (@{task.username})
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400">
                                      ID: {task.userId} •{' '}
                                      {task.createdAt ? new Date(task.createdAt).toLocaleString() : ''}
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      'text-[9px] font-black uppercase px-2 py-0.5 rounded-full',
                                      task.status === 'approved'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : task.status === 'rejected'
                                          ? 'bg-red-50 text-red-700'
                                          : 'bg-amber-50 text-amber-700'
                                    )}
                                  >
                                    {task.status}
                                  </span>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {activeLang === 'AR' ? 'اسم المستخدم المسجل في Baat:' : 'Submitted Baat Username:'}
                                  </span>
                                  <span className="text-xs font-black text-indigo-600 font-mono" dir="ltr">
                                    {task.externalUsername}
                                  </span>
                                </div>

                                {task.status === 'pending' && (
                                  <div className="flex gap-2">
                                    <button
                                      disabled={updatingId === `task_${task.id}`}
                                      onClick={() => handleReviewManualTask(task.id, 'approved')}
                                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl transition-colors disabled:opacity-50"
                                    >
                                      {activeLang === 'AR' ? 'قبول (+1 USDT)' : 'Approve (+1 USDT)'}
                                    </button>
                                    <button
                                      disabled={updatingId === `task_${task.id}`}
                                      onClick={() => handleReviewManualTask(task.id, 'rejected')}
                                      className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-black rounded-xl transition-colors disabled:opacity-50"
                                    >
                                      {activeLang === 'AR' ? 'رفض' : 'Reject'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredUsers.map((u: any) => (
                            <div
                              key={u.id}
                              className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative shrink-0">
                                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center overflow-hidden border border-slate-200">
                                    {u.photoUrl ? (
                                      <img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      (u.firstName || u.username || 'U').slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  {u.isActive24h && (
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs font-black text-slate-900 truncate">
                                      {u.firstName || 'User'}
                                    </p>
                                    {u.username && (
                                      <span className="text-[10px] font-bold text-slate-400 truncate" dir="ltr">
                                        @{u.username}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 mt-0.5">
                                    <button
                                      onClick={() => copyToClipboard(u.id, `u_${u.id}`)}
                                      className="hover:text-slate-700 flex items-center gap-0.5"
                                    >
                                      <span>ID: {u.id}</span>
                                      {copiedId === `u_${u.id}` ? (
                                        <Check className="w-2.5 h-2.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-2.5 h-2.5" />
                                      )}
                                    </button>
                                    <span>•</span>
                                    <span className={cn(u.isActive24h ? 'text-emerald-600 font-extrabold' : 'text-slate-400')}>
                                      {formatRelativeTime(u.lastActiveAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0" dir="ltr">
                                <span className="text-xs font-black text-slate-900 font-mono block">
                                  {formatUSDT(u.balance || 0)} USDT
                                </span>
                                <div className="flex items-center justify-end gap-1 mt-0.5 text-[8px] font-black">
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                    Refs: {u.referralsCount || 0}
                                  </span>
                                  {(u.hasNft || 0) >= 1 && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
                                      NFT L{u.hasNft}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-60 flex flex-col items-center justify-center text-center p-4">
                  <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                  <p className="text-xs font-black text-slate-800">
                    {activeLang === 'AR' ? 'تعذر تحميل بيانات لوحة الأدمن' : 'Failed to load admin statistics'}
                  </p>
                  <button
                    onClick={fetchAndReconcileAdminData}
                    className="mt-3 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl"
                  >
                    {activeLang === 'AR' ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
