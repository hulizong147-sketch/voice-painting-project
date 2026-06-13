import type { DrawingCommand, ShapeKind } from '../types';
import { findColor } from './colors';

const shapeNames: Array<[ShapeKind, RegExp]> = [
  ['circle', /圆|圆形|圈/],
  ['rect', /矩形|长方形|方块|正方形/],
  ['triangle', /三角|三角形/],
  ['line', /线|直线/],
  ['star', /星星|星形|五角星/],
];

const sizeWords: Array<[RegExp, number]> = [
  [/很小|特别小/, 48],
  [/小一点|小的|小号|小/, 78],
  [/中等|默认/, 120],
  [/大一点|大的|大号|大/, 180],
  [/很大|特别大/, 260],
];

const positionWords: Array<[RegExp, Pick<Extract<DrawingCommand, { intent: 'draw_shape' }>, 'x' | 'y'>]> = [
  [/左上|左上角/, { x: 170, y: 140 }],
  [/右上|右上角/, { x: 650, y: 140 }],
  [/左下|左下角/, { x: 170, y: 440 }],
  [/右下|右下角/, { x: 650, y: 440 }],
  [/中间|中央|居中/, { x: 410, y: 280 }],
  [/左边|靠左/, { x: 190, y: 280 }],
  [/右边|靠右/, { x: 630, y: 280 }],
  [/上面|顶部/, { x: 410, y: 140 }],
  [/下面|底部/, { x: 410, y: 440 }],
];

const commandSeparators = /然后|接着|再|之后|并且|同时|，|。|；|;/g;

function findShape(text: string) {
  return shapeNames.find(([, pattern]) => pattern.test(text))?.[0];
}

function findSize(text: string) {
  const explicit = text.match(/(\d+)\s*(像素|px|PX)?/);
  if (explicit) {
    return Number(explicit[1]);
  }
  return sizeWords.find(([pattern]) => pattern.test(text))?.[1];
}

function findPosition(text: string) {
  return positionWords.find(([pattern]) => pattern.test(text))?.[1] ?? {};
}

export function parseSingleCommand(rawText: string): DrawingCommand {
  const text = rawText.replace(/\s+/g, '').trim();
  if (!text) {
    return { intent: 'unknown', reason: '没有识别到命令' };
  }

  if (/撤销|退回|上一步/.test(text)) {
    return { intent: 'undo' };
  }
  if (/重做|恢复|下一步/.test(text)) {
    return { intent: 'redo' };
  }
  if (/清空|清除画布|全部删除/.test(text)) {
    return { intent: 'clear_canvas' };
  }
  if (/导出|保存.*PNG|保存图片|下载/.test(text)) {
    return { intent: 'export_png' };
  }

  const widthMatch = text.match(/(?:画笔|线条|描边).*(\d+)/);
  if (/粗|细|画笔|线条|描边/.test(text) && widthMatch) {
    return { intent: 'set_stroke_width', width: Number(widthMatch[1]) };
  }

  const color = findColor(text);
  const shape = findShape(text);
  if (shape && /画|绘制|放|来个|生成/.test(text)) {
    return {
      intent: 'draw_shape',
      shape,
      color,
      size: findSize(text),
      ...findPosition(text),
    };
  }

  if (color && /换成|改成|设为|颜色|用/.test(text)) {
    return { intent: 'set_color', color };
  }

  return { intent: 'unknown', reason: `还不能理解：“${rawText}”` };
}

export function parseCommands(text: string) {
  return text
    .split(commandSeparators)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({ text: chunk, command: parseSingleCommand(chunk) }));
}
