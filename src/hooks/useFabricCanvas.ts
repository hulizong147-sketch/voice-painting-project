import { useCallback, useEffect, useRef } from 'react';
import {
  ActiveSelection,
  Canvas,
  Circle,
  FabricObject,
  Group,
  Line,
  PencilBrush,
  Point,
  Polygon,
  Rect,
  Triangle,
} from 'fabric';
import type { DrawingCommand, ShapeKind } from '../types';
import { useDrawingStore } from '../store/drawingStore';

type CanvasSnapshot = ReturnType<Canvas['toObject']>;
type CanvasJson = ReturnType<Canvas['toObject']>;
const persistedObjectProps = [
  'id',
  'semanticShape',
  'lockMovementX',
  'lockMovementY',
  'lockRotation',
  'lockScalingX',
  'lockScalingY',
  'hasControls',
];
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

function getObjectBounds(object: FabricObject) {
  const rect = object.getBoundingRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
  };
}

function getObjectId(object: FabricObject) {
  return String(object.get('id') ?? '');
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

function createSun(centerX: number, centerY: number) {
  const rays = Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 12;
    const inner = 78;
    const outer = 122;
    return withSemanticShape(
      new Line(
        [
          centerX + Math.cos(angle) * inner,
          centerY + Math.sin(angle) * inner,
          centerX + Math.cos(angle) * outer,
          centerY + Math.sin(angle) * outer,
        ],
        {
          stroke: '#ff9500',
          strokeWidth: 7,
          strokeLineCap: 'round',
        },
      ),
      'line',
    );
  });
  const core = withSemanticShape(
    new Circle({
      left: centerX,
      top: centerY,
      radius: 62,
      fill: '#ffcc00',
      stroke: '#ff9500',
      strokeWidth: 5,
      originX: 'center',
      originY: 'center',
    }),
    'circle',
  );
  return [...rays, core];
}

function createHouse(centerX: number, centerY: number) {
  const roof = withSemanticShape(
    new Triangle({
      left: centerX,
      top: centerY - 86,
      width: 190,
      height: 120,
      fill: '#cf5f45',
      stroke: '#172018',
      strokeWidth: 4,
      originX: 'center',
      originY: 'center',
    }),
    'triangle',
  );
  const body = withSemanticShape(
    new Rect({
      left: centerX - 75,
      top: centerY - 20,
      width: 150,
      height: 130,
      fill: '#f5f0df',
      stroke: '#172018',
      strokeWidth: 4,
      rx: 4,
      ry: 4,
    }),
    'rect',
  );
  const door = withSemanticShape(
    new Rect({
      left: centerX - 20,
      top: centerY + 38,
      width: 40,
      height: 72,
      fill: '#166c5d',
      stroke: '#172018',
      strokeWidth: 3,
      rx: 3,
      ry: 3,
    }),
    'rect',
  );
  const windowObject = withSemanticShape(
    new Rect({
      left: centerX + 34,
      top: centerY + 8,
      width: 42,
      height: 36,
      fill: '#87ceeb',
      stroke: '#172018',
      strokeWidth: 3,
      rx: 3,
      ry: 3,
    }),
    'rect',
  );
  return [roof, body, door, windowObject];
}

