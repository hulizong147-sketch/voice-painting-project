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
    const key = trimmed.slice(0, separator).trim().replace(/^\uFEFF/, '');
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
const TTS_URL = 'https://tsn.baidu.com/text2audio';
const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const RIGHT_CODES_DRAW_BASE_URL = 'https://www.right.codes/draw';
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

function sendAudio(response, contentType, payload) {
  response.writeHead(200, {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  });
  response.end(payload);
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
  const apiKey = process.env.BAIDU_API_KEY ?? process.env.BAIDU_ASR_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY ?? process.env.BAIDU_ASR_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error('Missing BAIDU_API_KEY/BAIDU_SECRET_KEY or BAIDU_ASR_API_KEY/BAIDU_ASR_SECRET_KEY');
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

async function synthesizeWithBaidu(body) {
  const text = String(body.text ?? '').trim();
  if (!text) {
    throw new Error('Missing text payload');
  }

  const token = await getAccessToken();
  const params = new URLSearchParams({
    tex: text.slice(0, 512),
    tok: token,
    cuid: process.env.BAIDU_TTS_CUID ?? process.env.BAIDU_ASR_CUID ?? 'voicedraw-web',
    ctp: '1',
    lan: 'zh',
    spd: String(process.env.BAIDU_TTS_SPD ?? 5),
    pit: String(process.env.BAIDU_TTS_PIT ?? 5),
    vol: String(process.env.BAIDU_TTS_VOL ?? 7),
    per: String(process.env.BAIDU_TTS_PER ?? 0),
    aue: String(process.env.BAIDU_TTS_AUE ?? 3),
  });

  const baiduResponse = await fetch(TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const contentType = baiduResponse.headers.get('content-type') ?? 'audio/mpeg';
  const payload = Buffer.from(await baiduResponse.arrayBuffer());

  if (!baiduResponse.ok || contentType.includes('application/json')) {
    let message = `Baidu TTS failed with HTTP ${baiduResponse.status}`;
    try {
      const data = JSON.parse(payload.toString('utf8'));
      message = data.err_msg ?? data.error_description ?? data.error ?? message;
    } catch {
      // Keep the HTTP-level message when Baidu does not return JSON.
    }
    throw new Error(message);
  }

  return {
    contentType,
    payload,
  };
}

function fallbackSketchDataUrl(prompt) {
  const safePrompt = String(prompt ?? 'anime character')
    .replace(/[<>&"']/g, '')
    .slice(0, 80);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="white"/>
  <g fill="none" stroke="#111" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M156 222C142 121 213 64 278 82C354 60 408 128 378 226"/>
    <path d="M172 208C150 296 188 382 258 394C338 382 380 296 354 206"/>
    <path d="M175 214C119 248 116 358 178 430"/>
    <path d="M357 214C416 254 405 360 334 430"/>
    <path d="M198 132C204 182 196 218 174 251"/>
    <path d="M250 102C228 172 238 223 265 252"/>
    <path d="M314 118C292 172 306 218 340 248"/>
    <path d="M204 245C224 222 254 224 270 246"/>
    <path d="M299 246C318 223 348 224 365 247"/>
    <path d="M226 260C226 295 252 296 252 260"/>
    <path d="M320 260C320 296 346 296 346 260"/>
    <path d="M276 280C268 309 270 323 286 328"/>
    <path d="M246 352C269 372 306 371 328 349"/>
    <path d="M204 336C224 326 244 331 258 348"/>
    <path d="M314 348C330 330 354 326 374 338"/>
    <path d="M226 398C196 423 158 436 128 472"/>
    <path d="M304 398C336 424 382 438 410 472"/>
  </g>
  <text x="256" y="500" text-anchor="middle" fill="#aaa" font-family="sans-serif" font-size="18">${safePrompt}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function imageUrlToDataUrl(url) {
  const imageResponse = await fetch(url);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image with HTTP ${imageResponse.status}`);
  }
  const contentType = imageResponse.headers.get('content-type') ?? 'image/png';
  const payload = Buffer.from(await imageResponse.arrayBuffer());
  return `data:${contentType};base64,${payload.toString('base64')}`;
}

function normalizeImageDataUrl(image) {
  if (image?.b64_json) {
    return `data:image/png;base64,${image.b64_json}`;
  }
  if (image?.url) {
    return imageUrlToDataUrl(image.url);
  }
  return null;
}

async function requestImageGeneration({ apiKey, baseUrl, model, prompt, size, responseFormat }) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const response = await fetch(`${normalizedBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });
  const data = await response.json();
  const image = data?.data?.[0];
  const imageDataUrl = await normalizeImageDataUrl(image);
  if (!response.ok || !imageDataUrl) {
    throw new Error(data?.error?.message ?? `Image generation failed with HTTP ${response.status}`);
  }
  return imageDataUrl;
}

async function generateSketchDraft(body) {
  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) {
    throw new Error('Missing sketch prompt');
  }

  const rightCodesApiKey = process.env.RIGHT_CODES_DRAW_API_KEY ?? process.env.RIGHT_CODES_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!rightCodesApiKey && !openAiApiKey) {
    return {
      imageDataUrl: fallbackSketchDataUrl(prompt),
      provider: 'fallback',
      prompt,
    };
  }

  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
  const imagePrompt = [
    'Clean black and white anime line art sketch on a white background.',
    'Use confident readable outlines, minimal shading, no text, no watermark.',
    `Subject: ${prompt}`,
  ].join(' ');

  if (rightCodesApiKey) {
    const rightCodesModel = process.env.RIGHT_CODES_DRAW_MODEL ?? process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';
    const imageDataUrl = await requestImageGeneration({
      apiKey: rightCodesApiKey,
      baseUrl: process.env.RIGHT_CODES_DRAW_BASE_URL ?? RIGHT_CODES_DRAW_BASE_URL,
      model: rightCodesModel,
      prompt: imagePrompt,
      size: process.env.RIGHT_CODES_DRAW_SIZE ?? process.env.OPENAI_IMAGE_SIZE ?? '1024x1024',
      responseFormat: process.env.RIGHT_CODES_DRAW_RESPONSE_FORMAT ?? 'url',
    });
    return {
      imageDataUrl,
      provider: 'right_codes',
      model: rightCodesModel,
      prompt,
    };
  }

  const imageDataUrl = await requestImageGeneration({
    apiKey: openAiApiKey,
    baseUrl: OPENAI_IMAGES_URL.replace(/\/v1\/images\/generations$/, ''),
    model,
    prompt: imagePrompt,
    size: process.env.OPENAI_IMAGE_SIZE ?? '1024x1024',
    responseFormat: 'b64_json',
  });
  return {
    imageDataUrl,
    provider: 'openai',
    model,
    prompt,
  };
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  try {
    const body = await readJson(request);
    if (request.url === '/api/asr/baidu') {
      const result = await transcribeWithBaidu(body);
      sendJson(response, 200, result);
      return;
    }
    if (request.url === '/api/tts/baidu') {
      const result = await synthesizeWithBaidu(body);
      sendAudio(response, result.contentType, result.payload);
      return;
    }
    if (request.url === '/api/sketch/draft') {
      const result = await generateSketchDraft(body);
      sendJson(response, 200, result);
      return;
    }
    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Unknown Baidu speech error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Baidu speech server listening on http://127.0.0.1:${PORT}`);
});
