import { useEffect } from 'react';
import { Download, Mic, MicOff, Redo2, RotateCcw, Shapes, Trash2 } from 'lucide-react';
import { useFabricCanvas } from '../hooks/useFabricCanvas';
import type { DrawingCommand } from '../types';
import { useDrawingStore } from '../store/drawingStore';

interface CanvasWorkspaceProps {
  onCommand: (command: DrawingCommand, text: string, result: string) => void;
  onToggleListening: () => void;
  onExecutorReady: (execute: (command: DrawingCommand) => Promise<string>) => void;
}

export function CanvasWorkspace({
  onCommand,
  onToggleListening,
  onExecutorReady,
}: CanvasWorkspaceProps) {
  const { canvasElementRef, executeCommand } = useFabricCanvas();
  const isListening = useDrawingStore((state) => state.isListening);
  const runCommand = async (command: DrawingCommand, text: string) => {
    const result = await executeCommand(command);
    onCommand(command, text, result);
  };

  useEffect(() => {
    onExecutorReady(executeCommand);
  }, [executeCommand, onExecutorReady]);

  return (
    <section className="canvas-area">
      <div className="canvas-toolbar" aria-label="画布工具">
        <button
          className={isListening ? 'tool-button active' : 'tool-button'}
          type="button"
          title={isListening ? '停止监听' : '开始监听'}
          onClick={onToggleListening}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          className="tool-button"
          type="button"
          title="画圆"
          onClick={() => void runCommand({ intent: 'draw_shape', shape: 'circle' }, '画一个圆')}
        >
          <Shapes size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="撤销"
          onClick={() => void runCommand({ intent: 'undo' }, '撤销')}
        >
          <RotateCcw size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="重做"
          onClick={() => void runCommand({ intent: 'redo' }, '重做')}
        >
          <Redo2 size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="清空画布"
          onClick={() => void runCommand({ intent: 'clear_canvas' }, '清空画布')}
        >
          <Trash2 size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="导出 PNG"
          onClick={() => void runCommand({ intent: 'export_png' }, '导出 PNG')}
        >
          <Download size={18} />
        </button>
      </div>
      <div className="canvas-stage">
        <canvas ref={canvasElementRef} aria-label="VoiceDraw canvas" />
      </div>
    </section>
  );
}
