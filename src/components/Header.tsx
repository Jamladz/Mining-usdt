import React from 'react';

export function Header({ title }: { title: string }) {
  return (
    <header className="px-4 bg-white/85 backdrop-blur-xl border-b border-slate-200/70 flex items-center justify-between sticky top-0 z-40 h-14 shrink-0">
      <div className="flex items-center gap-1.5">
        <h1 className="font-black text-base leading-none text-slate-900 tracking-tight whitespace-nowrap">
          MINING USDT
        </h1>
        <img 
          src="https://i.ibb.co/HLT6ZFck/file-00000000a24c81f4a775591b812d2228.png" 
          alt="Verified" 
          className="w-5 h-5 object-contain shrink-0" 
          referrerPolicy="no-referrer"
        />
      </div>

      <span className="text-xs font-bold text-slate-500 tracking-tight whitespace-nowrap">
        {title}
      </span>
    </header>
  );
}

