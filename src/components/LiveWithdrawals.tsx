import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { USDT } from './USDT';
import { ArrowDownLeft, ShieldCheck } from 'lucide-react';

interface WithdrawalRecord {
  id: string;
  username: string;
  amount: number;
  wallet: string;
  timeLabel: string;
  country: 'AR' | 'RU' | 'IR'; // Arabic, Russian, Persian (Iran)
}

const ARABIC_USERS = [
  '@ahmed_dxb', '@faten_sy', '@youssef_99', '@abdallah_ali', '@mohamed_hr', 
  '@saad_al_otaibi', '@sara_sh', '@khaled_j', '@nour_el_din', '@omar_gh', 
  '@amina_dz', '@rami_beirut', '@mahmoud_eg', '@hassan_kwt', '@yasmin_kh', 
  '@tareq_jo', '@faisal_ksa', '@reem_ad', '@moumen_tn', '@zainab_om'
];

const RUSSIAN_USERS = [
  '@vlad_spb', '@elena_k', '@dima_msc', '@olga_morozova', '@serg_ivanov', 
  '@sveta_p', '@alex_smirnov', '@natasha_ru', '@igor_nn', '@anna_volkova', 
  '@artem_92', '@katya_novosib', '@mikhail_s', '@masha_krasnodar', '@pavel_durov_fan', 
  '@andrey_v', '@tanya_nsk', '@max_sokolov', '@yulia_sh', '@denis_kazan'
];

const PERSIAN_USERS = [
  '@reza_teh', '@maryam_kh', '@ali_karimi', '@shahin_esf', '@sara_ahb', 
  '@amir_shiraz', '@yasaman_m', '@farnaz_g', '@pejman_r', '@nilou_kh', 
  '@arash_sh', '@zahra_hoseini', '@bahram_y', '@sohrab_rezaei', '@kian_mehr', 
  '@elnaz_mo', '@dariush_k', '@vida_jafari', '@pouya_farah', '@mehdi_karami'
];

function generateRandomWallet(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = Math.random() > 0.4 ? 'UQ' : 'EQ'; // TON addresses typically start with UQ or EQ
  let start = '';
  let end = '';
  for (let i = 0; i < 4; i++) {
    start += chars.charAt(Math.floor(Math.random() * chars.length));
    end += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${start}...${end}`;
}

function generateRandomAmount(): number {
  // Generate random amount between 10.00 and 50.00 with 1 or 2 decimal places
  const min = 10;
  const max = 50;
  const val = Math.random() * (max - min) + min;
  return Math.round(val * 100) / 100;
}

function getRandomUser(): { username: string; country: 'AR' | 'RU' | 'IR' } {
  const rand = Math.random();
  if (rand < 0.35) {
    const username = ARABIC_USERS[Math.floor(Math.random() * ARABIC_USERS.length)];
    return { username, country: 'AR' };
  } else if (rand < 0.70) {
    const username = RUSSIAN_USERS[Math.floor(Math.random() * RUSSIAN_USERS.length)];
    return { username, country: 'RU' };
  } else {
    const username = PERSIAN_USERS[Math.floor(Math.random() * PERSIAN_USERS.length)];
    return { username, country: 'IR' };
  }
}

// Function to format username professionally with dots (e.g. @ahm•••pto) for privacy and realism
function maskUsername(username: string): string {
  if (!username.startsWith('@')) return username;
  const name = username.slice(1); // remove '@'
  if (name.length <= 4) {
    return `@${name[0]}••${name[name.length - 1]}`;
  }
  const start = name.slice(0, 3);
  const end = name.slice(-3);
  return `@${start}•••${end}`;
}

export function LiveWithdrawals() {
  const [list, setList] = useState<WithdrawalRecord[]>([]);

  // Initialize with some realistic past records
  useEffect(() => {
    const initialList: WithdrawalRecord[] = [];
    for (let i = 0; i < 4; i++) {
      const userInfo = getRandomUser();
      initialList.push({
        id: Math.random().toString(),
        username: userInfo.username,
        amount: generateRandomAmount(),
        wallet: generateRandomWallet(),
        timeLabel: `${(i * 2) + 1} min ago`,
        country: userInfo.country
      });
    }
    setList(initialList);
  }, []);

  // Update effect to add new item every 7 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const userInfo = getRandomUser();
      const newRecord: WithdrawalRecord = {
        id: Math.random().toString(),
        username: userInfo.username,
        amount: generateRandomAmount(),
        wallet: generateRandomWallet(),
        timeLabel: 'Just now',
        country: userInfo.country
      };

      setList(prev => {
        // Update previous labels to make it dynamic
        const updatedPrev = prev.map((item) => {
          if (item.timeLabel === 'Just now') {
            return { ...item, timeLabel: '1 min ago' };
          } else if (item.timeLabel.includes('min ago')) {
            const mins = parseInt(item.timeLabel);
            return { ...item, timeLabel: `${mins + 1} min ago` };
          }
          return item;
        });

        // Add new record at the top and keep maximum of 5 records
        return [newRecord, ...updatedPrev].slice(0, 5);
      });
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-[28px] p-5 shadow-[0_10px_35px_rgba(15,23,42,0.04)] border border-slate-200/70 flex flex-col relative overflow-hidden">
      {/* Live status header */}
      <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <h3 className="font-black text-sm text-slate-900 tracking-tight">
            Live Network Payouts
          </h3>
        </div>
        <div className="flex items-center gap-1 text-emerald-700 text-[11px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Verified</span>
        </div>
      </div>

      {/* Main transactions container */}
      <div className="divide-y divide-slate-100 min-h-[210px]">
        <AnimatePresence initial={false}>
          {list.map((item) => {
            let countryBadge = '🇸🇦';
            let countryLabel = 'MENA';

            if (item.country === 'RU') {
              countryBadge = '🇷🇺';
              countryLabel = 'CIS';
            } else if (item.country === 'IR') {
              countryBadge = '🇮🇷';
              countryLabel = 'IR';
            }

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-700 relative shrink-0">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span className="absolute -bottom-1 -right-1 text-[10px] select-none">
                      {countryBadge}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-black text-slate-900 tracking-tight truncate">
                        {maskUsername(item.username)}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {countryLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-0.5">
                      <span className="font-mono tracking-tight">{item.wallet}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span>{item.timeLabel}</span>
                    </div>
                  </div>
                </div>
                
                <div className="font-mono tabular-nums shrink-0">
                  <USDT amount={item.amount.toFixed(2)} size="text-xs text-emerald-600 font-black" iconSize="w-3.5 h-3.5" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

