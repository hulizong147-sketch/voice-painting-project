import { useEffect } from 'react';
import {
  Download,
  ChartColumn,
  FileJson,
  FilePlus2,
  FileUp,
  FolderOpen,
  Grid2X2,
  House,
  Mic,
  MicOff,
  Redo2,
  RotateCcw,
  Shapes,
  Smile,
  Trash2,
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
  const snapEnabled = useDrawingStore((state) => state.snapEnabled);
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
          title="笑脸模板"
          onClick={() => void runCommand({ intent: 'draw_template', template: 'smiley' }, '画一个笑脸')}
        >
          <Smile size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="柱状图模板"
          onClick={() => void runCommand({ intent: 'draw_template', template: 'bar_chart' }, '画一个柱状图')}
        >
          <ChartColumn size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="房子模板"
          onClick={() => void runCommand({ intent: 'draw_template', template: 'house' }, '画一个房子')}
        >
          <House size={18} />
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
          className={snapEnabled ? 'tool-button active' : 'tool-button'}
          type="button"
          title={snapEnabled ? '关闭吸附' : '开启吸附'}
          onClick={() => void runCommand({ intent: 'toggle_snap' }, '切换吸附')}
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
        <button
          className="tool-button"
          type="button"
          title="导出 SVG"
          onClick={() => void runCommand({ intent: 'export_svg' }, '导出 SVG')}
        >
          <FileUp size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="保存 JSON"
          onClick={() => void runCommand({ intent: 'save_json' }, '保存 JSON')}
        >
          <FileJson size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="打开 JSON"
          onClick={() => void runCommand({ intent: 'open_json' }, '打开 JSON')}
        >
          <FolderOpen size={18} />
        </button>
      </div>
      <div className={showGrid ? 'canvas-stage show-grid' : 'canvas-stage'}>
        <canvas ref={canvasElementRef} aria-label="VoiceDraw canvas" />
      </div>
    </section>
  );
}
