import React from 'react';
import { cn } from '../lib/utils';

interface USDTProps {
  amount?: React.ReactNode;
  className?: string;
  size?: string;
  iconSize?: string;
}

export function USDT({ amount, className, size = 'text-base', iconSize = 'w-5 h-5' }: USDTProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-black max-w-full min-w-0", size, className)}>
      {amount !== undefined && <span className="truncate">{amount}</span>}
      <span className="inline-flex items-center gap-1 shrink-0">
        <img src="https://i.ibb.co/1GRktfhQ/Tether-USDT.png" alt="USDT" className={cn("object-contain shrink-0 drop-shadow-sm", iconSize)} />
        <span>USDT</span>
      </span>
    </span>
  );
}
