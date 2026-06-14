import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, RotateCw } from 'lucide-react';
import { AiTracePreview } from './components/AiTracePreview';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { getDrawingStyleLabel } from './drawingStyles';
import type { CommandHistoryItem, DrawingCommand } from './types';
import { useDrawingStore } from './store/drawingStore';
import { parseCommands } from './nlu/parseCommand';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { speakFeedback } from './services/speechFeedback';

const normalizeImportedCommands = (value: unknown): CommandHistoryItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const candidate = item as Partial<CommandHistoryItem>;
      if (
        typeof candidate.text === 'string' &&
        typeof candidate.result === 'string' &&
        typeof candidate.createdAt === 'number' &&
        Number.isFinite(candidate.createdAt) &&
        typeof candidate.ok === 'boolean'
      ) {
        return [{
          id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : crypto.randomUUID(),
          text: candidate.text,
          result: candidate.result,
          createdAt: candidate.createdAt,
          ok: candidate.ok,
        }];
      }
      return [];
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 24);
};

export function App() {
  const currentColor = useDrawingStore((state) => state.currentColor);
  const currentStrokeColor = useDrawingStore((state) => state.currentStrokeColor);
  const currentStrokeWidth = useDrawingStore((state) => state.currentStrokeWidth);
  const currentOpacity = useDrawingStore((state) => state.currentOpacity);
  const currentDrawingStyle = useDrawingStore((state) => state.currentDrawingStyle);
  const selectedCount = useDrawingStore((state) => state.selectedCount);
  const showGrid = useDrawingStore((state) => state.showGrid);
  const snapEnabled = useDrawingStore((state) => state.snapEnabled);
  const zoom = useDrawingStore((state) => state.zoom);
  const freeDrawing = useDrawingStore((state) => state.freeDrawing);
  const isListening = useDrawingStore((state) => state.isListening);
  const listeningMode = useDrawingStore((state) => state.listeningMode);
  const speechEngine = useDrawingStore((state) => state.speechEngine);
  const helpVisible = useDrawingStore((state) => state.helpVisible);
  const transcript = useDrawingStore((state) => state.transcript);
  const feedback = useDrawingStore((state) => state.feedback);
  const commands = useDrawingStore((state) => state.commands);
  const setListening = useDrawingStore((state) => state.setListening);
  const setListeningMode = useDrawingStore((state) => state.setListeningMode);
  const setHelpVisible = useDrawingStore((state) => state.setHelpVisible);
  const addCommand = useDrawingStore((state) => state.addCommand);
  const setCommands = useDrawingStore((state) => state.setCommands);
  const clearCommands = useDrawingStore((state) => state.clearCommands);
  const setFeedback = useDrawingStore((state) => state.setFeedback);
  const [typedCommand, setTypedCommand] = useState('');
  const [commandHistoryQuery, setCommandHistoryQuery] = useState('');
  const executeRef = useRef<(command: DrawingCommand) => Promise<string>>();
  const visibleCommands = useMemo(() => {
    const query = commandHistoryQuery.trim().toLowerCase();
    if (!query) {
      return commands;
    }
    return commands.filter((item) => (
      item.text.toLowerCase().includes(query) ||
      item.result.toLowerCase().includes(query)
    ));
  }, [commandHistoryQuery, commands]);

  const handleCommand = useCallback((_command: DrawingCommand, text: string, result: string) => {
    if (_command.intent === 'show_help') {
      setHelpVisible(_command.visible ?? true);
    }
    addCommand({
      id: crypto.randomUUID(),
      text,
      result,
      createdAt: Date.now(),
      ok: !_command.intent.includes('unknown'),
    });
    setFeedback(result);
    void speakFeedback(result);
  }, [addCommand, setFeedback, setHelpVisible]);

  const runTextCommand = useCallback(
    async (text: string) => {
      const execute = executeRef.current;
      if (!execute) {
        setFeedback('画布尚未准备好');
        return;
      }
      const parsed = parseCommands(text);
      for (const item of parsed) {
        if (item.command.intent === 'ai_brush_draw') {
          setFeedback(`正在生成 AI 草稿并复刻画笔：${item.command.prompt}`);
        }
        if (item.command.intent === 'place_ai_draft_image') {
          setFeedback(`正在把 AI 草稿放到画布：${item.command.prompt}`);
        }
        if (item.command.intent === 'incremental_edit' && item.command.edit !== 'thicker_lines') {
          setFeedback('正在参考当前画板重新生成修改版...');
        }
        try {
          const result = await execute(item.command);
          handleCommand(item.command, item.text, result);
        } catch (error) {
          const result = error instanceof Error ? error.message : '命令执行失败';
          handleCommand({ intent: 'unknown', reason: result }, item.text, result);
        }
      }
    },
    [handleCommand, setFeedback],
  );

  const exportCommandHistory = useCallback(() => {
    const blob = new Blob([JSON.stringify(commands, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `voicedraw-command-history-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [commands]);

  const importCommandHistory = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      try {
        const parsed = JSON.parse(await file.text()) as unknown;
        const nextCommands = normalizeImportedCommands(parsed);
        if (nextCommands.length === 0) {
          setFeedback('没有导入有效的命令历史');
          return;
        }
        setCommands(nextCommands);
        setFeedback(`已导入 ${nextCommands.length} 条命令历史`);
      } catch {
        setFeedback('命令历史文件不是有效的 JSON');
      }
    };
    input.click();
  }, [setCommands, setFeedback]);

  const copyCommandText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback('已复制命令文本');
    } catch {
      setFeedback('复制命令文本失败');
    }
  }, [setFeedback]);

  const speech = useSpeechRecognition((text) => {
    void runTextCommand(text);
  });

  const toggleListening = useCallback(() => {
    if (isListening) {
      speech.stop();
    } else {
      speech.start();
    }
    setListening(!isListening);
  }, [isListening, setListening, speech]);

  useEffect(() => {
    if (listeningMode !== 'push_to_talk') {
      return;
    }

    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return element?.tagName === 'INPUT' || element?.tagName === 'TEXTAREA';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      if (!useDrawingStore.getState().isListening) {
        speech.start();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      speech.stop();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [listeningMode, speech]);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">VoiceDraw</p>
          <h1>语音绘图工作台</h1>
        </div>
        <div className="status-pills" aria-label="当前绘图状态">
          <span className="color-pill">
            <span style={{ background: currentColor }} />
            当前颜色
          </span>
          <span className="color-pill">
            <span style={{ background: currentStrokeColor }} />
            描边
          </span>
          <span>画笔 {currentStrokeWidth}px</span>
          <span>画风 {getDrawingStyleLabel(currentDrawingStyle)}</span>
          <span>透明度 {Math.round(currentOpacity * 100)}%</span>
          <span>选中 {selectedCount}</span>
          <span>{freeDrawing ? '自由画笔' : '对象模式'}</span>
          <span>{speechEngine === 'baidu' ? '百度 ASR' : speechEngine === 'browser' ? '浏览器语音' : '语音待机'}</span>
          <span>{showGrid ? '网格开' : '网格关'}</span>
          <span>{snapEnabled ? '吸附开' : '吸附关'}</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
      </header>
      <section className="workspace">
        <CanvasWorkspace
          onCommand={handleCommand}
          onExecutorReady={(execute) => {
            executeRef.current = execute;
          }}
          onToggleListening={toggleListening}
        />
        <aside className="side-panel">
          <div className={isListening ? 'listening-card active' : 'listening-card'}>
            <span className="listen-dot" />
            <div>
              <h2>{isListening ? (speechEngine === 'baidu' ? '百度语音监听' : '浏览器语音监听') : '监听待机'}</h2>
              <p>{transcript || feedback}</p>
            </div>
          </div>
          <div className="mode-toggle" aria-label="监听模式">
            <button
              className={listeningMode === 'continuous' ? 'active' : ''}
              type="button"
              onClick={() => setListeningMode('continuous')}
            >
              持续监听
            </button>
            <button
              className={listeningMode === 'push_to_talk' ? 'active' : ''}
              type="button"
              onClick={() => {
                if (isListening) {
                  speech.stop();
                }
                setListeningMode('push_to_talk');
                setFeedback('按住空格说话，松开停止。');
              }}
            >
              按住说话
            </button>
          </div>
          <section className={helpVisible ? 'help-panel' : 'help-panel collapsed'}>
            <button
              type="button"
              onClick={() => setHelpVisible(!helpVisible)}
              aria-expanded={helpVisible}
            >
              命令示例
            </button>
            {helpVisible ? (
              <div className="help-grid">
                <span>画一个红色的圆</span>
                <span>选中最左边的圆</span>
                <span>不对，改成蓝色</span>
                <span>把所有红色圆改成蓝色</span>
                <span>导出 SVG</span>
                <span>适应屏幕</span>
                <span>画一个流程图</span>
                <span>画一个房子</span>
                <span>画一个女人的头</span>
                <span>画一个二次元的人</span>
                <span>AI画笔画一个长发二次元少女头像</span>
                <span>切换成水墨画风</span>
                <span>以后用简笔画风</span>
              </div>
            ) : null}
          </section>
          <AiTracePreview
            executeCommand={executeRef.current}
            onCommand={handleCommand}
          />
          <form
            className="text-command"
            onSubmit={(event) => {
              event.preventDefault();
              void runTextCommand(typedCommand);
              setTypedCommand('');
            }}
          >
            <input
              aria-label="输入文本命令"
              placeholder="输入：画一个蓝色三角形"
              value={typedCommand}
              onChange={(event) => setTypedCommand(event.target.value)}
            />
            <button type="submit">执行</button>
          </form>
          <div className="command-list">
            <div className="command-list-header">
              <h2>命令历史</h2>
              <div className="command-list-actions">
                <button type="button" onClick={importCommandHistory}>
                  导入
                </button>
                <button type="button" onClick={exportCommandHistory} disabled={commands.length === 0}>
                  导出
                </button>
                <button type="button" onClick={clearCommands} disabled={commands.length === 0}>
                  清空
                </button>
              </div>
            </div>
            <input
              className="command-search"
              aria-label="筛选命令历史"
              placeholder="筛选历史"
              value={commandHistoryQuery}
              onChange={(event) => setCommandHistoryQuery(event.target.value)}
              disabled={commands.length === 0}
            />
            {commands.length === 0 ? (
              <p className="empty-copy">还没有命令。</p>
            ) : visibleCommands.length === 0 ? (
              <p className="empty-copy">没有匹配的命令历史。</p>
            ) : (
              visibleCommands.map((item) => (
                <article className="command-item" key={item.id}>
                  <div className="command-item-header">
                    <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
                    <div className="command-item-actions">
                      <button
                        aria-label={`复制命令：${item.text}`}
                        title="复制命令"
                        type="button"
                        onClick={() => void copyCommandText(item.text)}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        aria-label={`重新执行：${item.text}`}
                        title="重新执行"
                        type="button"
                        onClick={() => void runTextCommand(item.text)}
                      >
                        <RotateCw size={14} />
                      </button>
                    </div>
                  </div>
                  <strong>{item.text}</strong>
                  <p>{item.result}</p>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
