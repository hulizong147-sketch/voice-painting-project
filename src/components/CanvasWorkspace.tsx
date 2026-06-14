import { useEffect } from 'react';
import {
  Download,
  ChartColumn,
  ClipboardPaste,
  Copy,
  Eraser,
  FileJson,
  FilePlus2,
  FileUp,
  FolderOpen,
  Grid2X2,
  House,
  Lock,
  Mic,
  MicOff,
  Pencil,
  Redo2,
  RotateCcw,
  Scan,
  Shapes,
  Smile,
  Trash2,
  Ungroup,
  Unlock,
  Workflow,
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
  const snapEnabled = useDrawingStore((state) => state.snapEnabled);
  const freeDrawing = useDrawingStore((state) => state.freeDrawing);
  const selectedCount = useDrawingStore((state) => state.selectedCount);
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
        <button
          className="tool-button"
          type="button"
          title="画圆"
          onClick={() => void runCommand({ intent: 'draw_shape', shape: 'circle' }, '画一个圆')}
        >
          <Shapes size={18} />
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
          className={freeDrawing ? 'tool-button active' : 'tool-button'}
          type="button"
          title={freeDrawing ? '停止自由绘制' : '开始自由绘制'}
          onClick={() => void runCommand({ intent: 'set_free_drawing', enabled: !freeDrawing }, freeDrawing ? '停笔' : '开始画')}
        >
          <Pencil size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="选择全部"
          onClick={() => void runCommand({ intent: 'select_all' }, '选择全部')}
        >
          <Scan size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="复制选中"
          disabled={selectedCount === 0}
          onClick={() => void runCommand({ intent: 'copy_selected' }, '复制选中')}
        >
          <Copy size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="粘贴"
          onClick={() => void runCommand({ intent: 'paste_selected' }, '粘贴')}
        >
          <ClipboardPaste size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="删除选中"
          disabled={selectedCount === 0}
          onClick={() => void runCommand({ intent: 'delete_selected' }, '删除选中')}
        >
          <Eraser size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="组合选中"
          disabled={selectedCount < 2}
          onClick={() => void runCommand({ intent: 'group_selected' }, '组合选中')}
        >
          <Workflow size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="取消组合"
          disabled={selectedCount === 0}
          onClick={() => void runCommand({ intent: 'ungroup_selected' }, '取消组合')}
        >
          <Ungroup size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="锁定选中"
          disabled={selectedCount === 0}
          onClick={() => void runCommand({ intent: 'lock_selected', locked: true }, '锁定选中')}
        >
          <Lock size={18} />
        </button>
        <button
          className="tool-button"
          type="button"
          title="解锁选中"
          disabled={selectedCount === 0}
          onClick={() => void runCommand({ intent: 'lock_selected', locked: false }, '解锁选中')}
        >
          <Unlock size={18} />
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
