import * as crypto from 'node:crypto';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
}

// Helper functions for Web Crypto JWT Signing & Google OAuth2 Token Exchanger
function base64url(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function stringToBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function pemToDer(pem: string): ArrayBuffer {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  const binary = atob(pemContents);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJwt(clientEmail: string, privateKeyPEM: string): Promise<string> {
  const der = pemToDer(privateKeyPEM);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64url(stringToBuffer(JSON.stringify(header)));
  const encodedPayload = base64url(stringToBuffer(JSON.stringify(payload)));

  const tokenInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    stringToBuffer(tokenInput)
  );

  const encodedSignature = base64url(new Uint8Array(signature));
  return `${tokenInput}.${encodedSignature}`;
}

async function getGoogleAccessToken(clientEmail: string, privateKeyPEM: string): Promise<string> {
  const jwt = await signJwt(clientEmail, privateKeyPEM);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Google Access Token: ${text}`);
  }

  const data: any = await res.json();
  return data.access_token;
}

// Firestore REST JSON serializers/deserializers
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: any = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(fVal: any): any {
  if (!fVal) return null;
  if ('nullValue' in fVal) return null;
  if ('booleanValue' in fVal) return fVal.booleanValue;
  if ('integerValue' in fVal) return parseInt(fVal.integerValue, 10);
  if ('doubleValue' in fVal) return parseFloat(fVal.doubleValue);
  if ('stringValue' in fVal) return fVal.stringValue;
  if ('timestampValue' in fVal) return fVal.timestampValue;
  if ('arrayValue' in fVal) {
    const vals = fVal.arrayValue.values || [];
    return vals.map(fromFirestoreValue);
  }
  if ('mapValue' in fVal) {
    const fields = fVal.mapValue.fields || {};
    const res: any = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

function toFirestoreDoc(obj: any): any {
  const fields: any = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

function fromFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return null;
  const res: any = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    res[k] = fromFirestoreValue(v);
  }
  return res;
}

// Secure Telegram validation function
export function validateInitDataSecure(initData: string, botToken: string) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  
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
  
  const startParam = urlParams.get('start_param') || '';
  const user = JSON.parse(urlParams.get('user') || '{}');
  
  return { user, startParam };
}

// Atomic Cloudflare Worker / Serverless logic for Auth & Referral
export async function handleAuthAndReferral(initData: string, env: Env) {
  const { user: tgUser, startParam } = validateInitDataSecure(initData, env.TELEGRAM_BOT_TOKEN);
  const userId = tgUser.id.toString();

  // Extract referrerId safely
  let referrerId: string | null = null;
  if (startParam && startParam.startsWith('ref_')) {
    referrerId = startParam.replace(/^ref_/, '').replace(/^tg_/, '').trim();
  }

  // 1. Authenticate with Google
  const formattedPrivateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const token = await getGoogleAccessToken(env.FIREBASE_CLIENT_EMAIL, formattedPrivateKey);

  // 2. Begin Transaction
  const beginTxUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:beginTransaction`;
  const beginTxRes = await fetch(beginTxUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      options: {
        readWrite: {}
      }
    })
  });

  if (!beginTxRes.ok) {
    throw new Error(`beginTransaction failed: ${await beginTxRes.text()}`);
  }

  const beginTxData: any = await beginTxRes.json();
  const txId = beginTxData.transaction;

  try {
    // 3. Batch Get required documents
    const userPath = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}`;
    const referrerPath = referrerId ? `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${referrerId}` : null;
    const recordPath = referrerId ? `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/referral_records/${referrerId}_${userId}` : null;

    const docsToGet = [userPath];
    if (referrerPath) docsToGet.push(referrerPath);
    if (recordPath) docsToGet.push(recordPath);

    const batchGetUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:batchGet`;
    const batchRes = await fetch(batchGetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documents: docsToGet,
        transaction: txId
      })
    });

    if (!batchRes.ok) {
      throw new Error(`batchGet failed: ${await batchRes.text()}`);
    }

    const batchData: any = await batchRes.json();
    
    let userDoc: any = null;
    let referrerDoc: any = null;
    let recordDoc: any = null;

    for (const item of batchData) {
      if (item.found) {
        const name = item.found.name;
        if (name.endsWith(`/users/${userId}`)) {
          userDoc = item.found;
        } else if (referrerId && name.endsWith(`/users/${referrerId}`)) {
          referrerDoc = item.found;
        } else if (referrerId && name.endsWith(`/${referrerId}_${userId}`)) {
          recordDoc = item.found;
        }
      }
    }

    let userData = userDoc ? fromFirestoreDoc(userDoc) : null;
    const writes: any[] = [];
    let isNewUser = false;

    // 1. Register User if not exists
    if (!userData) {
      isNewUser = true;
      userData = {
        id: userId,
        username: tgUser.username || '',
        firstName: tgUser.first_name || '',
        photoUrl: tgUser.photo_url || '',
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        miningRate: 1000, // Scaled by 10000 (0.10)
        referralCode: userId,
        referralsCount: 0,
        referredBy: null,
        referralEarnings: 0,
        claimedWelcome: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    // 2. Process Referral strictly
    if (
      referrerId && 
      referrerId !== userId && 
      (!userData.referredBy) // Must not have been referred before
    ) {
      if (referrerDoc) {
        const referrerData = fromFirestoreDoc(referrerDoc);

        // Prevent Duplicate Referrals (Idempotency)
        if (!recordDoc) {
          // A. Update the referred user (mark as referred)
          userData.referredBy = referrerId;
          userData.updatedAt = Date.now();

          // B. Reward the Referrer (Scaled values)
          referrerData.balance = (referrerData.balance || 0) + 1000; // +0.10 USDT
          referrerData.totalEarned = (referrerData.totalEarned || 0) + 1000;
          referrerData.miningRate = Math.min((referrerData.miningRate || 1000) + 100, 1500); // +0.01 Mining Rate (capped at max 0.15 / 1500)
          referrerData.referralEarnings = (referrerData.referralEarnings || 0) + 1000;
          referrerData.referralsCount = (referrerData.referralsCount || 0) + 1;
          referrerData.updatedAt = Date.now();

          writes.push({
            update: {
              name: referrerPath,
              fields: toFirestoreDoc(referrerData).fields
            }
          });

          // C. Create Referral Record
          const referralRecord = {
            referrerId,
            referredUserId: userId,
            rewardUSDT: 1000,
            miningBonus: 100,
            status: 'completed',
            createdAt: Date.now()
          };
          writes.push({
            update: {
              name: recordPath,
              fields: toFirestoreDoc(referralRecord).fields
            }
          });
        }
      }
    }

    // Push the referred/registered user document write
    writes.push({
      update: {
        name: userPath,
        fields: toFirestoreDoc(userData).fields
      }
    });

    // 4. Commit Transaction
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;
    const commitRes = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: txId,
        writes
      })
    });

    if (!commitRes.ok) {
      throw new Error(`commit failed: ${await commitRes.text()}`);
    }

    return { success: true, user: userData, isNewUser };

  } catch (err) {
    // Attempt rollback on error
    try {
      const rollbackUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:rollback`;
      await fetch(rollbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transaction: txId
        })
      });
    } catch (e) {
      console.error("Rollback failed:", e);
    }
    throw err;
  }
}

// Cloudflare Worker Entry Point
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
        const authHeader = request.headers.get('Authorization') || '';
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
        }

        const result = await handleAuthAndReferral(authHeader, env);
        
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
