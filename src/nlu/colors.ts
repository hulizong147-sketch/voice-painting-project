export const colorMap: Record<string, string> = {
  红色: '#ff3b30',
  红: '#ff3b30',
  深红: '#8b0000',
  粉色: '#ffc0cb',
  粉红: '#ffc0cb',
  橙色: '#ff9500',
  黄色: '#ffcc00',
  黄: '#ffcc00',
  绿色: '#34c759',
  绿: '#34c759',
  深绿: '#006400',
  蓝色: '#0a84ff',
  蓝: '#0a84ff',
  天蓝: '#87ceeb',
  浅蓝: '#87ceeb',
  深蓝: '#003f88',
  藏青: '#000080',
  紫色: '#af52de',
  紫: '#af52de',
  黑色: '#111111',
  黑: '#111111',
  白色: '#ffffff',
  白: '#ffffff',
  灰色: '#8e8e93',
  灰: '#8e8e93',
  棕色: '#8b5a2b',
  棕: '#8b5a2b',
  褐色: '#8b5a2b',
  褐: '#8b5a2b',
};

export function findColor(text: string) {
  const key = Object.keys(colorMap).find((name) => text.includes(name));
  return key ? colorMap[key] : undefined;
}
