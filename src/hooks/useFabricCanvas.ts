import { useCallback, useEffect, useRef } from 'react';
import {
  ActiveSelection,
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
type SemanticObject = FabricObject & {
  semanticShape?: ShapeKind;
  fill?: string;
};

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

function withSemanticShape<T extends FabricObject>(object: T, shape: ShapeKind): T {
  object.set('semanticShape', shape);
  return withObjectId(object);
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
      return withSemanticShape(new Circle({ ...shared, radius: size / 2 }), 'circle');
    case 'rect':
      return withSemanticShape(
        new Rect({ ...shared, width: size, height: size * 0.72, rx: 4, ry: 4 }),
        'rect',
      );
    case 'triangle':
      return withSemanticShape(new Triangle({ ...shared, width: size, height: size }), 'triangle');
    case 'line':
      return withSemanticShape(
        new Line([-size / 2, 0, size / 2, 0], {
          left,
          top,
          stroke,
          strokeWidth: 6,
          originX: 'center',
          originY: 'center',
        }),
        'line',
      );
    case 'star':
      return withSemanticShape(
        new Polygon(createStarPoints(size / 2), {
          ...shared,
          left: left - size / 2,
          top: top - size / 2,
          originX: 'left',
          originY: 'top',
        }),
        'star',
      );
    default:
      return null;
  }
}

function getObjectCenter(object: FabricObject) {
  const center = object.getCenterPoint();
  return { x: center.x, y: center.y };
}

function pickByPosition(objects: SemanticObject[], position?: 'leftmost' | 'rightmost' | 'topmost' | 'bottommost') {
  if (!position || objects.length <= 1) {
    return objects;
  }
  const sorted = [...objects].sort((a, b) => {
    const aCenter = getObjectCenter(a);
    const bCenter = getObjectCenter(b);
    if (position === 'leftmost') {
      return aCenter.x - bCenter.x;
    }
    if (position === 'rightmost') {
      return bCenter.x - aCenter.x;
    }
    if (position === 'topmost') {
      return aCenter.y - bCenter.y;
    }
    return bCenter.y - aCenter.y;
  });
  return [sorted[0]];
}

function createSmiley(centerX: number, centerY: number) {
  const face = withSemanticShape(
    new Circle({
      left: centerX,
      top: centerY,
      radius: 90,
      fill: '#ffcc00',
      stroke: '#172018',
      strokeWidth: 4,
      originX: 'center',
      originY: 'center',
    }),
    'circle',
  );
  const eyeOptions = {
    radius: 10,
    fill: '#172018',
    strokeWidth: 0,
    originX: 'center' as const,
    originY: 'center' as const,
  };
  const leftEye = withSemanticShape(new Circle({ ...eyeOptions, left: centerX - 34, top: centerY - 28 }), 'circle');
  const rightEye = withSemanticShape(new Circle({ ...eyeOptions, left: centerX + 34, top: centerY - 28 }), 'circle');
  const mouth = withSemanticShape(
    new Line([centerX - 42, centerY + 36, centerX + 42, centerY + 36], {
      stroke: '#172018',
      strokeWidth: 8,
      strokeLineCap: 'round',
    }),
    'line',
  );
  return [face, leftEye, rightEye, mouth];
}

function createBarChart(centerX: number, centerY: number) {
  const heights = [80, 132, 104, 164];
  return heights.map((height, index) =>
    withSemanticShape(
      new Rect({
        left: centerX - 135 + index * 78,
        top: centerY + 90 - height,
        width: 48,
        height,
        fill: ['#0a84ff', '#34c759', '#ff9500', '#af52de'][index],
        stroke: '#172018',
        strokeWidth: 3,
        rx: 4,
        ry: 4,
      }),
      'rect',
    ),
  );
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
    historyRef.current.push(canvas.toObject(['id', 'semanticShape']));
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
        const objects = canvas.getObjects();
        canvas.discardActiveObject();
        if (objects.length === 1) {
          canvas.setActiveObject(objects[0]);
        } else if (objects.length > 1) {
          canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
        }
        canvas.requestRenderAll();
        setSelectedCount(objects.length);
        return '已选中全部对象';
      }

      if (command.intent === 'select_by_description') {
        const candidates = canvas.getObjects().filter((object) => {
          const semanticObject = object as SemanticObject;
          const shapeMatches = !command.shape || semanticObject.semanticShape === command.shape;
          const colorMatches = !command.color || String(semanticObject.fill).toLowerCase() === command.color.toLowerCase();
          return shapeMatches && colorMatches;
        }) as SemanticObject[];
        const matches = pickByPosition(candidates, command.position);
        canvas.discardActiveObject();
        if (matches.length === 0) {
          canvas.requestRenderAll();
          setSelectedCount(0);
          return '没有找到匹配的对象';
        }
        if (matches.length === 1) {
          canvas.setActiveObject(matches[0]);
        } else {
          canvas.setActiveObject(new ActiveSelection(matches, { canvas }));
        }
        canvas.requestRenderAll();
        setSelectedCount(matches.length);
        return `已选中 ${matches.length} 个对象`;
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
        const activeObject = canvas.getActiveObject();
        const relativeCenter = activeObject ? getObjectCenter(activeObject) : null;
        const resolvedCommand = { ...command };
        if (command.x === undefined && command.y === undefined && relativeCenter) {
          resolvedCommand.x = relativeCenter.x + 150;
          resolvedCommand.y = relativeCenter.y;
        }
        const object = createShape({
          ...resolvedCommand,
          color: resolvedCommand.color ?? storeColor,
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

      if (command.intent === 'draw_template') {
        const center = canvas.getActiveObject()
          ? getObjectCenter(canvas.getActiveObject()!)
          : { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
        const objects =
          command.template === 'smiley'
            ? createSmiley(center.x, center.y)
            : createBarChart(center.x, center.y);
        objects.forEach((object) => canvas.add(object));
        canvas.discardActiveObject();
        canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
        canvas.requestRenderAll();
        pushHistory();
        return command.template === 'smiley' ? '已绘制笑脸模板' : '已绘制柱状图模板';
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