function createFlowchart(centerX: number, centerY: number) {
  const nodeStyle = {
    width: 150,
    height: 58,
    fill: '#ffffff',
    stroke: '#166c5d',
    strokeWidth: 4,
    rx: 8,
    ry: 8,
    originX: 'center' as const,
    originY: 'center' as const,
  };
  const nodes = [-110, 0, 110].map((offset, index) =>
    withSemanticShape(
      new Rect({
        ...nodeStyle,
        left: centerX,
        top: centerY + offset,
        fill: ['#eef7f2', '#fff7ed', '#eef3ff'][index],
      }),
      'rect',
    ),
  );
  const connectors = [-55, 55].map((offset) =>
    withSemanticShape(
      new Line([centerX, centerY + offset - 24, centerX, centerY + offset + 24], {
        stroke: '#172018',
        strokeWidth: 5,
        strokeLineCap: 'round',
      }),
      'line',
    ),
  );
  return [...nodes, ...connectors];
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

function timestampedName(prefix: string, extension: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extension}`;
}

function readJsonFile(): Promise<CanvasJson | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result)) as CanvasJson);
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

export function useFabricCanvas() {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const historyRef = useRef<CanvasSnapshot[]>([]);
  const redoRef = useRef<CanvasSnapshot[]>([]);
  const lastTouchedIdsRef = useRef<string[]>([]);
  const clipboardObjectsRef = useRef<FabricObject[]>([]);
  const ignoreHistoryRef = useRef(false);
  const setSelectedCount = useDrawingStore((state) => state.setSelectedCount);
  const setColor = useDrawingStore((state) => state.setColor);
  const setFreeDrawing = useDrawingStore((state) => state.setFreeDrawing);
  const setOpacity = useDrawingStore((state) => state.setOpacity);
  const setSnapEnabled = useDrawingStore((state) => state.setSnapEnabled);
  const setStrokeColor = useDrawingStore((state) => state.setStrokeColor);
  const setShowGrid = useDrawingStore((state) => state.setShowGrid);
  const setStrokeWidth = useDrawingStore((state) => state.setStrokeWidth);
  const setZoom = useDrawingStore((state) => state.setZoom);
  const storeColor = useDrawingStore((state) => state.currentColor);
  const storeOpacity = useDrawingStore((state) => state.currentOpacity);
  const storeStrokeColor = useDrawingStore((state) => state.currentStrokeColor);
  const storeStrokeWidth = useDrawingStore((state) => state.currentStrokeWidth);
  const snapEnabled = useDrawingStore((state) => state.snapEnabled);
  const showGrid = useDrawingStore((state) => state.showGrid);

  const pushHistory = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || ignoreHistoryRef.current) {
      return;
    }
    historyRef.current.push(canvas.toObject(persistedObjectProps));
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

  const cloneObjects = useCallback(async (objects: FabricObject[], offset = 0) => {
    const clones = await Promise.all(objects.map((object) => object.clone(['semanticShape'])));
    clones.forEach((clone) => {
      clone.set({
        left: (clone.left ?? 0) + offset,
        top: (clone.top ?? 0) + offset,
      });
      withObjectId(clone);
      clone.setCoords();
    });
    return clones;
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

      if (command.intent === 'set_stroke_color') {
        setStrokeColor(command.color);
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach((object) => object.set({ stroke: command.color }));
          canvas.requestRenderAll();
          pushHistory();
          return '已修改选中对象描边颜色';
        }
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = command.color;
        }
        return '已切换当前描边颜色';
      }

      if (command.intent === 'set_stroke_width') {
        const width = Math.max(1, Math.min(24, command.width));
        setStrokeWidth(width);
        canvas.getActiveObjects().forEach((object) => object.set({ strokeWidth: width }));
        canvas.requestRenderAll();
        pushHistory();
        return `画笔粗细已设为 ${width}`;
      }

      if (command.intent === 'set_opacity') {
        const opacity = Math.max(0.05, Math.min(1, command.opacity));
        setOpacity(opacity);
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach((object) => object.set({ opacity }));
          canvas.requestRenderAll();
          pushHistory();
          return `已将选中对象透明度设为 ${Math.round(opacity * 100)}%`;
        }
        return `当前透明度已设为 ${Math.round(opacity * 100)}%`;
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
        lastTouchedIdsRef.current = matches.map(getObjectId).filter(Boolean);
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

      if (command.intent === 'delete_by_description') {
        const objects = canvas.getObjects().filter((object) => {
          const semanticObject = object as SemanticObject;
          const shapeMatches = !command.filter.shape || semanticObject.semanticShape === command.filter.shape;
          const colorMatches =
            !command.filter.color ||
            String(semanticObject.fill).toLowerCase() === command.filter.color.toLowerCase();
          return shapeMatches && colorMatches;
        });
        if (objects.length === 0) {
          return '没有找到可删除的对象';
        }
        objects.forEach((object) => canvas.remove(object));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setSelectedCount(0);
        lastTouchedIdsRef.current = [];
        pushHistory();
        return `已删除 ${objects.length} 个对象`;
      }

      if (command.intent === 'copy_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        clipboardObjectsRef.current = await cloneObjects(activeObjects);
        return `已复制 ${clipboardObjectsRef.current.length} 个对象`;
      }

      if (command.intent === 'paste_selected') {
        if (clipboardObjectsRef.current.length === 0) {
          return '剪贴板里还没有对象';
        }
        const clones = await cloneObjects(clipboardObjectsRef.current, 28);
        clipboardObjectsRef.current = await cloneObjects(clones);
        clones.forEach((clone) => canvas.add(clone));
        canvas.discardActiveObject();
        canvas.setActiveObject(clones.length === 1 ? clones[0] : new ActiveSelection(clones, { canvas }));
        canvas.requestRenderAll();
        setSelectedCount(clones.length);
        lastTouchedIdsRef.current = clones.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已粘贴 ${clones.length} 个对象`;
      }

      if (command.intent === 'duplicate_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        const clones = await cloneObjects(activeObjects, 28);
        clones.forEach((clone) => canvas.add(clone));
        canvas.discardActiveObject();
        canvas.setActiveObject(clones.length === 1 ? clones[0] : new ActiveSelection(clones, { canvas }));
        canvas.requestRenderAll();
        setSelectedCount(clones.length);
        lastTouchedIdsRef.current = clones.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已复制出 ${clones.length} 个对象`;
      }

      if (command.intent === 'group_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length < 2) {
          return '请至少选中两个对象';
        }
        canvas.discardActiveObject();
        activeObjects.forEach((object) => canvas.remove(object));
        const group = withObjectId(new Group(activeObjects));
        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.requestRenderAll();
        setSelectedCount(1);
        lastTouchedIdsRef.current = [getObjectId(group)].filter(Boolean);
        pushHistory();
        return `已组合 ${activeObjects.length} 个对象`;
      }

      if (command.intent === 'ungroup_selected') {
        const activeObject = canvas.getActiveObject();
        if (!(activeObject instanceof Group) || activeObject instanceof ActiveSelection) {
          return '请先选中一个组合对象';
        }
        const objects = activeObject.removeAll();
        canvas.remove(activeObject);
        objects.forEach((object) => {
          canvas.add(object);
          object.setCoords();
        });
        canvas.setActiveObject(objects.length === 1 ? objects[0] : new ActiveSelection(objects, { canvas }));
        canvas.requestRenderAll();
        setSelectedCount(objects.length);
        lastTouchedIdsRef.current = objects.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已取消组合 ${objects.length} 个对象`;
      }

      if (command.intent === 'lock_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => {
          object.set({
            lockMovementX: command.locked,
            lockMovementY: command.locked,
            lockRotation: command.locked,
            lockScalingX: command.locked,
            lockScalingY: command.locked,
            hasControls: !command.locked,
          });
          object.setCoords();
        });
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = activeObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return command.locked ? '已锁定选中对象' : '已解锁选中对象';
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
        lastTouchedIdsRef.current = activeObjects.map(getObjectId).filter(Boolean);
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
        lastTouchedIdsRef.current = activeObjects.map(getObjectId).filter(Boolean);
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
        lastTouchedIdsRef.current = activeObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return '已旋转选中对象';
      }

      if (command.intent === 'flip_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => {
          if (command.axis === 'horizontal') {
            object.set({ flipX: !object.flipX });
          } else {
            object.set({ flipY: !object.flipY });
          }
          object.setCoords();
        });
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = activeObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return command.axis === 'horizontal' ? '已水平翻转选中对象' : '已垂直翻转选中对象';
      }

      if (command.intent === 'align_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length < 2) {
          return '请至少选中两个对象';
        }
        const bounds = activeObjects.map(getObjectBounds);
        const target = {
          left: Math.min(...bounds.map((bound) => bound.left)),
          right: Math.max(...bounds.map((bound) => bound.right)),
          top: Math.min(...bounds.map((bound) => bound.top)),
          bottom: Math.max(...bounds.map((bound) => bound.bottom)),
          centerX: (Math.min(...bounds.map((bound) => bound.left)) + Math.max(...bounds.map((bound) => bound.right))) / 2,
          centerY: (Math.min(...bounds.map((bound) => bound.top)) + Math.max(...bounds.map((bound) => bound.bottom))) / 2,
        };
        activeObjects.forEach((object, index) => {
          const bound = bounds[index];
          if (command.alignment === 'left') {
            object.set({ left: (object.left ?? 0) + target.left - bound.left });
          }
          if (command.alignment === 'right') {
            object.set({ left: (object.left ?? 0) + target.right - bound.right });
          }
          if (command.alignment === 'top') {
            object.set({ top: (object.top ?? 0) + target.top - bound.top });
          }
          if (command.alignment === 'bottom') {
            object.set({ top: (object.top ?? 0) + target.bottom - bound.bottom });
          }
          if (command.alignment === 'center_horizontal') {
            object.set({ left: (object.left ?? 0) + target.centerX - (bound.left + bound.width / 2) });
          }
          if (command.alignment === 'center_vertical') {
            object.set({ top: (object.top ?? 0) + target.centerY - (bound.top + bound.height / 2) });
          }
          object.setCoords();
        });
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = activeObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return '已对齐选中对象';
      }

      if (command.intent === 'distribute_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length < 3) {
          return '请至少选中三个对象';
        }
        const sorted = [...activeObjects].sort((a, b) => {
          const aCenter = getObjectCenter(a);
          const bCenter = getObjectCenter(b);
          return command.axis === 'horizontal' ? aCenter.x - bCenter.x : aCenter.y - bCenter.y;
        });
        const first = getObjectCenter(sorted[0]);
        const last = getObjectCenter(sorted[sorted.length - 1]);
        const span = command.axis === 'horizontal' ? last.x - first.x : last.y - first.y;
        const gap = span / (sorted.length - 1);
        sorted.forEach((object, index) => {
          const center = getObjectCenter(object);
          const nextCenter = command.axis === 'horizontal' ? first.x + gap * index : first.y + gap * index;
          if (command.axis === 'horizontal') {
            object.set({ left: (object.left ?? 0) + nextCenter - center.x });
          } else {
            object.set({ top: (object.top ?? 0) + nextCenter - center.y });
          }
          object.setCoords();
        });
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = sorted.map(getObjectId).filter(Boolean);
        pushHistory();
        return command.axis === 'horizontal' ? '已横向均匀分布' : '已纵向均匀分布';
      }

      if (command.intent === 'batch_update') {
        const objects = canvas.getObjects().filter((object) => {
          const semanticObject = object as SemanticObject;
          const shapeMatches = !command.filter.shape || semanticObject.semanticShape === command.filter.shape;
          const colorMatches =
            !command.filter.color ||
            String(semanticObject.fill).toLowerCase() === command.filter.color.toLowerCase();
          return shapeMatches && colorMatches;
        });
        if (objects.length === 0) {
          return '没有找到可批量修改的对象';
        }
        objects.forEach((object) => {
          object.set({
            fill: command.updates.color ?? object.fill,
            stroke: command.updates.strokeColor ?? object.stroke,
            strokeWidth: command.updates.strokeWidth ?? object.strokeWidth,
          });
          object.setCoords();
        });
        canvas.discardActiveObject();
        canvas.setActiveObject(objects.length === 1 ? objects[0] : new ActiveSelection(objects, { canvas }));
        canvas.requestRenderAll();
        setSelectedCount(objects.length);
        lastTouchedIdsRef.current = objects.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已批量修改 ${objects.length} 个对象`;
      }

      if (command.intent === 'correct_last') {
        const objects = canvas
          .getObjects()
          .filter((object) => lastTouchedIdsRef.current.includes(getObjectId(object)));
        const targets = objects.length > 0 ? objects : canvas.getActiveObjects();
        if (targets.length === 0) {
          return '没有可修正的上一条对象';
        }
        targets.forEach((object) => {
          if (command.updates.color) {
            object.set({ fill: command.updates.color });
          }
          if (command.updates.sizeFactor) {
            object.scale((object.scaleX ?? 1) * command.updates.sizeFactor);
          }
          if (command.updates.angle !== undefined) {
            object.rotate(command.updates.angle);
          }
          object.setCoords();
        });
        canvas.discardActiveObject();
        canvas.setActiveObject(targets.length === 1 ? targets[0] : new ActiveSelection(targets, { canvas }));
        canvas.requestRenderAll();
        setSelectedCount(targets.length);
        lastTouchedIdsRef.current = targets.map(getObjectId).filter(Boolean);
        pushHistory();
        return '已修正上一条操作';
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
        canvas.freeDrawingBrush.color = storeStrokeColor;
        canvas.freeDrawingBrush.width = storeStrokeWidth;
        setFreeDrawing(command.enabled);
        return command.enabled ? '已开始自由绘制' : '已停止自由绘制';
      }

      if (command.intent === 'toggle_grid') {
        const enabled = command.enabled ?? !showGrid;
        setShowGrid(enabled);
        return enabled ? '已显示网格' : '已隐藏网格';
      }

      if (command.intent === 'toggle_snap') {
        const enabled = command.enabled ?? !snapEnabled;
        setSnapEnabled(enabled);
        return enabled ? '已开启吸附' : '已关闭吸附';
      }

      if (command.intent === 'zoom_canvas') {
        const nextZoom = Math.max(0.35, Math.min(3, canvas.getZoom() * command.factor));
        canvas.zoomToPoint(new Point(canvas.getWidth() / 2, canvas.getHeight() / 2), nextZoom);
        canvas.requestRenderAll();
        setZoom(nextZoom);
        return `画布缩放为 ${Math.round(nextZoom * 100)}%`;
      }

      if (command.intent === 'fit_canvas') {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.requestRenderAll();
        setZoom(1);
        return '画布已适应屏幕';
      }

      if (command.intent === 'pan_canvas') {
        const viewport = canvas.viewportTransform;
        if (viewport) {
          viewport[4] += command.dx;
          viewport[5] += command.dy;
          canvas.setViewportTransform(viewport);
        }
        canvas.requestRenderAll();
        return '已平移画布';
      }

      if (command.intent === 'draw_sequence') {
        const activeObject = canvas.getActiveObject();
        const center = command.x !== undefined && command.y !== undefined
          ? { x: command.x, y: command.y }
          : activeObject
            ? getObjectCenter(activeObject)
            : { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
        const count = Math.max(2, Math.min(12, command.count));
        const size = command.size ?? defaultSizeByShape[command.shape];
        const spacing = Math.max(72, size * 1.25);
        const objects = Array.from({ length: count }, (_, index) => {
          const offset = (index - (count - 1) / 2) * spacing;
          const object = createShape({
            intent: 'draw_shape',
            shape: command.shape,
            color: command.color ?? storeColor,
            strokeColor: command.strokeColor ?? storeStrokeColor,
            size,
            x: center.x + (command.layout === 'row' ? offset : 0),
            y: center.y + (command.layout === 'column' ? offset : 0),
          });
          object?.set({ opacity: storeOpacity, strokeWidth: storeStrokeWidth });
          return object;
        }).filter((object): object is FabricObject => Boolean(object));
        if (objects.length === 0) {
          return '暂不支持这个图形';
        }
        objects.forEach((object) => canvas.add(object));
        canvas.discardActiveObject();
        canvas.setActiveObject(objects.length === 1 ? objects[0] : new ActiveSelection(objects, { canvas }));
        canvas.requestRenderAll();
        setSelectedCount(objects.length);
        lastTouchedIdsRef.current = objects.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已绘制 ${objects.length} 个图形`;
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
        object.set({ opacity: storeOpacity, strokeWidth: storeStrokeWidth });
        canvas.add(object);
        canvas.setActiveObject(object);
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = [getObjectId(object)].filter(Boolean);
        pushHistory();
        return '已绘制图形';
      }

      if (command.intent === 'draw_template') {
        const center = canvas.getActiveObject()
          ? getObjectCenter(canvas.getActiveObject()!)
          : { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
        const templateMap = {
          smiley: { label: '笑脸模板', objects: createSmiley(center.x, center.y) },
          bar_chart: { label: '柱状图模板', objects: createBarChart(center.x, center.y) },
          flowchart: { label: '流程图模板', objects: createFlowchart(center.x, center.y) },
          sun: { label: '太阳模板', objects: createSun(center.x, center.y) },
          house: { label: '房子模板', objects: createHouse(center.x, center.y) },
        };
        const template = templateMap[command.template];
        const objects = template.objects;
        objects.forEach((object) => canvas.add(object));
        canvas.discardActiveObject();
        canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = objects.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已绘制${template.label}`;
      }

      if (command.intent === 'clear_canvas') {
        canvas.getObjects().forEach((object) => canvas.remove(object));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        pushHistory();
        return '画布已清空';
      }

      if (command.intent === 'new_canvas') {
        canvas.getObjects().forEach((object) => canvas.remove(object));
        canvas.discardActiveObject();
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.isDrawingMode = false;
        canvas.requestRenderAll();
        clipboardObjectsRef.current = [];
        lastTouchedIdsRef.current = [];
        redoRef.current = [];
        historyRef.current = [];
        setFreeDrawing(false);
        setSelectedCount(0);
        setZoom(1);
        pushHistory();
        return '已新建空白画布';
      }

      if (command.intent === 'undo') {
        if (historyRef.current.length <= 1) {
          return '没有可撤销的操作';
        }
        const requestedSteps = Math.max(1, Math.min(20, command.steps ?? 1));
        const steps = Math.min(requestedSteps, historyRef.current.length - 1);
        for (let index = 0; index < steps; index += 1) {
          const current = historyRef.current.pop();
          if (current) {
            redoRef.current.push(current);
          }
        }
        const previous = historyRef.current[historyRef.current.length - 1];
        if (previous) {
          await loadSnapshot(previous);
        }
        return steps === 1 ? '已撤销' : `已撤销 ${steps} 步`;
      }

      if (command.intent === 'redo') {
        if (redoRef.current.length === 0) {
          return '没有可重做的操作';
        }
        const requestedSteps = Math.max(1, Math.min(20, command.steps ?? 1));
        const steps = Math.min(requestedSteps, redoRef.current.length);
        let snapshot: CanvasSnapshot | undefined;
        for (let index = 0; index < steps; index += 1) {
          snapshot = redoRef.current.pop();
          if (snapshot) {
            historyRef.current.push(snapshot);
          }
        }
        if (snapshot) {
          await loadSnapshot(snapshot);
        }
        return steps === 1 ? '已重做' : `已重做 ${steps} 步`;
      }

      if (command.intent === 'export_png') {
        const link = document.createElement('a');
        link.download = timestampedName('voicedraw', 'png');
        link.href = canvas.toDataURL({ format: 'png', multiplier: 2 });
        link.click();
        return '已导出 PNG';
      }

      if (command.intent === 'export_svg') {
        downloadTextFile(timestampedName('voicedraw', 'svg'), canvas.toSVG(), 'image/svg+xml');
        return '已导出 SVG';
      }

      if (command.intent === 'save_json') {
        downloadTextFile(
          timestampedName('voicedraw', 'json'),
          JSON.stringify(canvas.toObject(persistedObjectProps), null, 2),
          'application/json',
        );
        return '已保存 JSON';
      }

      if (command.intent === 'open_json') {
        const json = await readJsonFile();
        if (!json) {
          return '没有打开有效的 JSON 文件';
        }
        await loadSnapshot(json);
        pushHistory();
        return '已打开 JSON 画布';
      }

      if (command.intent === 'show_help') {
        return command.visible === false ? '已隐藏命令帮助' : '已显示命令帮助';
      }

      return command.reason;
    },
    [
      cloneObjects,
      loadSnapshot,
      pushHistory,
      setColor,
      setFreeDrawing,
      setOpacity,
      setSnapEnabled,
      setSelectedCount,
      setStrokeColor,
      setStrokeWidth,
      setZoom,
      snapEnabled,
      storeColor,
      storeOpacity,
      storeStrokeColor,
      storeStrokeWidth,
      showGrid,
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
    const snapObject = (event: { target?: FabricObject }) => {
      if (!useDrawingStore.getState().snapEnabled || !event.target) {
        return;
      }
      const gridSize = 20;
      event.target.set({
        left: Math.round((event.target.left ?? 0) / gridSize) * gridSize,
        top: Math.round((event.target.top ?? 0) / gridSize) * gridSize,
      });
      event.target.setCoords();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    pushHistory();

    canvas.on('selection:created', updateSelection);
    canvas.on('selection:updated', updateSelection);
    canvas.on('selection:cleared', updateSelection);
    canvas.on('object:moving', snapObject);
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
