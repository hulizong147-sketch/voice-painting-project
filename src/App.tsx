import { useCallback, useEffect, useRef } from 'react';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { getDrawingStyleLabel } from './drawingStyles';
import type { DrawingCommand } from './types';
import { useDrawingStore } from './store/drawingStore';
import { parseCommands } from './nlu/parseCommand';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { speakFeedback } from './services/speechFeedback';

export function App() {
  const currentColor = useDrawingStore((state) => state.currentColor);
  const currentStrokeWidth = useDrawingStore((state) => state.currentStrokeWidth);
  const currentDrawingStyle = useDrawingStore((state) => state.currentDrawingStyle);
  const selectedCount = useDrawingStore((state) => state.selectedCount);
  const zoom = useDrawingStore((state) => state.zoom);
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
  const setFeedback = useDrawingStore((state) => state.setFeedback);
  const executeRef = useRef<(command: DrawingCommand) => Promise<string>>();

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
          setFeedback(`正在生成 AI 草稿并放到画布：${item.command.prompt}`);
        }
        if (item.command.intent === 'place_ai_draft_image') {
          setFeedback(`正在把 AI 草稿放到画布：${item.command.prompt}`);
        }
        if (item.command.intent === 'incremental_edit' && item.command.edit !== 'thicker_lines') {
          setFeedback('正在保留原图并添加局部图层...');
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
        <div className="brand-lockup">
          <p className="eyebrow">VoiceDraw</p>
          <h1>语音绘图工作台</h1>
          <p className="brand-subtitle">纯语音控制 · AI 草稿 · 画布编辑闭环</p>
        </div>
        <div className="status-pills" aria-label="当前绘图状态">
          <span className="color-pill">
            <span style={{ background: currentColor }} />
            当前颜色
          </span>
          <span>画笔 {currentStrokeWidth}px</span>
          <span>画风 {getDrawingStyleLabel(currentDrawingStyle)}</span>
          <span>选中 {selectedCount}</span>
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
                <span>在左上角画一个松鼠</span>
                <span>画一个房子</span>
                <span>在右边画一个二次元头像</span>
                <span>给它戴帽子</span>
                <span>切换成水墨画风</span>
                <span>以后用简笔画风</span>
              </div>
            ) : null}
          </section>
          <div className="command-list">
            <div className="command-list-header">
              <h2>命令历史</h2>
            </div>
            {commands.length === 0 ? (
              <p className="empty-copy">还没有命令。</p>
            ) : (
              commands.map((item) => (
                <article className="command-item" key={item.id}>
                  <div className="command-item-header">
                    <div className="command-item-meta">
                      <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
                      <span className={item.ok ? 'command-status success' : 'command-status error'}>
                        {item.ok ? '成功' : '失败'}
                      </span>
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
