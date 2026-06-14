import { useCallback, useEffect, useRef } from 'react';
import {
  ActiveSelection,
  Canvas,
  Circle,
  FabricObject,
  Group,
  Line,
  Path,
  PencilBrush,
  Point,
  Polygon,
  Rect,
  Textbox,
  Triangle,
} from 'fabric';
import { drawingStyleMap } from '../drawingStyles';
import { generateSketchDraft } from '../services/aiSketch';
import { traceDraftToPathCommands } from '../services/traceDraft';
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
  'visible',
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
  text: 180,
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

function createTextObject(command: Extract<DrawingCommand, { intent: 'add_text' }>) {
  return withSemanticShape(
    new Textbox(command.text, {
      left: command.x ?? 320,
      top: command.y ?? 220,
      width: 280,
      fill: command.color ?? '#172018',
      fontFamily: 'Inter, "Microsoft YaHei", sans-serif',
      fontSize: 36,
      fontWeight: 700,
      originX: 'center',
      originY: 'center',
      splitByGrapheme: true,
    }),
    'text',
  );
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

function createWomanHead(centerX: number, centerY: number) {
  const skin = '#f2c6a8';
  const skinStroke = '#9f6a4d';
  const hair = '#2b1b18';
  const line = '#172018';
  const lip = '#b94b5c';

  const backHair = withSemanticShape(
    new Circle({
      left: centerX,
      top: centerY - 12,
      radius: 104,
      fill: hair,
      stroke: line,
      strokeWidth: 3,
      originX: 'center',
      originY: 'center',
      scaleX: 0.82,
      scaleY: 1.12,
    }),
    'circle',
  );
  const neck = withSemanticShape(
    new Rect({
      left: centerX - 24,
      top: centerY + 80,
      width: 48,
      height: 64,
      fill: skin,
      stroke: skinStroke,
      strokeWidth: 3,
      rx: 10,
      ry: 10,
    }),
    'rect',
  );
  const shoulders = withSemanticShape(
    new Line([centerX - 118, centerY + 150, centerX + 118, centerY + 150], {
      stroke: '#166c5d',
      strokeWidth: 18,
      strokeLineCap: 'round',
    }),
    'line',
  );
  const leftEar = withSemanticShape(
    new Circle({
      left: centerX - 76,
      top: centerY + 2,
      radius: 18,
      fill: skin,
      stroke: skinStroke,
      strokeWidth: 3,
      originX: 'center',
      originY: 'center',
      scaleY: 1.28,
    }),
    'circle',
  );
  const rightEar = withSemanticShape(
    new Circle({
      left: centerX + 76,
      top: centerY + 2,
      radius: 18,
      fill: skin,
      stroke: skinStroke,
      strokeWidth: 3,
      originX: 'center',
      originY: 'center',
      scaleY: 1.28,
    }),
    'circle',
  );
  const face = withSemanticShape(
    new Circle({
      left: centerX,
      top: centerY,
      radius: 78,
      fill: skin,
      stroke: line,
      strokeWidth: 4,
      originX: 'center',
      originY: 'center',
      scaleX: 0.88,
      scaleY: 1.08,
    }),
    'circle',
  );
  const fringe = withSemanticShape(
    new Polygon(
      [
        { x: 0, y: 42 },
        { x: 42, y: 0 },
        { x: 92, y: 30 },
        { x: 136, y: 4 },
        { x: 164, y: 48 },
        { x: 120, y: 34 },
        { x: 80, y: 58 },
        { x: 36, y: 46 },
      ],
      {
        left: centerX - 82,
        top: centerY - 91,
        fill: hair,
        stroke: hair,
        strokeWidth: 2,
      },
    ),
    'triangle',
  );
  const leftHair = withSemanticShape(
    new Circle({
      left: centerX - 70,
      top: centerY + 40,
      radius: 42,
      fill: hair,
      strokeWidth: 0,
      originX: 'center',
      originY: 'center',
      scaleY: 1.75,
    }),
    'circle',
  );
  const rightHair = withSemanticShape(
    new Circle({
      left: centerX + 70,
      top: centerY + 40,
      radius: 42,
      fill: hair,
      strokeWidth: 0,
      originX: 'center',
      originY: 'center',
      scaleY: 1.75,
    }),
    'circle',
  );
  const leftEye = withSemanticShape(
    new Circle({ left: centerX - 28, top: centerY - 16, radius: 7, fill: line, strokeWidth: 0, originX: 'center', originY: 'center' }),
    'circle',
  );
  const rightEye = withSemanticShape(
    new Circle({ left: centerX + 28, top: centerY - 16, radius: 7, fill: line, strokeWidth: 0, originX: 'center', originY: 'center' }),
    'circle',
  );
  const leftBrow = withSemanticShape(
    new Line([centerX - 44, centerY - 36, centerX - 16, centerY - 40], { stroke: line, strokeWidth: 4, strokeLineCap: 'round' }),
    'line',
  );
  const rightBrow = withSemanticShape(
    new Line([centerX + 16, centerY - 40, centerX + 44, centerY - 36], { stroke: line, strokeWidth: 4, strokeLineCap: 'round' }),
    'line',
  );
  const nose = withSemanticShape(
    new Line([centerX + 4, centerY - 4, centerX - 4, centerY + 24], { stroke: skinStroke, strokeWidth: 3, strokeLineCap: 'round' }),
    'line',
  );
  const mouth = withSemanticShape(
    new Line([centerX - 24, centerY + 48, centerX + 24, centerY + 48], { stroke: lip, strokeWidth: 6, strokeLineCap: 'round' }),
    'line',
  );

  return [
    backHair,
    neck,
    shoulders,
    leftEar,
    rightEar,
    face,
    leftHair,
    rightHair,
    fringe,
    leftBrow,
    rightBrow,
    leftEye,
    rightEye,
    nose,
    mouth,
  ];
}

function createAnimeCharacter(centerX: number, centerY: number) {
  const skin = '#ffd7bd';
  const line = '#172018';
  const hair = '#7c4dff';
  const hairShadow = '#5030b7';
  const eye = '#20a4f3';
  const blush = '#ff8fa3';
  const uniform = '#1f6f8b';
  const accent = '#ff4d6d';

  const body = withSemanticShape(
    new Polygon(
      [
        { x: 0, y: 130 },
        { x: 70, y: 0 },
        { x: 140, y: 130 },
      ],
      {
        left: centerX - 70,
        top: centerY + 88,
        fill: uniform,
        stroke: line,
        strokeWidth: 4,
      },
    ),
    'triangle',
  );
  const collarLeft = withSemanticShape(
    new Polygon(
      [
        { x: 0, y: 0 },
        { x: 52, y: 18 },
        { x: 22, y: 58 },
      ],
      { left: centerX - 58, top: centerY + 102, fill: '#ffffff', stroke: line, strokeWidth: 3 },
    ),
    'triangle',
  );
  const collarRight = withSemanticShape(
    new Polygon(
      [
        { x: 52, y: 0 },
        { x: 0, y: 18 },
        { x: 30, y: 58 },
      ],
      { left: centerX + 6, top: centerY + 102, fill: '#ffffff', stroke: line, strokeWidth: 3 },
    ),
    'triangle',
  );
  const bowLeft = withSemanticShape(
    new Triangle({
      left: centerX - 20,
      top: centerY + 142,
      width: 44,
      height: 36,
      fill: accent,
      stroke: line,
      strokeWidth: 3,
      angle: -90,
      originX: 'center',
      originY: 'center',
    }),
    'triangle',
  );
  const bowRight = withSemanticShape(
    new Triangle({
      left: centerX + 20,
      top: centerY + 142,
      width: 44,
      height: 36,
      fill: accent,
      stroke: line,
      strokeWidth: 3,
      angle: 90,
      originX: 'center',
      originY: 'center',
    }),
    'triangle',
  );
  const bowKnot = withSemanticShape(
    new Circle({ left: centerX, top: centerY + 142, radius: 10, fill: accent, stroke: line, strokeWidth: 3, originX: 'center', originY: 'center' }),
    'circle',
  );
  const neck = withSemanticShape(
    new Rect({ left: centerX - 18, top: centerY + 72, width: 36, height: 48, rx: 10, ry: 10, fill: skin, stroke: line, strokeWidth: 3 }),
    'rect',
  );
  const backHair = withSemanticShape(
    new Circle({
      left: centerX,
      top: centerY - 12,
      radius: 118,
      fill: hairShadow,
      stroke: line,
      strokeWidth: 4,
      originX: 'center',
      originY: 'center',
      scaleX: 0.72,
      scaleY: 1.08,
    }),
    'circle',
  );
  const leftTwinTail = withSemanticShape(
    new Polygon(
      [
        { x: 50, y: 0 },
        { x: 100, y: 104 },
        { x: 58, y: 196 },
        { x: 14, y: 94 },
      ],
      { left: centerX - 136, top: centerY - 62, fill: hair, stroke: line, strokeWidth: 4 },
    ),
    'triangle',
  );
  const rightTwinTail = withSemanticShape(
    new Polygon(
      [
        { x: 50, y: 0 },
        { x: 88, y: 94 },
        { x: 44, y: 196 },
        { x: 2, y: 104 },
      ],
      { left: centerX + 44, top: centerY - 62, fill: hair, stroke: line, strokeWidth: 4 },
    ),
    'triangle',
  );
  const face = withSemanticShape(
    new Circle({
      left: centerX,
      top: centerY,
      radius: 82,
      fill: skin,
      stroke: line,
      strokeWidth: 4,
      originX: 'center',
      originY: 'center',
      scaleX: 0.86,
      scaleY: 1.02,
    }),
    'circle',
  );
  const bangs = [-58, -24, 10, 42].map((offset, index) =>
    withSemanticShape(
      new Triangle({
        left: centerX + offset,
        top: centerY - 72 + (index % 2) * 8,
        width: 46,
        height: 82,
        fill: hair,
        stroke: line,
        strokeWidth: 3,
        angle: [-18, 8, -8, 18][index],
        originX: 'center',
        originY: 'center',
      }),
      'triangle',
    ),
  );
  const leftEyeWhite = withSemanticShape(
    new Circle({ left: centerX - 30, top: centerY - 10, radius: 22, fill: '#ffffff', stroke: line, strokeWidth: 3, originX: 'center', originY: 'center', scaleX: 0.78, scaleY: 1.18 }),
    'circle',
  );
  const rightEyeWhite = withSemanticShape(
    new Circle({ left: centerX + 30, top: centerY - 10, radius: 22, fill: '#ffffff', stroke: line, strokeWidth: 3, originX: 'center', originY: 'center', scaleX: 0.78, scaleY: 1.18 }),
    'circle',
  );
  const leftIris = withSemanticShape(
    new Circle({ left: centerX - 30, top: centerY - 8, radius: 13, fill: eye, stroke: '#0a5278', strokeWidth: 2, originX: 'center', originY: 'center', scaleY: 1.25 }),
    'circle',
  );
  const rightIris = withSemanticShape(
    new Circle({ left: centerX + 30, top: centerY - 8, radius: 13, fill: eye, stroke: '#0a5278', strokeWidth: 2, originX: 'center', originY: 'center', scaleY: 1.25 }),
    'circle',
  );
  const eyeHighlights = [
    withSemanticShape(new Circle({ left: centerX - 35, top: centerY - 18, radius: 5, fill: '#ffffff', strokeWidth: 0, originX: 'center', originY: 'center' }), 'circle'),
    withSemanticShape(new Circle({ left: centerX + 25, top: centerY - 18, radius: 5, fill: '#ffffff', strokeWidth: 0, originX: 'center', originY: 'center' }), 'circle'),
  ];
  const cheeks = [
    withSemanticShape(new Circle({ left: centerX - 50, top: centerY + 34, radius: 12, fill: blush, opacity: 0.55, strokeWidth: 0, originX: 'center', originY: 'center', scaleX: 1.4 }), 'circle'),
    withSemanticShape(new Circle({ left: centerX + 50, top: centerY + 34, radius: 12, fill: blush, opacity: 0.55, strokeWidth: 0, originX: 'center', originY: 'center', scaleX: 1.4 }), 'circle'),
  ];
  const mouth = withSemanticShape(
    new Line([centerX - 12, centerY + 48, centerX + 12, centerY + 48], { stroke: '#b94b5c', strokeWidth: 5, strokeLineCap: 'round' }),
    'line',
  );

  return [
    body,
    collarLeft,
    collarRight,
    bowLeft,
    bowRight,
    bowKnot,
    neck,
    backHair,
    leftTwinTail,
    rightTwinTail,
    face,
    ...bangs,
    leftEyeWhite,
    rightEyeWhite,
    leftIris,
    rightIris,
    ...eyeHighlights,
    ...cheeks,
    mouth,
  ];
}

function createSketchPath(path: string, stroke = '#172018', strokeWidth = 5) {
  return withSemanticShape(
    new Path(path, {
      fill: 'transparent',
      stroke,
      strokeWidth,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    }),
    'line',
  );
}

function mergeBounds(bounds: ReturnType<typeof getObjectBounds>[]) {
  const left = Math.min(...bounds.map((bound) => bound.left));
  const top = Math.min(...bounds.map((bound) => bound.top));
  const right = Math.max(...bounds.map((bound) => bound.right));
  const bottom = Math.max(...bounds.map((bound) => bound.bottom));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function createIncrementalStrokePaths(
  edit: Extract<DrawingCommand, { intent: 'incremental_edit' }>['edit'],
  bounds: ReturnType<typeof getObjectBounds>,
) {
  const ink = '#172018';
  const softInk = '#4b5a4d';
  const cx = bounds.left + bounds.width / 2;
  const cy = bounds.top + bounds.height / 2;
  const unit = Math.max(42, Math.min(120, Math.max(bounds.width, bounds.height) * 0.28));
  const p = (path: string, stroke = ink, strokeWidth = 4) => createSketchPath(path, stroke, strokeWidth);

  if (edit === 'tail') {
    const baseX = bounds.right - unit * 0.16;
    const baseY = cy + unit * 0.18;
    const tipX = bounds.right + unit * 1.55;
    const tipY = cy - unit * 0.62;
    return [
      p(`M ${baseX} ${baseY} C ${bounds.right + unit * 0.6} ${cy + unit * 0.9}, ${tipX + unit * 0.28} ${cy + unit * 0.22}, ${tipX} ${tipY}`, ink, 5),
      p(`M ${baseX + unit * 0.12} ${baseY - unit * 0.16} C ${bounds.right + unit * 0.76} ${cy + unit * 0.3}, ${tipX + unit * 0.02} ${cy - unit * 1.1}, ${bounds.right + unit * 0.54} ${cy - unit * 0.78}`, ink, 5),
      p(`M ${bounds.right + unit * 0.3} ${cy + unit * 0.34} C ${bounds.right + unit * 0.75} ${cy + unit * 0.06}, ${bounds.right + unit * 0.96} ${cy - unit * 0.3}, ${bounds.right + unit * 1.18} ${cy - unit * 0.52}`, softInk, 3),
    ];
  }

  if (edit === 'ears') {
    const y = bounds.top + unit * 0.05;
    return [
      p(`M ${cx - unit * 0.62} ${y + unit * 0.34} L ${cx - unit * 0.38} ${y - unit * 0.48} L ${cx - unit * 0.1} ${y + unit * 0.26}`, ink, 5),
      p(`M ${cx + unit * 0.1} ${y + unit * 0.26} L ${cx + unit * 0.38} ${y - unit * 0.48} L ${cx + unit * 0.62} ${y + unit * 0.34}`, ink, 5),
      p(`M ${cx - unit * 0.42} ${y + unit * 0.14} L ${cx - unit * 0.34} ${y - unit * 0.16} L ${cx - unit * 0.2} ${y + unit * 0.1}`, softInk, 2.8),
      p(`M ${cx + unit * 0.2} ${y + unit * 0.1} L ${cx + unit * 0.34} ${y - unit * 0.16} L ${cx + unit * 0.42} ${y + unit * 0.14}`, softInk, 2.8),
    ];
  }

  if (edit === 'hat') {
    const y = bounds.top - unit * 0.12;
    return [
      p(`M ${cx - unit * 0.9} ${y + unit * 0.42} C ${cx - unit * 0.36} ${y + unit * 0.24}, ${cx + unit * 0.36} ${y + unit * 0.24}, ${cx + unit * 0.9} ${y + unit * 0.42}`, ink, 5),
      p(`M ${cx - unit * 0.46} ${y + unit * 0.32} L ${cx - unit * 0.34} ${y - unit * 0.34} C ${cx - unit * 0.08} ${y - unit * 0.52}, ${cx + unit * 0.28} ${y - unit * 0.48}, ${cx + unit * 0.42} ${y + unit * 0.32}`, ink, 5),
      p(`M ${cx - unit * 0.38} ${y + unit * 0.1} C ${cx - unit * 0.02} ${y + unit * 0.22}, ${cx + unit * 0.22} ${y + unit * 0.18}, ${cx + unit * 0.38} ${y + unit * 0.08}`, softInk, 3),
    ];
  }

  if (edit === 'bigger_eyes') {
    const y = cy - unit * 0.22;
    return [
      p(`M ${cx - unit * 0.58} ${y} C ${cx - unit * 0.46} ${y - unit * 0.18}, ${cx - unit * 0.18} ${y - unit * 0.18}, ${cx - unit * 0.08} ${y} C ${cx - unit * 0.2} ${y + unit * 0.2}, ${cx - unit * 0.46} ${y + unit * 0.2}, ${cx - unit * 0.58} ${y}`, ink, 4.2),
      p(`M ${cx + unit * 0.08} ${y} C ${cx + unit * 0.2} ${y - unit * 0.18}, ${cx + unit * 0.46} ${y - unit * 0.18}, ${cx + unit * 0.58} ${y} C ${cx + unit * 0.46} ${y + unit * 0.2}, ${cx + unit * 0.2} ${y + unit * 0.2}, ${cx + unit * 0.08} ${y}`, ink, 4.2),
      p(`M ${cx - unit * 0.42} ${y - unit * 0.06} C ${cx - unit * 0.36} ${y + unit * 0.06}, ${cx - unit * 0.3} ${y + unit * 0.1}, ${cx - unit * 0.24} ${y + unit * 0.02}`, softInk, 2.6),
      p(`M ${cx + unit * 0.24} ${y + unit * 0.02} C ${cx + unit * 0.3} ${y + unit * 0.1}, ${cx + unit * 0.36} ${y + unit * 0.06}, ${cx + unit * 0.42} ${y - unit * 0.06}`, softInk, 2.6),
    ];
  }

  if (edit === 'whiskers') {
    const y = cy + unit * 0.1;
    return [
      p(`M ${cx - unit * 0.12} ${y - unit * 0.08} C ${cx - unit * 0.62} ${y - unit * 0.2}, ${cx - unit * 0.9} ${y - unit * 0.18}, ${cx - unit * 1.14} ${y - unit * 0.32}`, ink, 3),
      p(`M ${cx - unit * 0.12} ${y + unit * 0.06} C ${cx - unit * 0.62} ${y + unit * 0.02}, ${cx - unit * 0.92} ${y + unit * 0.16}, ${cx - unit * 1.18} ${y + unit * 0.2}`, ink, 3),
      p(`M ${cx + unit * 0.12} ${y - unit * 0.08} C ${cx + unit * 0.62} ${y - unit * 0.2}, ${cx + unit * 0.9} ${y - unit * 0.18}, ${cx + unit * 1.14} ${y - unit * 0.32}`, ink, 3),
      p(`M ${cx + unit * 0.12} ${y + unit * 0.06} C ${cx + unit * 0.62} ${y + unit * 0.02}, ${cx + unit * 0.92} ${y + unit * 0.16}, ${cx + unit * 1.18} ${y + unit * 0.2}`, ink, 3),
    ];
  }

  return [];
}

const incrementalEditPrompts: Record<Extract<DrawingCommand, { intent: 'incremental_edit' }>['edit'], string> = {
  tail: '在当前画面主体基础上添加自然连接的大尾巴，保持黑白线稿和原构图',
  ears: '在当前画面主体头部添加合适的耳朵，保持黑白线稿和原构图',
  hat: '在当前画面主体头上戴一顶帽子，帽子要贴合头部，保持黑白线稿和原构图',
  bigger_eyes: '在当前画面主体基础上把眼睛画得更大更可爱，保持黑白线稿和原构图',
  thicker_lines: '把当前画面的线条加粗，保持原构图',
  whiskers: '在当前画面主体脸部添加自然的胡须，保持黑白线稿和原构图',
};

async function traceDraftToBrushPaths(imageDataUrl: string, centerX: number, centerY: number) {
  const paths = await traceDraftToPathCommands(imageDataUrl, centerX, centerY);
  return paths.map((item) => createSketchPath(item.path, '#172018', item.strokeWidth));
}

function createAnimeSketch(centerX: number, centerY: number) {
  const ink = '#172018';
  const softInk = '#415042';
  const blush = '#d7798d';
  const p = (path: string, stroke = ink, strokeWidth = 5) => createSketchPath(path, stroke, strokeWidth);

  const face = p(
    `M ${centerX - 64} ${centerY - 22}
     C ${centerX - 72} ${centerY + 24}, ${centerX - 50} ${centerY + 78}, ${centerX - 6} ${centerY + 88}
     C ${centerX + 42} ${centerY + 78}, ${centerX + 68} ${centerY + 24}, ${centerX + 58} ${centerY - 24}`,
  );
  const hairCap = p(
    `M ${centerX - 76} ${centerY - 18}
     C ${centerX - 92} ${centerY - 76}, ${centerX - 38} ${centerY - 120}, ${centerX + 8} ${centerY - 108}
     C ${centerX + 60} ${centerY - 122}, ${centerX + 94} ${centerY - 72}, ${centerX + 72} ${centerY - 14}`,
    ink,
    6,
  );
  const bangs = [
    p(`M ${centerX - 52} ${centerY - 76} C ${centerX - 54} ${centerY - 42}, ${centerX - 44} ${centerY - 20}, ${centerX - 30} ${centerY - 2}`),
    p(`M ${centerX - 16} ${centerY - 94} C ${centerX - 24} ${centerY - 54}, ${centerX - 10} ${centerY - 22}, ${centerX + 4} ${centerY - 4}`),
    p(`M ${centerX + 22} ${centerY - 90} C ${centerX + 12} ${centerY - 54}, ${centerX + 26} ${centerY - 22}, ${centerX + 42} ${centerY - 6}`),
  ];
  const sideHair = [
    p(`M ${centerX - 76} ${centerY - 20} C ${centerX - 118} ${centerY + 12}, ${centerX - 104} ${centerY + 86}, ${centerX - 72} ${centerY + 132}`),
    p(`M ${centerX + 72} ${centerY - 18} C ${centerX + 116} ${centerY + 16}, ${centerX + 100} ${centerY + 90}, ${centerX + 62} ${centerY + 132}`),
    p(`M ${centerX - 104} ${centerY + 36} C ${centerX - 132} ${centerY + 82}, ${centerX - 122} ${centerY + 130}, ${centerX - 86} ${centerY + 168}`, softInk, 4),
    p(`M ${centerX + 98} ${centerY + 36} C ${centerX + 130} ${centerY + 82}, ${centerX + 116} ${centerY + 132}, ${centerX + 80} ${centerY + 168}`, softInk, 4),
  ];
  const eyes = [
    p(`M ${centerX - 48} ${centerY - 12} C ${centerX - 38} ${centerY - 28}, ${centerX - 18} ${centerY - 28}, ${centerX - 8} ${centerY - 12}`, ink, 4),
    p(`M ${centerX + 8} ${centerY - 12} C ${centerX + 18} ${centerY - 28}, ${centerX + 38} ${centerY - 28}, ${centerX + 48} ${centerY - 12}`, ink, 4),
    p(`M ${centerX - 36} ${centerY - 6} C ${centerX - 36} ${centerY + 18}, ${centerX - 20} ${centerY + 18}, ${centerX - 20} ${centerY - 6}`, ink, 4),
    p(`M ${centerX + 22} ${centerY - 6} C ${centerX + 22} ${centerY + 18}, ${centerX + 38} ${centerY + 18}, ${centerX + 38} ${centerY - 6}`, ink, 4),
  ];
  const details = [
    p(`M ${centerX - 42} ${centerY - 40} C ${centerX - 30} ${centerY - 48}, ${centerX - 18} ${centerY - 48}, ${centerX - 6} ${centerY - 42}`, softInk, 3),
    p(`M ${centerX + 6} ${centerY - 42} C ${centerX + 18} ${centerY - 48}, ${centerX + 30} ${centerY - 48}, ${centerX + 42} ${centerY - 40}`, softInk, 3),
    p(`M ${centerX} ${centerY + 8} C ${centerX - 4} ${centerY + 20}, ${centerX - 2} ${centerY + 24}, ${centerX + 4} ${centerY + 26}`, softInk, 3),
    p(`M ${centerX - 12} ${centerY + 48} C ${centerX - 2} ${centerY + 56}, ${centerX + 12} ${centerY + 52}, ${centerX + 18} ${centerY + 44}`, ink, 4),
    p(`M ${centerX - 54} ${centerY + 34} C ${centerX - 44} ${centerY + 28}, ${centerX - 34} ${centerY + 30}, ${centerX - 26} ${centerY + 38}`, blush, 3),
    p(`M ${centerX + 28} ${centerY + 38} C ${centerX + 38} ${centerY + 30}, ${centerX + 50} ${centerY + 28}, ${centerX + 58} ${centerY + 34}`, blush, 3),
    p(`M ${centerX - 24} ${centerY + 88} C ${centerX - 42} ${centerY + 110}, ${centerX - 84} ${centerY + 118}, ${centerX - 104} ${centerY + 148}`, softInk, 4),
    p(`M ${centerX + 24} ${centerY + 88} C ${centerX + 46} ${centerY + 108}, ${centerX + 88} ${centerY + 118}, ${centerX + 108} ${centerY + 148}`, softInk, 4),
  ];

  return [face, hairCap, ...bangs, ...sideHair, ...eyes, ...details];
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
  const customCanvasSizeRef = useRef<{ width: number; height: number } | null>(null);
  const ignoreHistoryRef = useRef(false);
  const setSelectedCount = useDrawingStore((state) => state.setSelectedCount);
  const setColor = useDrawingStore((state) => state.setColor);
  const setFreeDrawing = useDrawingStore((state) => state.setFreeDrawing);
  const setOpacity = useDrawingStore((state) => state.setOpacity);
  const setSnapEnabled = useDrawingStore((state) => state.setSnapEnabled);
  const setStrokeColor = useDrawingStore((state) => state.setStrokeColor);
  const setShowGrid = useDrawingStore((state) => state.setShowGrid);
  const setStrokeWidth = useDrawingStore((state) => state.setStrokeWidth);
  const setDrawingStyle = useDrawingStore((state) => state.setDrawingStyle);
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

      if (command.intent === 'set_canvas_background') {
        canvas.backgroundColor = command.color;
        canvas.requestRenderAll();
        pushHistory();
        return '已修改画布背景色';
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

      if (command.intent === 'set_drawing_style') {
        const preset = drawingStyleMap[command.style];
        setDrawingStyle(command.style);
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = preset.stroke;
          canvas.freeDrawingBrush.width = preset.strokeWidth;
        }
        return `当前画风已切换为${preset.label}`;
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

      if (command.intent === 'clear_selection') {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setSelectedCount(0);
        return '已取消选择';
      }

      if (command.intent === 'invert_selection') {
        const selectedIds = new Set(canvas.getActiveObjects().map(getObjectId).filter(Boolean));
        const matches = canvas.getObjects().filter((object) => object.visible !== false && !selectedIds.has(getObjectId(object)));
        canvas.discardActiveObject();
        if (matches.length === 0) {
          canvas.requestRenderAll();
          setSelectedCount(0);
          return '没有可反选的对象';
        }
        if (matches.length === 1) {
          canvas.setActiveObject(matches[0]);
        } else {
          canvas.setActiveObject(new ActiveSelection(matches, { canvas }));
        }
        canvas.requestRenderAll();
        setSelectedCount(matches.length);
        lastTouchedIdsRef.current = matches.map(getObjectId).filter(Boolean);
        return `已反选 ${matches.length} 个对象`;
      }

      if (command.intent === 'select_by_visibility') {
        const matches = canvas.getObjects().filter((object) => object.visible === command.visible);
        canvas.discardActiveObject();
        if (matches.length === 0) {
          canvas.requestRenderAll();
          setSelectedCount(0);
          return command.visible ? '没有找到可见对象' : '没有找到隐藏对象';
        }
        if (matches.length === 1) {
          canvas.setActiveObject(matches[0]);
        } else {
          canvas.setActiveObject(new ActiveSelection(matches, { canvas }));
        }
        canvas.requestRenderAll();
        setSelectedCount(matches.length);
        lastTouchedIdsRef.current = matches.map(getObjectId).filter(Boolean);
        return command.visible ? `已选中 ${matches.length} 个可见对象` : `已选中 ${matches.length} 个隐藏对象`;
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

      if (command.intent === 'set_visibility_selected') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => {
          object.set({ visible: command.visible });
          object.setCoords();
        });
        if (!command.visible) {
          canvas.discardActiveObject();
          setSelectedCount(0);
        }
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = activeObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return command.visible ? '已显示选中对象' : '已隐藏选中对象';
      }

      if (command.intent === 'show_all_objects') {
        const objects = canvas.getObjects();
        if (objects.length === 0) {
          return '画布上还没有对象';
        }
        objects.forEach((object) => {
          object.set({ visible: true });
          object.setCoords();
        });
        canvas.requestRenderAll();
        pushHistory();
        return `已显示 ${objects.length} 个对象`;
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

      if (command.intent === 'place_selected_on_target') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中要移动的对象';
        }
        const selectedIds = new Set(activeObjects.map(getObjectId).filter(Boolean));
        const targetObjects = canvas.getObjects()
          .filter((object) => object.visible !== false && !selectedIds.has(getObjectId(object)));
        if (targetObjects.length === 0) {
          return '没有找到可对齐的目标对象';
        }
        const selectedBounds = mergeBounds(activeObjects.map(getObjectBounds));
        const targetBounds = mergeBounds(targetObjects.map(getObjectBounds));
        const targetHeadY = command.position === 'head'
          ? targetBounds.top + Math.max(8, targetBounds.height * 0.08)
          : targetBounds.top;
        const dx = (targetBounds.left + targetBounds.width / 2) - (selectedBounds.left + selectedBounds.width / 2);
        const dy = targetHeadY - selectedBounds.bottom + Math.max(4, selectedBounds.height * 0.08);
        activeObjects.forEach((object) => {
          object.set({
            left: (object.left ?? 0) + dx,
            top: (object.top ?? 0) + dy,
          });
          object.setCoords();
        });
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = activeObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已把选中对象移动到${command.position === 'head' ? '目标头上' : '目标顶部'}`;
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
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => canvas.bringObjectForward(object));
        canvas.requestRenderAll();
        pushHistory();
        return '已上移一层';
      }

      if (command.intent === 'send_backward') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => canvas.sendObjectBackwards(object));
        canvas.requestRenderAll();
        pushHistory();
        return '已下移一层';
      }

      if (command.intent === 'bring_to_front') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => canvas.bringObjectToFront(object));
        canvas.requestRenderAll();
        pushHistory();
        return '已置顶选中对象';
      }

      if (command.intent === 'send_to_back') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) {
          return '请先选中一个对象';
        }
        activeObjects.forEach((object) => canvas.sendObjectToBack(object));
        canvas.requestRenderAll();
        pushHistory();
        return '已置底选中对象';
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

      if (command.intent === 'set_canvas_size') {
        const width = Math.max(320, Math.min(2400, Math.round(command.width)));
        const height = Math.max(320, Math.min(2400, Math.round(command.height)));
        customCanvasSizeRef.current = { width, height };
        canvas.setDimensions({ width, height });
        canvas.requestRenderAll();
        pushHistory();
        return `画布尺寸已设为 ${width}x${height}`;
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

      if (command.intent === 'ai_brush_draw') {
        const center = canvas.getActiveObject()
          ? getObjectCenter(canvas.getActiveObject()!)
          : { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };
        const draft = await generateSketchDraft(command.prompt);
        const objects = await traceDraftToBrushPaths(draft.imageDataUrl, center.x, center.y);
        if (objects.length === 0) {
          return 'AI 草稿生成了，但没有提取到可复刻的笔触';
        }
        objects.forEach((object) => canvas.add(object));
        canvas.discardActiveObject();
        canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = objects.map(getObjectId).filter(Boolean);
        pushHistory();
        const source = draft.provider === 'fallback' ? '本地测试草稿' : 'AI 草稿';
        return `已根据${source}复刻 ${objects.length} 条画笔笔触`;
      }

      if (command.intent === 'incremental_edit') {
        const activeObjects = canvas.getActiveObjects();
        const previousObjects = canvas.getObjects()
          .filter((object) => lastTouchedIdsRef.current.includes(getObjectId(object)));
        const targets = activeObjects.length > 0 ? activeObjects : previousObjects;
        if (command.edit === 'thicker_lines') {
          const editableTargets = targets.length > 0 ? targets : canvas.getObjects();
          if (editableTargets.length === 0) {
            return '还没有可加粗的笔触';
          }
          editableTargets.forEach((object) => {
            const currentWidth = Number(object.strokeWidth ?? 2);
            object.set({ strokeWidth: Math.min(16, currentWidth + 2) });
            object.setCoords();
          });
          canvas.requestRenderAll();
          lastTouchedIdsRef.current = editableTargets.map(getObjectId).filter(Boolean);
          pushHistory();
          return `已基于当前画板加粗 ${editableTargets.length} 条笔触`;
        }

        const canvasObjects = canvas.getObjects();
        if (canvasObjects.length === 0) {
          return '画布上还没有可参考的内容';
        }
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        const referenceImageDataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
        const draft = await generateSketchDraft(incrementalEditPrompts[command.edit], referenceImageDataUrl);
        const objects = await traceDraftToBrushPaths(
          draft.imageDataUrl,
          canvas.getWidth() / 2,
          canvas.getHeight() / 2,
        );
        if (objects.length === 0) {
          return 'AI 已生成修改图，但没有提取到可复刻的笔触';
        }
        canvasObjects.forEach((object) => canvas.remove(object));
        objects.forEach((object) => canvas.add(object));
        canvas.discardActiveObject();
        canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = objects.map(getObjectId).filter(Boolean);
        pushHistory();
        const labels: Record<Exclude<typeof command.edit, 'thicker_lines'>, string> = {
          tail: '尾巴',
          ears: '耳朵',
          hat: '帽子',
          bigger_eyes: '大眼睛',
          whiskers: '胡须',
        };
        return `已基于当前画板重绘并添加${labels[command.edit]}`;
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

      if (command.intent === 'add_text') {
        const activeObject = canvas.getActiveObject();
        const relativeCenter = activeObject ? getObjectCenter(activeObject) : null;
        const resolvedCommand = { ...command };
        if (command.x === undefined && command.y === undefined) {
          resolvedCommand.x = relativeCenter ? relativeCenter.x + 170 : canvas.getWidth() / 2;
          resolvedCommand.y = relativeCenter ? relativeCenter.y : canvas.getHeight() / 2;
        }
        const object = createTextObject({
          ...resolvedCommand,
          color: resolvedCommand.color ?? storeColor,
        });
        object.set({ opacity: storeOpacity });
        canvas.add(object);
        canvas.setActiveObject(object);
        canvas.requestRenderAll();
        setSelectedCount(1);
        lastTouchedIdsRef.current = [getObjectId(object)].filter(Boolean);
        pushHistory();
        return '已添加文字';
      }

      if (command.intent === 'update_text_selected') {
        const textObjects = canvas.getActiveObjects().filter((object): object is Textbox => object instanceof Textbox);
        if (textObjects.length === 0) {
          return '请先选中一个文字对象';
        }
        textObjects.forEach((object) => {
          object.set({ text: command.text });
          object.setCoords();
        });
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = textObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已更新 ${textObjects.length} 个文字对象`;
      }

      if (command.intent === 'set_text_size') {
        const textObjects = canvas.getActiveObjects().filter((object): object is Textbox => object instanceof Textbox);
        if (textObjects.length === 0) {
          return '请先选中一个文字对象';
        }
        const size = Math.max(8, Math.min(160, command.size));
        textObjects.forEach((object) => {
          object.set({ fontSize: size });
          object.setCoords();
        });
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = textObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return `已将文字字号设为 ${size}`;
      }

      if (command.intent === 'set_text_weight') {
        const textObjects = canvas.getActiveObjects().filter((object): object is Textbox => object instanceof Textbox);
        if (textObjects.length === 0) {
          return '请先选中一个文字对象';
        }
        textObjects.forEach((object) => {
          object.set({ fontWeight: command.bold ? 700 : 400 });
          object.setCoords();
        });
        canvas.requestRenderAll();
        lastTouchedIdsRef.current = textObjects.map(getObjectId).filter(Boolean);
        pushHistory();
        return command.bold ? '已加粗选中文字' : '已取消文字加粗';
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
          woman_head: { label: '女性头像模板', objects: createWomanHead(center.x, center.y) },
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
        customCanvasSizeRef.current = null;
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
      if (customCanvasSizeRef.current) {
        canvas.setDimensions(customCanvasSizeRef.current);
        canvas.requestRenderAll();
        return;
      }
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
