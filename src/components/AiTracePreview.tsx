import { useMemo, useState } from 'react';
import { Image, PenLine, Play, SendToBack } from 'lucide-react';
import { generateSketchDraft, type SketchDraftResponse } from '../services/aiSketch';
import { traceDraftToPathCommands, type TracedDraftPath } from '../services/traceDraft';
import type { DrawingCommand } from '../types';

interface AiTracePreviewProps {
  onCommand: (command: DrawingCommand, text: string, result: string) => void;
  executeCommand?: (command: DrawingCommand) => Promise<string>;
}

const draftProviderLabels: Record<SketchDraftResponse['provider'], string> = {
  right_codes: 'Right Code AI',
  openai: 'OpenAI',
  fallback: '本地测试草稿',
};

export function AiTracePreview({ executeCommand, onCommand }: AiTracePreviewProps) {
  const [prompt, setPrompt] = useState('长发二次元少女头像线稿');
  const [draft, setDraft] = useState<SketchDraftResponse | null>(null);
  const [paths, setPaths] = useState<TracedDraftPath[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('先生成草稿，再看右侧如何描改。');

  const previewPaths = useMemo(() => {
    if (paths.length === 0) {
      return null;
    }
    return paths.map((item, index) => (
      <path
        d={item.path}
        fill="none"
        key={`${index}-${item.path.slice(0, 24)}`}
        stroke="#172018"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={item.strokeWidth}
      />
    ));
  }, [paths]);

  const runPreview = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setMessage('先输入一个提示词。');
      return;
    }
    setBusy(true);
    setMessage('正在生成 AI 草稿...');
    setDraft(null);
    setPaths([]);
    try {
      const nextDraft = await generateSketchDraft(trimmed);
      setDraft(nextDraft);
      setMessage('草稿已生成，正在追踪轮廓...');
      const nextPaths = await traceDraftToPathCommands(nextDraft.imageDataUrl, 220, 220);
      setPaths(nextPaths);
      setMessage(`已完成描改预览：${nextPaths.length} 条路径，来源 ${draftProviderLabels[nextDraft.provider]}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI 描改预览失败');
    } finally {
      setBusy(false);
    }
  };

  const sendToCanvas = async () => {
    if (!executeCommand || !prompt.trim()) {
      return;
    }
    setBusy(true);
    setMessage('正在放入主画布...');
    const command: DrawingCommand = { intent: 'ai_brush_draw', prompt: prompt.trim() };
    try {
      const result = await executeCommand(command);
      onCommand(command, `AI画笔画${prompt.trim()}`, result);
      setMessage(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '放入主画布失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ai-trace-preview">
      <div className="ai-trace-header">
        <h2>AI 描改测试</h2>
        <span>{message}</span>
      </div>
      <div className="ai-trace-controls">
        <input
          aria-label="AI 描改提示词"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="例如：长发二次元少女头像线稿"
        />
        <button type="button" onClick={() => void runPreview()} disabled={busy}>
          <Play size={15} />
          生成预览
        </button>
        <button type="button" onClick={() => void sendToCanvas()} disabled={busy || !executeCommand}>
          <SendToBack size={15} />
          放到画布
        </button>
      </div>
      <div className="ai-trace-panels">
        <div className="ai-trace-panel">
          <div className="ai-trace-panel-title">
            <Image size={15} />
            AI 草稿
          </div>
          {draft ? <img alt="AI 草稿" src={draft.imageDataUrl} /> : <div className="ai-trace-empty">等待生成</div>}
        </div>
        <div className="ai-trace-panel">
          <div className="ai-trace-panel-title">
            <PenLine size={15} />
            描改路径
          </div>
          {previewPaths ? (
            <svg viewBox="0 0 440 440" role="img" aria-label="AI 描改路径预览">
              {previewPaths}
            </svg>
          ) : (
            <div className="ai-trace-empty">等待追踪</div>
          )}
        </div>
      </div>
    </section>
  );
}
