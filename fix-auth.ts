const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  if (!user) {
    isNewUserFlag = true;
    try {
      user = await db.insert(users).values({
        id: userId,
        username: tgUser.username || '',
        firstName: tgUser.first_name || '',
        photoUrl: tgUser.photo_url || '',
        referralCode: userId,
        balance: 0,
        totalEarned: 0,
        miningRate: BASE_MINING_RATE,
        referralsCount: 0,
        referralEarnings: 0,
        createdAt: Date.now()
      }).returning().get();`;

const replacement = `  if (!user) {
    // 1. Check Firebase first (hydration for ephemeral SQLite)
    try {
      const fbUser = await lookupUserByTelegramId(userId);
      if (fbUser) {
        user = await db.insert(users).values({
          id: userId,
          username: fbUser.username || tgUser.username || '',
          firstName: fbUser.firstName || tgUser.first_name || '',
          photoUrl: fbUser.photoUrl || tgUser.photo_url || '',
          referralCode: userId,
          balance: fbUser.balance || 0,
          totalEarned: fbUser.totalEarned || 0,
          miningRate: fbUser.miningRate || BASE_MINING_RATE,
          referralsCount: fbUser.referralsCount || 0,
          referralEarnings: fbUser.referralEarnings || 0,
          createdAt: fbUser.createdAt || Date.now()
        }).returning().get();
      }
    } catch(e) { console.error('Firebase lookup failed', e); }

    if (!user) {
      isNewUserFlag = true;
      try {
        user = await db.insert(users).values({
          id: userId,
          username: tgUser.username || '',
          firstName: tgUser.first_name || '',
          photoUrl: tgUser.photo_url || '',
          referralCode: userId,
          balance: 0,
          totalEarned: 0,
          miningRate: BASE_MINING_RATE,
          referralsCount: 0,
          referralEarnings: 0,
          createdAt: Date.now()
        }).returning().get();`;

code = code.replace(target, replacement);

const endTarget = `      console.warn(\`[AUTH] Concurrent registration attempt for \${userId}\`);
      user = await db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return res.status(500).json({ error: 'Database error' });
    }
  }`;

const endReplacement = `      console.warn(\`[AUTH] Concurrent registration attempt for \${userId}\`);
      user = await db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return res.status(500).json({ error: 'Database error' });
    }
    }
  }`;
code = code.replace(endTarget, endReplacement);
fs.writeFileSync('server.ts', code);
