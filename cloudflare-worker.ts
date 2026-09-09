import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'node:crypto';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
}

// 1. Initialize Firebase Admin lazily for Cloudflare Workers
let isFirebaseInitialized = false;

function initFirebase(env: Env) {
  if (!isFirebaseInitialized && !getApps().length) {
    try {
      initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          // Ensure private key handles newlines correctly when loaded from env vars
          privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      isFirebaseInitialized = true;
    } catch (error) {
      console.error('Firebase Admin initialization error', error);
    }
  }
}

// 2. Secure Telegram validation function using Node Crypto
export function validateInitDataSecure(initData: string, botToken: string) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  
  // Replay Attack Protection (Max valid time: 24 hours)
  const authDateStr = urlParams.get('auth_date');
  if (!authDateStr) {
    throw new Error('Missing auth_date');
  }
  const authDate = parseInt(authDateStr, 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) throw new Error('Session expired');

  urlParams.delete('hash');
  const keys = Array.from(urlParams.keys()).sort();
  const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (hash !== expectedHash) throw new Error('Invalid signature');
  
  // Safely extract start_param exclusively from the verified string
  const startParam = urlParams.get('start_param') || '';
  const user = JSON.parse(urlParams.get('user') || '{}');
  
  return { user, startParam };
}

// 3. Atomic Cloudflare Worker / Serverless logic for Auth & Referral
export async function handleAuthAndReferral(initData: string, botToken: string) {
  const { user: tgUser, startParam } = validateInitDataSecure(initData, botToken);
  const userId = tgUser.id.toString();
  const db = getFirestore();
  
  // Extract referrerId safely
  let referrerId: string | null = null;
  if (startParam && startParam.startsWith('ref_')) {
    referrerId = startParam.replace(/^ref_/, '').replace(/^tg_/, '').trim();
  }

  const userRef = db.collection('users').doc(userId);
  let isNewUser = false;
  let finalUserData: any = null;

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    let userData = userDoc.data();

    // 1. Register User if not exists
    if (!userDoc.exists) {
      isNewUser = true;
      userData = {
        id: userId,
        username: tgUser.username || '',
        firstName: tgUser.first_name || '',
        balance: 0,
        miningRate: 1000, // Scaled by 10000 (0.10)
        referralsCount: 0,
        referredBy: null,
        referralEarnings: 0,
        createdAt: FieldValue.serverTimestamp()
      };
      transaction.set(userRef, userData);
    }

    // 2. Process Referral strictly
    if (
      referrerId && 
      referrerId !== userId && 
      (!userData?.referredBy) // Must not have been referred before
    ) {
      const referrerRef = db.collection('users').doc(referrerId);
      const referrerDoc = await transaction.get(referrerRef);

      // Referrer must be a valid existing user
      if (referrerDoc.exists) {
        const referralRecordRef = db.collection('referral_records').doc(`${referrerId}_${userId}`);
        const recordDoc = await transaction.get(referralRecordRef);

        // Prevent Duplicate Referrals (Idempotency)
        if (!recordDoc.exists) {
          // A. Update the referred user (mark as referred)
          userData!.referredBy = referrerId;
          transaction.update(userRef, { referredBy: referrerId });

          // B. Reward the Referrer (Scaled values)
          transaction.update(referrerRef, {
            balance: FieldValue.increment(1000), // +0.10 USDT
            totalEarned: FieldValue.increment(1000),
            miningRate: FieldValue.increment(100), // +0.01 Mining Rate
            referralEarnings: FieldValue.increment(1000),
            referralsCount: FieldValue.increment(1)
          });

          // C. Create Referral Record
          transaction.set(referralRecordRef, {
            referrerId,
            referredId: userId,
            rewardUSDT: 1000,
            miningBonus: 100,
            status: 'completed',
            createdAt: FieldValue.serverTimestamp()
          });
        }
      }
    }
    
    finalUserData = userData;
  });

  return { success: true, user: finalUserData, isNewUser };
}

// 4. Cloudflare Worker Entry Point
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    try {
      const url = new URL(request.url);
      
      // API Route for Telegram Auth & Referral Process
      if (url.pathname === '/api/auth' && request.method === 'POST') {
        // Must initialize Firebase before using it
        initFirebase(env);
        
        const authHeader = request.headers.get('Authorization') || '';
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
        }

        const result = await handleAuthAndReferral(authHeader, env.TELEGRAM_BOT_TOKEN);
        
        return new Response(JSON.stringify(result), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error: any) {
      console.error('Worker Error:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};

