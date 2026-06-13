import { useCallback, useEffect, useRef } from 'react';
import {
  Canvas,
  Circle,
  FabricObject,
  Line,
  PencilBrush,
  Polygon,
  Rect,
  Triangle,
} from 'fabric';
import type { DrawingCommand, ShapeKind } from '../types';
import { useDrawingStore } from '../store/drawingStore';

type CanvasSnapshot = ReturnType<Canvas['toObject']>;

const defaultSizeByShape: Record<ShapeKind, number> = {
  circle: 120,
  rect: 130,
  triangle: 135,
  line: 180,
  star: 140,
};

function makeId() {
  return `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function withObjectId<T extends FabricObject>(object: T): T {
  object.set('id', makeId());
  return object;
}

function createStarPoints(radius: number) {
  const points = [];
  const inner = radius * 0.45;
  for (let index = 0; index < 10; index += 1) {
    const angle = Math.PI / 5 * index - Math.PI / 2;
    const currentRadius = index % 2 === 0 ? radius : inner;
    points.push({
      x: radius + Math.cos(angle) * currentRadius,
      y: radius + Math.sin(angle) * currentRadius,
    });
  }
  return points;
}

function createShape(command: Extract<DrawingCommand, { intent: 'draw_shape' }>) {
  const size = command.size ?? defaultSizeByShape[command.shape];
  const left = command.x ?? 280 + Math.random() * 160;
  const top = command.y ?? 180 + Math.random() * 140;
  const fill = command.color ?? '#cf5f45';
  const stroke = command.strokeColor ?? '#172018';
  const shared = {
    left,
    top,
    fill,
    stroke,
    strokeWidth: 3,
    originX: 'center' as const,
    originY: 'center' as const,
  };

  switch (command.shape) {
    case 'circle':
      return withObjectId(new Circle({ ...shared, radius: size / 2 }));
    case 'rect':
      return withObjectId(new Rect({ ...shared, width: size, height: size * 0.72, rx: 4, ry: 4 }));
    case 'triangle':
      return withObjectId(new Triangle({ ...shared, width: size, height: size }));
    case 'line':
      return withObjectId(
        new Line([-size / 2, 0, size / 2, 0], {
          left,
          top,
          stroke,
          strokeWidth: 6,
          originX: 'center',
          originY: 'center',
        }),
      );
    case 'star':
      return withObjectId(
        new Polygon(createStarPoints(size / 2), {
          ...shared,
          left: left - size / 2,
          top: top - size / 2,
          originX: 'left',
          originY: 'top',
        }),
      );
    default:
      return null;
  }
}

export function useFabricCanvas() {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const historyRef = useRef<CanvasSnapshot[]>([]);
  const redoRef = useRef<CanvasSnapshot[]>([]);
  const ignoreHistoryRef = useRef(false);
  const setSelectedCount = useDrawingStore((state) => state.setSelectedCount);
  const setColor = useDrawingStore((state) => state.setColor);
  const setFreeDrawing = useDrawingStore((state) => state.setFreeDrawing);
  const setShowGrid = useDrawingStore((state) => state.setShowGrid);
  const setStrokeWidth = useDrawingStore((state) => state.setStrokeWidth);
  const storeColor = useDrawingStore((state) => state.currentColor);
  const storeStrokeColor = useDrawingStore((state) => state.currentStrokeColor);
  const storeStrokeWidth = useDrawingStore((state) => state.currentStrokeWidth);
  const showGrid = useDrawingStore((state) => state.showGrid);

  const pushHistory = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || ignoreHistoryRef.current) {
      return;
    }
    historyRef.current.push(canvas.toObject(['id']));
    if (historyRef.current.length > 80) {
      historyRef.current.shift();
    }
    redoRef.current = [];
  }, []);

  const loadSnapshot = useCallback(async (snapshot: CanvasSnapshot) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }
    ignoreHistoryRef.current = true;
    await canvas.loadFromJSON(snapshot);
    canvas.renderAll();
    ignoreHistoryRef.current = false;
  }, []);

  const executeCommand = useCallback(
    async (command: DrawingCommand): Promise<string> => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) {
        return '画布尚未准备好';
      }

      if (command.intent === 'set_color') {
        setColor(command.color);
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach((object) => object.set({ fill: command.color }));
          canvas.requestRenderAll();
          pushHistory();
          return '已修改选中图形颜色';
        }
        return '已切换当前颜色';
      }

      if (command.intent === 'set_stroke_width') {
        const width = Math.max(1, Math.min(24, command.width));
        setStrokeWidth(width);
        canvas.getActiveObjects().forEach((object) => object.set({ strokeWidth: width }));
        canvas.requestRenderAll();
        pushHistory();
        return `画笔粗细已设为 ${width}`;
      }

      if (command.intent === 'select_all') {
        canvas.discardActiveObject();
        canvas.getObjects().forEach((object) => object.set({ active: true }));
        canvas.requestRenderAll();
        setSelectedCount(canvas.getObjects().length);
        return '已选中全部对象';
      }

      if (command.intent === 'delete_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '没有选中的对象';
        }
        activeObjects.forEach((object) => canvas.remove(object));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setSelectedCount(0);
        pushHistory();
        return '已删除选中对象';
      }

      if (command.intent === 'move_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => {
          object.set({
            left: (object.left ?? 0) + command.dx,
            top: (object.top ?? 0) + command.dy,
          });
          object.setCoords();
        });
        canvas.requestRenderAll();
        pushHistory();
        return '已移动选中对象';
      }

      if (command.intent === 'scale_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => {
          object.scale((object.scaleX ?? 1) * command.factor);
          object.setCoords();
        });
        canvas.requestRenderAll();
        pushHistory();
        return '已缩放选中对象';
      }

      if (command.intent === 'rotate_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => {
          object.rotate((object.angle ?? 0) + command.angle);
          object.setCoords();
        });
        canvas.requestRenderAll();
        pushHistory();
        return '已旋转选中对象';
      }

      if (command.intent === 'bring_forward') {
        canvas.getActiveObjects().forEach((object) => canvas.bringObjectForward(object));
        canvas.requestRenderAll();
        pushHistory();
        return '已上移一层';
      }

      if (command.intent === 'send_backward') {
        canvas.getActiveObjects().forEach((object) => canvas.sendObjectBackwards(object));
        canvas.requestRenderAll();
        pushHistory();
        return '已下移一层';
      }

      if (command.intent === 'set_free_drawing') {
        canvas.isDrawingMode = command.enabled;
        if (!canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush = new PencilBrush(canvas);
        }
        canvas.freeDrawingBrush.color = storeColor;
        canvas.freeDrawingBrush.width = storeStrokeWidth;
        setFreeDrawing(command.enabled);
        return command.enabled ? '已开始自由绘制' : '已停止自由绘制';
      }

      if (command.intent === 'toggle_grid') {
        const enabled = command.enabled ?? !showGrid;
        setShowGrid(enabled);
        return enabled ? '已显示网格' : '已隐藏网格';
      }

      if (command.intent === 'draw_shape') {
        const object = createShape({
          ...command,
          color: command.color ?? storeColor,
          strokeColor: command.strokeColor ?? storeStrokeColor,
        });
        if (!object) {
          return '暂不支持这个图形';
        }
        object.set({ strokeWidth: storeStrokeWidth });
        canvas.add(object);
        canvas.setActiveObject(object);
        canvas.requestRenderAll();
        pushHistory();
        return '已绘制图形';
      }

      if (command.intent === 'clear_canvas') {
        canvas.getObjects().forEach((object) => canvas.remove(object));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        pushHistory();
        return '画布已清空';
      }

      if (command.intent === 'undo') {
        if (historyRef.current.length <= 1) {
          return '没有可撤销的操作';
        }
        const current = historyRef.current.pop();
        if (current) {
          redoRef.current.push(current);
        }
        const previous = historyRef.current[historyRef.current.length - 1];
        if (previous) {
          await loadSnapshot(previous);
        }
        return '已撤销';
      }

      if (command.intent === 'redo') {
        const snapshot = redoRef.current.pop();
        if (!snapshot) {
          return '没有可重做的操作';
        }
        await loadSnapshot(snapshot);
        historyRef.current.push(snapshot);
        return '已重做';
      }

      if (command.intent === 'export_png') {
        const link = document.createElement('a');
        link.download = `voicedraw-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
        link.href = canvas.toDataURL({ format: 'png', multiplier: 2 });
        link.click();
        return '已导出 PNG';
      }

      return command.reason;
    },
    [
      loadSnapshot,
      pushHistory,
      setColor,
      setStrokeWidth,
      storeColor,
      storeStrokeColor,
      storeStrokeWidth,
    ],
  );

  useEffect(() => {
    const element = canvasElementRef.current;
    const stage = element?.parentElement;
    if (!element || !stage) {
      return;
    }

    const canvas = new Canvas(element, {
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
    });
    fabricCanvasRef.current = canvas;

    const resize = () => {
      const bounds = stage.getBoundingClientRect();
      const style = window.getComputedStyle(stage);
      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      canvas.setDimensions({
        width: Math.max(320, bounds.width - horizontalPadding),
        height: Math.max(420, bounds.height - verticalPadding),
      });
      canvas.requestRenderAll();
    };

    const updateSelection = () => setSelectedCount(canvas.getActiveObjects().length);
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    pushHistory();

    canvas.on('selection:created', updateSelection);
    canvas.on('selection:updated', updateSelection);
    canvas.on('selection:cleared', updateSelection);
    canvas.on('object:modified', pushHistory);
    canvas.on('path:created', pushHistory);

    return () => {
      observer.disconnect();
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [pushHistory, setSelectedCount]);

  return { canvasElementRef, executeCommand };
}
