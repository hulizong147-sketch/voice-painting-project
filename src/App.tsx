export function App() {
  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">VoiceDraw</p>
          <h1>语音绘图工作台</h1>
        </div>
      </header>
      <section className="workspace">
        <div className="canvas-stage">
          <canvas aria-label="VoiceDraw canvas" />
        </div>
        <aside className="side-panel">
          <h2>命令历史</h2>
        </aside>
      </section>
    </main>
  );
}
