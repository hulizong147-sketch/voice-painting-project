import { useCallback, useRef, useState } from 'react';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import type { DrawingCommand } from './types';
import { useDrawingStore } from './store/drawingStore';
import { parseCommands } from './nlu/parseCommand';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

export function App() {
  const currentColor = useDrawingStore((state) => state.currentColor);
  const currentStrokeWidth = useDrawingStore((state) => state.currentStrokeWidth);
  const selectedCount = useDrawingStore((state) => state.selectedCount);
  const showGrid = useDrawingStore((state) => state.showGrid);
  const snapEnabled = useDrawingStore((state) => state.snapEnabled);
  const zoom = useDrawingStore((state) => state.zoom);
  const freeDrawing = useDrawingStore((state) => state.freeDrawing);
  const isListening = useDrawingStore((state) => state.isListening);
  const transcript = useDrawingStore((state) => state.transcript);
  const feedback = useDrawingStore((state) => state.feedback);
  const commands = useDrawingStore((state) => state.commands);
  const setListening = useDrawingStore((state) => state.setListening);
  const addCommand = useDrawingStore((state) => state.addCommand);
  const setFeedback = useDrawingStore((state) => state.setFeedback);
  const [typedCommand, setTypedCommand] = useState('');
  const executeRef = useRef<(command: DrawingCommand) => Promise<string>>();

  const handleCommand = useCallback((_command: DrawingCommand, text: string, result: string) => {
    addCommand({
      id: crypto.randomUUID(),
      text,
      result,
      createdAt: Date.now(),
      ok: !_command.intent.includes('unknown'),
    });
    setFeedback(result);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(result));
    }
  }, [addCommand, setFeedback]);

  const runTextCommand = useCallback(
    async (text: string) => {
      const execute = executeRef.current;
      if (!execute) {
        setFeedback('画布尚未准备好');
        return;
      }
      const parsed = parseCommands(text);
      for (const item of parsed) {
        const result = await execute(item.command);
        handleCommand(item.command, item.text, result);
      }
    },
    [handleCommand, setFeedback],
  );

  const speech = useSpeechRecognition((text) => {
    void runTextCommand(text);
  });

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
          <span>画笔 {currentStrokeWidth}px</span>
          <span>选中 {selectedCount}</span>
          <span>{freeDrawing ? '自由画笔' : '对象模式'}</span>
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
          onToggleListening={() => {
            if (isListening) {
              speech.stop();
            } else {
              speech.start();
            }
            setListening(!isListening);
          }}
        />
        <aside className="side-panel">
          <div className={isListening ? 'listening-card active' : 'listening-card'}>
            <span className="listen-dot" />
            <div>
              <h2>{isListening ? '正在监听' : '监听待机'}</h2>
              <p>{transcript || feedback}</p>
            </div>
          </div>
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
            <h2>命令历史</h2>
            {commands.length === 0 ? (
              <p className="empty-copy">还没有命令。</p>
            ) : (
              commands.map((item) => (
                <article className="command-item" key={item.id}>
                  <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
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
