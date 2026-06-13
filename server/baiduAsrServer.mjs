import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync } from 'node:fs';

function loadDotEnv() {
  if (!existsSync('.env')) {
    return;
  }
  const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const PORT = Number(process.env.BAIDU_ASR_PORT ?? 3001);
const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const ASR_URL = 'https://vop.baidu.com/server_api';
const TOKEN_REFRESH_WINDOW_MS = 60 * 60 * 1000;

let cachedToken = null;

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

async function getAccessToken() {
  const apiKey = process.env.BAIDU_ASR_API_KEY;
  const secretKey = process.env.BAIDU_ASR_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error('Missing BAIDU_ASR_API_KEY or BAIDU_ASR_SECRET_KEY');
  }

  if (cachedToken && cachedToken.expiresAt - Date.now() > TOKEN_REFRESH_WINDOW_MS) {
    return cachedToken.value;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: apiKey,
    client_secret: secretKey,
  });
  const response = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Failed to fetch Baidu access token');
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 0) * 1000,
  };
  return cachedToken.value;
}

async function transcribeWithBaidu(body) {
  const speech = String(body.speech ?? '');
  if (!speech) {
    throw new Error('Missing speech payload');
  }

  const token = await getAccessToken();
  const audioBuffer = Buffer.from(speech, 'base64');
  const payload = {
    speech,
    format: body.format ?? 'wav',
    rate: Number(body.rate ?? 16000),
    channel: 1,
    cuid: process.env.BAIDU_ASR_CUID ?? 'voicedraw-web',
    token,
    len: audioBuffer.length,
    dev_pid: Number(process.env.BAIDU_ASR_DEV_PID ?? 1537),
  };

  const response = await fetch(ASR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.err_no !== 0) {
    throw new Error(data.err_msg ?? `Baidu ASR failed with err_no ${data.err_no}`);
  }

  return {
    text: Array.isArray(data.result) ? data.result.join('').trim() : '',
    raw: data,
  };
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== 'POST' || request.url !== '/api/asr/baidu') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  try {
    const body = await readJson(request);
    const result = await transcribeWithBaidu(body);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Unknown ASR error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Baidu ASR server listening on http://127.0.0.1:${PORT}`);
});
