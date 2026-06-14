export interface SketchDraftResponse {
  imageDataUrl: string;
  provider: 'openai' | 'fallback';
  model?: string;
  prompt: string;
}

export async function generateSketchDraft(prompt: string) {
  const response = await fetch('/api/sketch/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.imageDataUrl !== 'string') {
    throw new Error(data.error ?? 'AI 草稿生成失败');
  }
  return data as SketchDraftResponse;
}
