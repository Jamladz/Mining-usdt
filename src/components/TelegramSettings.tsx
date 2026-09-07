import React from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'motion/react';
import { Maximize, Minimize, BookmarkPlus, CheckCircle2, AlertCircle, Info, Smartphone, Code } from 'lucide-react';
import { cn } from '../lib/utils';

export function TelegramSettings() {
  const { 
    tgVersion, 
    tgPlatform, 
    isFullscreen, 
    toggleFullscreen, 
    canFullscreen, 
    homeScreenStatus, 
    canAddToHomeScreen, 
    addToHomeScreen,
    safeAreaSupported
  } = useApp();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Smartphone className="w-5 h-5 text-slate-800" />
        <h2 className="text-[15px] font-black text-slate-900 tracking-tight">Telegram App Settings</h2>
      </div>

      {/* 1. Full Screen */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 border border-slate-100">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-black text-slate-900 tracking-tight">Full Screen</span>
              <span className="text-[10px] font-medium text-slate-400">
                {canFullscreen ? (isFullscreen ? 'Active' : 'Supported') : 'Not supported'}
              </span>
            </div>
          </div>
          
          {canFullscreen && (
            <button
              onClick={toggleFullscreen}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-sm",
                isFullscreen 
                  ? "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                  : "bg-slate-900 text-white hover:bg-slate-800 shadow-[0_4px_14px_rgba(0,0,0,0.1)]"
              )}
            >
              {isFullscreen ? 'Exit' : 'Open'}
            </button>
          )}
        </div>
        
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          {canFullscreen 
            ? "Expand the Mini App to fill the entire screen, hiding the Telegram header for a more immersive experience."
            : "Fullscreen is not supported on this Telegram version/device. Update Telegram to version 8.0+."}
        </p>
      </motion.div>

      {/* 2. Add to Home Screen */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 border border-slate-100">
              {homeScreenStatus === 'added' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <BookmarkPlus className="w-5 h-5" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-black text-slate-900 tracking-tight">Add to Home Screen</span>
              <span className="text-[10px] font-medium text-slate-400 capitalize">
                {homeScreenStatus === 'unsupported' ? 'Not supported' : homeScreenStatus}
              </span>
            </div>
          </div>
          
          {homeScreenStatus !== 'unsupported' && homeScreenStatus !== 'unknown' && homeScreenStatus !== 'checking' && (
            <button
              onClick={addToHomeScreen}
              disabled={homeScreenStatus === 'added' || !canAddToHomeScreen}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-sm",
                homeScreenStatus === 'added' 
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100 opacity-80"
                  : "bg-slate-900 text-white hover:bg-slate-800 shadow-[0_4px_14px_rgba(0,0,0,0.1)]"
              )}
            >
              {homeScreenStatus === 'added' ? 'Added' : 'Add App'}
            </button>
          )}
        </div>
        
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          {homeScreenStatus !== 'unsupported'
            ? "Create a shortcut on your device's home screen for quick access to the app."
            : "This feature is currently unavailable on your Telegram environment. Update Telegram to version 8.0+."}
        </p>
      </motion.div>

      {/* 3. Telegram Compatibility */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100"
      >
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <Code className="w-4 h-4 text-slate-500" />
          <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Telegram Compatibility</h3>
        </div>
        
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Telegram Version</span>
            <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-md">{tgVersion}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Platform</span>
            <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-md capitalize">{tgPlatform}</span>
          </div>
          
          <div className="h-px bg-slate-100 my-2"></div>
          
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Fullscreen API</span>
            {canFullscreen ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Supported</span>
            ) : (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Not Supported</span>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Home Screen API</span>
            {homeScreenStatus !== 'unsupported' ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Supported</span>
            ) : (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Not Supported</span>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">Safe Areas Support</span>
            {safeAreaSupported ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span>
            ) : (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Not Supported</span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
