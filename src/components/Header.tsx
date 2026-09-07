import React from 'react';
import { useApp } from '../context/AppContext';
import { Maximize, Minimize } from 'lucide-react';
import { motion } from 'motion/react';

export function Header({ title }: { title: string }) {
  const { isFullscreen, toggleFullscreen, canFullscreen } = useApp();

  return (
    <header className="px-4 py-3 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 flex items-center justify-between sticky top-0 z-40 h-[56px] shrink-0 pt-[var(--tg-safe-area-inset-top,0px)] box-content">
      {/* Brand / App Name */}
      <div className="flex items-center gap-1.5">
        <h1 className="font-black text-[18px] leading-tight text-slate-900 tracking-tight">Mining usdt</h1>
        <img 
          src="https://i.ibb.co/HLT6ZFck/file-00000000a24c81f4a775591b812d2228.png" 
          alt="logo" 
          className="w-6 h-6 object-contain" 
        />
      </div>

      <div className="flex items-center space-x-2">
        <div className="bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/50">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</span>
        </div>
      </div>
    </header>
  );
}
