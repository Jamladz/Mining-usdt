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
    <div className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col relative overflow-hidden">
      {/* Live status header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            Live Withdrawals
          </h3>
        </div>
        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-black border border-emerald-100/60">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SECURED</span>
        </div>
      </div>

      {/* Main transactions container */}
      <div className="space-y-3 min-h-[220px]">
        <AnimatePresence initial={false}>
          {list.map((item) => {
            let countryBadge = '';
            let countryLabel = '';
            let countryClass = '';

            if (item.country === 'AR') {
              countryBadge = '🇸🇦';
              countryLabel = 'Arab';
              countryClass = 'bg-emerald-50/70 text-emerald-700 border border-emerald-100/40';
            } else if (item.country === 'RU') {
              countryBadge = '🇷🇺';
              countryLabel = 'Rus';
              countryClass = 'bg-blue-50/70 text-blue-700 border border-blue-100/40';
            } else {
              countryBadge = '🇮🇷';
              countryLabel = 'Persian';
              countryClass = 'bg-amber-50/70 text-amber-700 border border-amber-100/40';
            }

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-all border border-slate-100/40 shadow-[0_1px_4px_rgba(0,0,0,0.01)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50/50 border border-indigo-100/30 flex items-center justify-center text-indigo-500 relative">
                      <ArrowDownLeft className="w-4 h-4 text-indigo-500" />
                      <span className="absolute -bottom-1 -right-1 text-[9px] filter drop-shadow-sm select-none">
                        {countryBadge}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-slate-800 tracking-tight">
                          {maskUsername(item.username)}
                        </span>
                        <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider border ${countryClass}`}>
                          {countryLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                        <span className="font-mono text-[9px] tracking-tight">{item.wallet}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 font-bold text-[9px]">{item.timeLabel}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-emerald-50/85 border border-emerald-100/40 px-2.5 py-1 rounded-xl shadow-[0_1px_5px_rgba(16,185,129,0.02)]">
                    <USDT amount={item.amount.toFixed(2)} size="text-xs text-emerald-600 font-black" iconSize="w-3.5 h-3.5" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-4 text-center text-[10px] font-bold text-slate-400 flex items-center justify-center gap-2">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
        <span>Updating in real-time on TON blockchain</span>
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
}
