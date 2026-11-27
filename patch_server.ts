import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace(
  "const referralBonusEarned = userReferrals.length * 1000;",
  "const referralBonusEarned = userReferrals.length * 5000;"
);
fs.writeFileSync('server.ts', content);
