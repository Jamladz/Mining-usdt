import React from 'react';

export function Header({ title }: { title: string }) {
  return (
    <header className="px-4 py-3 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 flex items-center justify-between sticky top-0 z-40 h-[56px] shrink-0">
      <h1 className="font-bold text-[15px] leading-tight text-slate-900 tracking-tight">{title}</h1>
      <div className="flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
        <img src="https://i.ibb.co/1GRktfhQ/Tether-USDT.png" alt="USDT" className="w-4 h-4 object-contain" />
        <span className="text-[10px] font-black text-emerald-700 tracking-tighter">USDT Miner</span>
      </div>
    </header>
  );
}
