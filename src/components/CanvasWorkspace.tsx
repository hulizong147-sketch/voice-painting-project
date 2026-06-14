import { useEffect } from 'react';
import {
  Download,
  FilePlus2,
  FileUp,
  Grid2X2,
  Mic,
  MicOff,
  Redo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
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
  const showGrid = useDrawingStore((state) => state.showGrid);
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
          title="放大画布"
          onClick={() => void runCommand({ intent: 'zoom_canvas', factor: 1.2 }, '放大画布')}
        >
          <ZoomIn size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="缩小画布"
          onClick={() => void runCommand({ intent: 'zoom_canvas', factor: 0.8 }, '缩小画布')}
        >
          <ZoomOut size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="适应屏幕"
          onClick={() => void runCommand({ intent: 'fit_canvas' }, '适应屏幕')}
        >
          1:1
        </button>
        <button
          className={showGrid ? 'tool-button active' : 'tool-button'}
          type="button"
          title={showGrid ? '隐藏网格' : '显示网格'}
          onClick={() => void runCommand({ intent: 'toggle_grid' }, '切换网格')}
        >
          <Grid2X2 size={18} />
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
          title="新建画布"
          onClick={() => void runCommand({ intent: 'new_canvas' }, '新建画布')}
        >
          <FilePlus2 size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="导出 PNG"
          onClick={() => void runCommand({ intent: 'export_png' }, '导出 PNG')}
        >
          <Download size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="导出 SVG"
          onClick={() => void runCommand({ intent: 'export_svg' }, '导出 SVG')}
        >
          <FileUp size={18} />
        </button>
      </div>
      <div className={showGrid ? 'canvas-stage show-grid' : 'canvas-stage'}>
        <canvas ref={canvasElementRef} aria-label="VoiceDraw canvas" />
      </div>
    </section>
  );
}
