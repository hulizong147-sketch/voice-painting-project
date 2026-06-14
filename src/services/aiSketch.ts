export interface SketchDraftResponse {
  imageDataUrl: string;
  provider: 'right_codes' | 'openai' | 'fallback';
  model?: string;
  prompt: string;
}

export async function generateSketchDraft(prompt: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await fetch('/api/sketch/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.imageDataUrl !== 'string') {
      throw new Error(data.error ?? 'AI 草稿生成失败');
    }
    return data as SketchDraftResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI 草稿生成超时，请稍后再试或换一个更简单的描述');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
