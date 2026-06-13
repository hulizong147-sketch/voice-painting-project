import { CanvasWorkspace } from './components/CanvasWorkspace';
import type { DrawingCommand } from './types';
import { useDrawingStore } from './store/drawingStore';

export function App() {
  const currentColor = useDrawingStore((state) => state.currentColor);
  const currentStrokeWidth = useDrawingStore((state) => state.currentStrokeWidth);
  const selectedCount = useDrawingStore((state) => state.selectedCount);
  const isListening = useDrawingStore((state) => state.isListening);
  const transcript = useDrawingStore((state) => state.transcript);
  const feedback = useDrawingStore((state) => state.feedback);
  const commands = useDrawingStore((state) => state.commands);
  const setListening = useDrawingStore((state) => state.setListening);
  const addCommand = useDrawingStore((state) => state.addCommand);
  const setFeedback = useDrawingStore((state) => state.setFeedback);

  const handleCommand = (_command: DrawingCommand, text: string, result: string) => {
    addCommand({
      id: crypto.randomUUID(),
      text,
      result,
      createdAt: Date.now(),
      ok: !_command.intent.includes('unknown'),
    });
    setFeedback(result);
  };

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
        </div>
      </header>
      <section className="workspace">
        <CanvasWorkspace
          onCommand={handleCommand}
          onToggleListening={() => setListening(!isListening)}
        />
        <aside className="side-panel">
          <div className={isListening ? 'listening-card active' : 'listening-card'}>
            <span className="listen-dot" />
            <div>
              <h2>{isListening ? '正在监听' : '监听待机'}</h2>
              <p>{transcript || feedback}</p>
            </div>
          </div>
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
