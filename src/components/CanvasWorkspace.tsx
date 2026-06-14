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
import { drawingStyleOptions } from '../drawingStyles';
import type { DrawingCommand } from '../types';
import { useDrawingStore } from '../store/drawingStore';

const toolbarColors = [
  { label: '红色', value: '#cf5f45' },
  { label: '蓝色', value: '#316dca' },
  { label: '绿色', value: '#3f8f5f' },
  { label: '黄色', value: '#e3b341' },
  { label: '黑色', value: '#172018' },
];

const toolbarStrokeWidths = [1, 3, 6];

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
  const currentColor = useDrawingStore((state) => state.currentColor);
  const currentDrawingStyle = useDrawingStore((state) => state.currentDrawingStyle);
  const currentStrokeWidth = useDrawingStore((state) => state.currentStrokeWidth);
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
        <div className="toolbar-control-group" aria-label="快速颜色">
          {toolbarColors.map((color) => (
            <button
              className={currentColor === color.value ? 'color-swatch active' : 'color-swatch'}
              key={color.value}
              type="button"
              title={`切换为${color.label}`}
              onClick={() => void runCommand({ intent: 'set_color', color: color.value }, `换成${color.label}`)}
            >
              <span style={{ background: color.value }} />
            </button>
          ))}
        </div>
        <div className="toolbar-control-group" aria-label="画笔粗细">
          {toolbarStrokeWidths.map((width) => (
            <button
              className={currentStrokeWidth === width ? 'stroke-width-button active' : 'stroke-width-button'}
              key={width}
              type="button"
              title={`画笔 ${width}px`}
              onClick={() => void runCommand({ intent: 'set_stroke_width', width }, `画笔 ${width}`)}
            >
              {width}
            </button>
          ))}
        </div>
        <div className="style-control-group" aria-label="画风">
          {drawingStyleOptions.map((style) => (
            <button
              className={currentDrawingStyle === style.id ? 'style-button active' : 'style-button'}
              key={style.id}
              type="button"
              title={`切换到${style.label}画风`}
              onClick={() => void runCommand({ intent: 'set_drawing_style', style: style.id }, `切换到${style.label}画风`)}
            >
              {style.label}
            </button>
          ))}
        </div>
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
