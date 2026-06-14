import type { DrawingStyleId } from './types';

export const drawingStyleOptions: Array<{
  id: DrawingStyleId;
  label: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}> = [
  {
    id: 'default',
    label: '默认',
    fill: '#cf5f45',
    stroke: '#172018',
    strokeWidth: 3,
    opacity: 1,
  },
  {
    id: 'anime',
    label: '二次元',
    fill: '#ff8fa3',
    stroke: '#172018',
    strokeWidth: 4,
    opacity: 1,
  },
  {
    id: 'ink',
    label: '水墨',
    fill: '#2f352f',
    stroke: '#121612',
    strokeWidth: 6,
    opacity: 0.78,
  },
  {
    id: 'simple',
    label: '简笔',
    fill: 'transparent',
    stroke: '#172018',
    strokeWidth: 3,
    opacity: 1,
  },
];

export const drawingStyleMap = Object.fromEntries(
  drawingStyleOptions.map((style) => [style.id, style]),
) as Record<DrawingStyleId, (typeof drawingStyleOptions)[number]>;

export function getDrawingStyleLabel(style: DrawingStyleId) {
  return drawingStyleMap[style].label;
}
