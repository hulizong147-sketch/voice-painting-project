import type { DrawingCommand, ShapeKind } from '../types';
import { findColor } from './colors';

const shapeNames: Array<[ShapeKind, RegExp]> = [
  ['circle', /圆|圆形|圈/],
  ['rect', /矩形|长方形|方块|正方形/],
  ['triangle', /三角|三角形/],
  ['line', /线|直线/],
  ['star', /星星|星形|五角星/],
  ['text', /文字|文本|标题/],
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

function findCount(text: string) {
  const explicit = text.match(/(\d+)\s*(个|只|条)?/);
  if (explicit) {
    return Number(explicit[1]);
  }
  const chineseNumbers: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const matched = Object.entries(chineseNumbers).find(([word]) => text.includes(`${word}个`) || text.includes(`${word}只`) || text.includes(`${word}条`));
  return matched?.[1];
}

function findPosition(text: string) {
  return positionWords.find(([pattern]) => pattern.test(text))?.[1] ?? {};
}

function findTargetPosition(text: string) {
  if (/最左|左边/.test(text)) {
    return 'leftmost' as const;
  }
  if (/最右|右边/.test(text)) {
    return 'rightmost' as const;
  }
  if (/最上|上面|顶部/.test(text)) {
    return 'topmost' as const;
  }
  if (/最下|下面|底部/.test(text)) {
    return 'bottommost' as const;
  }
  return undefined;
}

function findOpacity(text: string) {
  if (/不透明/.test(text)) {
    return 1;
  }
  if (/半透明/.test(text)) {
    return 0.5;
  }
  const percent = text.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!percent) {
    return undefined;
  }
  const value = Number(percent[1]);
  return value > 1 ? value / 100 : value;
}

function findTextContent(rawText: string) {
  const quoted = rawText.match(/[“"'](.+?)[”"']/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }
  const match = rawText.match(/(?:写|写上|添加|加上|输入|放上)(?:一段|一个|些)?(?:文字|文本|标题|标签)?[:：]?\s*(.+)$/);
  return match?.[1]?.trim();
}

function findUpdatedTextContent(rawText: string) {
  const quoted = rawText.match(/[“"'](.+?)[”"']/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }
  const match = rawText.match(/(?:把)?(?:选中)?(?:文字|文本|标题|标签)?(?:内容)?(?:改成|改为|修改为|替换为|换成|设为)[:：]?\s*(.+)$/);
  return match?.[1]?.trim();
}

export function parseSingleCommand(rawText: string): DrawingCommand {
  const text = rawText.replace(/\s+/g, '').trim();
  if (/(女人|女性|女生|女孩|女头像|女人的头|女性头像|女生头像|女孩的脸|女孩头像)/.test(rawText) && /(头|头像|脸|面部)/.test(rawText)) {
    return { intent: 'draw_template', template: 'woman_head' };
  }
  if (!text) {
    return { intent: 'unknown', reason: '没有识别到命令' };
  }

  if (/撤销|退回|上一步/.test(text)) {
    return { intent: 'undo', steps: findCount(text) };
  }
  if (/重做|恢复|下一步/.test(text)) {
    return { intent: 'redo', steps: findCount(text) };
  }
  if (/新建画布|新建项目|重新开始|新画布/.test(text)) {
    return { intent: 'new_canvas' };
  }
  if (/清空|清除画布|全部删除/.test(text) && !/圆|矩形|长方形|方块|正方形|三角|线|直线|星星|星形|五角星|文字|文本|标题|红|蓝|绿|黄|黑|白|紫|粉|橙|灰/.test(text)) {
    return { intent: 'clear_canvas' };
  }
  if (/隐藏帮助|关闭帮助|收起帮助/.test(text)) {
    return { intent: 'show_help', visible: false };
  }
  if (/帮助|显示命令|命令列表|怎么用|可以说什么/.test(text)) {
    return { intent: 'show_help', visible: true };
  }
  if (/不是|不对|等一下|等等|改成|换成|修正/.test(text) && !/所有|全部|批量/.test(text)) {
    const correctionColor = findColor(text);
    if (correctionColor) {
      return { intent: 'correct_last', updates: { color: correctionColor } };
    }
    if (/大一点|放大|变大/.test(text)) {
      const factor = Number(text.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 1.25);
      return { intent: 'correct_last', updates: { sizeFactor: factor } };
    }
    if (/小一点|缩小|变小/.test(text)) {
      const factor = Number(text.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 1.25);
      return { intent: 'correct_last', updates: { sizeFactor: 1 / factor } };
    }
    if (/旋转/.test(text)) {
      const angle = Number(text.match(/-?\d+/)?.[0] ?? 45);
      return { intent: 'correct_last', updates: { angle } };
    }
  }
  if (/笑脸|笑脸模板/.test(text)) {
    return { intent: 'draw_template', template: 'smiley' };
  }
  if (/柱状图|柱形图|条形图/.test(text)) {
    return { intent: 'draw_template', template: 'bar_chart' };
  }
  if (/流程图|流程/.test(text)) {
    return { intent: 'draw_template', template: 'flowchart' };
  }
  if (/太阳|日出|阳光/.test(text)) {
    return { intent: 'draw_template', template: 'sun' };
  }
  if (/房子|房屋|小屋/.test(text)) {
    return { intent: 'draw_template', template: 'house' };
  }
  if (/删除选中|删掉选中|移除选中/.test(text)) {
    return { intent: 'delete_selected' };
  }
  if (/反选|选择反向|反向选择/.test(text)) {
    return { intent: 'invert_selection' };
  }
  if (/取消选择|取消选中|清除选择|清空选择|放下选中/.test(text)) {
    return { intent: 'clear_selection' };
  }
  if (/全选|选中全部|选择全部/.test(text)) {
    return { intent: 'select_all' };
  }
  if (/选中|选择/.test(text) && /可见对象|可见图形|显示对象|显示图形/.test(text)) {
    return { intent: 'select_by_visibility', visible: true };
  }
  if (/选中|选择/.test(text) && /隐藏对象|隐藏图形/.test(text)) {
    return { intent: 'select_by_visibility', visible: false };
  }
  if (/粘贴|贴上|贴出来/.test(text)) {
    return { intent: 'paste_selected' };
  }
  if (/复制一份|复制出|克隆|再来一个|再复制一个|重复一个/.test(text)) {
    return { intent: 'duplicate_selected' };
  }
  if (/复制|拷贝/.test(text)) {
    return { intent: 'copy_selected' };
  }
  if (/取消组合|取消分组|解除组合|解除分组|拆散|解组/.test(text)) {
    return { intent: 'ungroup_selected' };
  }
  if (/组合|分组|成组|合并成组/.test(text)) {
    return { intent: 'group_selected' };
  }
  if (/解锁|取消锁定|解除锁定/.test(text)) {
    return { intent: 'lock_selected', locked: false };
  }
  if (/锁定|锁住|固定/.test(text)) {
    return { intent: 'lock_selected', locked: true };
  }
  if (/显示全部对象|显示所有对象|显示隐藏对象|显示所有图形|显示全部图形/.test(text)) {
    return { intent: 'show_all_objects' };
  }
  if (/隐藏选中|隐藏当前|隐藏这个|隐藏对象|隐藏图形/.test(text)) {
    return { intent: 'set_visibility_selected', visible: false };
  }
  if (/显示选中|显示当前|显示这个/.test(text)) {
    return { intent: 'set_visibility_selected', visible: true };
  }
  if (/SVG|矢量/.test(rawText) && /导出|保存|下载/.test(text)) {
    return { intent: 'export_svg' };
  }
  if (/JSON|工程|项目/.test(rawText) && /保存|下载/.test(text)) {
    return { intent: 'save_json' };
  }
  if (/JSON|工程|项目/.test(rawText) && /打开|导入|恢复/.test(text)) {
    return { intent: 'open_json' };
  }
  if (/导出|保存.*PNG|保存图片|下载/.test(text)) {
    return { intent: 'export_png' };
  }
  if (/开始画|自由画|自由绘制|涂鸦/.test(text)) {
    return { intent: 'set_free_drawing', enabled: true };
  }
  if (/停笔|停止画|结束绘制|退出画笔/.test(text)) {
    return { intent: 'set_free_drawing', enabled: false };
  }
  if (/显示网格|打开网格/.test(text)) {
    return { intent: 'toggle_grid', enabled: true };
  }
  if (/隐藏网格|关闭网格/.test(text)) {
    return { intent: 'toggle_grid', enabled: false };
  }
  if (/开启吸附|打开吸附/.test(text)) {
    return { intent: 'toggle_snap', enabled: true };
  }
  if (/关闭吸附|取消吸附/.test(text)) {
    return { intent: 'toggle_snap', enabled: false };
  }
  if (/适应屏幕|适合屏幕|重置视图|原始大小/.test(text)) {
    return { intent: 'fit_canvas' };
  }
  const canvasSizeMatch = rawText.match(/(\d{3,4})\s*[xX×*]\s*(\d{3,4})/);
  if (/画布|尺寸|大小/.test(text) && canvasSizeMatch) {
    return {
      intent: 'set_canvas_size',
      width: Number(canvasSizeMatch[1]),
      height: Number(canvasSizeMatch[2]),
    };
  }
  if (/画布/.test(text) && /横版|宽屏|16比9|16:9/.test(text)) {
    return { intent: 'set_canvas_size', width: 1280, height: 720 };
  }
  if (/画布/.test(text) && /竖版|竖屏|9比16|9:16/.test(text)) {
    return { intent: 'set_canvas_size', width: 720, height: 1280 };
  }
  if (/画布/.test(text) && /方形|正方形|1比1|1:1/.test(text)) {
    return { intent: 'set_canvas_size', width: 900, height: 900 };
  }
  if (/画布/.test(text) && /放大|缩放大/.test(text)) {
    return { intent: 'zoom_canvas', factor: 1.2 };
  }
  if (/画布/.test(text) && /缩小|缩放小/.test(text)) {
    return { intent: 'zoom_canvas', factor: 0.8 };
  }
  if (/画布/.test(text) && /左/.test(text)) {
    return { intent: 'pan_canvas', dx: -80, dy: 0 };
  }
  if (/画布/.test(text) && /右/.test(text)) {
    return { intent: 'pan_canvas', dx: 80, dy: 0 };
  }
  if (/画布/.test(text) && /上/.test(text)) {
    return { intent: 'pan_canvas', dx: 0, dy: -80 };
  }
  if (/画布/.test(text) && /下/.test(text)) {
    return { intent: 'pan_canvas', dx: 0, dy: 80 };
  }
  if (/置顶|放到最上面|放到最前面|移到最上面|移到最前面/.test(text)) {
    return { intent: 'bring_to_front' };
  }
  if (/置底|放到最下面|放到最底下|移到最下面|移到最底下/.test(text)) {
    return { intent: 'send_to_back' };
  }
  if (/上移一层|放到上面/.test(text)) {
    return { intent: 'bring_forward' };
  }
  if (/下移一层|放到底下/.test(text)) {
    return { intent: 'send_backward' };
  }

  if (/横向均匀分布|水平均匀分布|横向分布|水平分布|排成一排/.test(text)) {
    return { intent: 'distribute_selected', axis: 'horizontal' };
  }
  if (/纵向均匀分布|垂直均匀分布|纵向分布|垂直分布|排成一列/.test(text)) {
    return { intent: 'distribute_selected', axis: 'vertical' };
  }
  if (/左对齐|向左对齐|对齐到左边|靠左对齐/.test(text)) {
    return { intent: 'align_selected', alignment: 'left' };
  }
  if (/右对齐|向右对齐|对齐到右边|靠右对齐/.test(text)) {
    return { intent: 'align_selected', alignment: 'right' };
  }
  if (/顶部对齐|上对齐|向上对齐|对齐到顶部|对齐到上边/.test(text)) {
    return { intent: 'align_selected', alignment: 'top' };
  }
  if (/底部对齐|下对齐|向下对齐|对齐到底部|对齐到下边/.test(text)) {
    return { intent: 'align_selected', alignment: 'bottom' };
  }
  if (/水平居中|横向居中|水平居中对齐|横向居中对齐/.test(text)) {
    return { intent: 'align_selected', alignment: 'center_horizontal' };
  }
  if (/垂直居中|纵向居中|垂直居中对齐|纵向居中对齐/.test(text)) {
    return { intent: 'align_selected', alignment: 'center_vertical' };
  }

  const moveDistance = /一点|一些/.test(text) ? 40 : Number(text.match(/(\d+)/)?.[1] ?? 80);
  if (/移动|挪|移/.test(text)) {
    if (/左/.test(text)) {
      return { intent: 'move_selected', dx: -moveDistance, dy: 0 };
    }
    if (/右/.test(text)) {
      return { intent: 'move_selected', dx: moveDistance, dy: 0 };
    }
    if (/上/.test(text)) {
      return { intent: 'move_selected', dx: 0, dy: -moveDistance };
    }
    if (/下/.test(text)) {
      return { intent: 'move_selected', dx: 0, dy: moveDistance };
    }
  }

  if (/放大|变大/.test(text)) {
    const factor = Number(text.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 1.25);
    return { intent: 'scale_selected', factor };
  }
  if (/缩小|变小/.test(text)) {
    const factor = Number(text.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 1.25);
    return { intent: 'scale_selected', factor: 1 / factor };
  }
  if (/旋转/.test(text)) {
    const angle = Number(text.match(/-?\d+/)?.[0] ?? 45);
    return { intent: 'rotate_selected', angle };
  }
  if (/水平翻转|左右翻转|横向翻转|镜像翻转/.test(text)) {
    return { intent: 'flip_selected', axis: 'horizontal' };
  }
  if (/垂直翻转|上下翻转|纵向翻转/.test(text)) {
    return { intent: 'flip_selected', axis: 'vertical' };
  }

  const widthMatch = text.match(/(?:画笔|线条|描边).*(\d+)/);
  if (/粗|细|画笔|线条|描边/.test(text) && widthMatch) {
    return { intent: 'set_stroke_width', width: Number(widthMatch[1]) };
  }

  const color = findColor(text);
  const opacity = findOpacity(text);
  if (color && /画布|背景|底色|背景色/.test(text) && /换成|改成|设为|设置|变成|用/.test(text)) {
    return { intent: 'set_canvas_background', color };
  }
  if (/透明度|透明|不透明/.test(text) && opacity !== undefined) {
    return { intent: 'set_opacity', opacity };
  }
  if (color && /描边|边框|轮廓|线条/.test(text) && /换成|改成|设为|设置|用|颜色/.test(text)) {
    return { intent: 'set_stroke_color', color };
  }
  const shape = findShape(text);
  const textSizeMatch = text.match(/(?:文字|文本|标题|字号|字体|字).*(\d+)/);
  if (/文字|文本|标题|字号|字体/.test(text) && textSizeMatch) {
    return { intent: 'set_text_size', size: Number(textSizeMatch[1]) };
  }
  if (/文字|文本|标题|字号|字体/.test(text) && /变大|放大|大一点/.test(text)) {
    return { intent: 'set_text_size', size: 48 };
  }
  if (/文字|文本|标题|字号|字体/.test(text) && /变小|缩小|小一点/.test(text)) {
    return { intent: 'set_text_size', size: 24 };
  }
  if (/取消加粗|不加粗|常规字重|普通字重/.test(text)) {
    return { intent: 'set_text_weight', bold: false };
  }
  if (/加粗|粗体|黑体/.test(text)) {
    return { intent: 'set_text_weight', bold: true };
  }
  const updatedTextContent = findUpdatedTextContent(rawText);
  if (updatedTextContent && /文字|文本|标题|标签|内容|改成|改为|修改为|替换为|换成/.test(text)) {
    return {
      intent: 'update_text_selected',
      text: updatedTextContent,
    };
  }
  const textContent = findTextContent(rawText);
  if (textContent && /写|写上|添加|加上|输入|放上|文字|文本|标题|标签/.test(text)) {
    return {
      intent: 'add_text',
      text: textContent,
      color,
      ...findPosition(text),
    };
  }
  if (/所有|全部|批量/.test(text) && /改成|变成|换成/.test(text)) {
    const [beforeText = '', afterText = ''] = text.split(/改成|变成|换成/);
    const beforeColor = findColor(beforeText);
    const afterColor = findColor(afterText) ?? color;
    if (afterColor) {
      return {
        intent: 'batch_update',
        filter: {
          shape,
          color: beforeColor,
        },
        updates: {
          color: afterColor,
        },
      };
    }
  }
  if (/删除|删掉|移除|擦掉/.test(text) && (shape || color) && /所有|全部|这些|这个|这类|红|蓝|绿|黄|黑|白|紫|粉|橙|灰/.test(text)) {
    return {
      intent: 'delete_by_description',
      filter: {
        shape,
        color,
      },
    };
  }
  if (/选中|选择/.test(text) && (shape || color || /最左|最右|最上|最下|左边|右边|上面|下面/.test(text))) {
    return {
      intent: 'select_by_description',
      shape,
      color,
      position: findTargetPosition(text),
    };
  }
  const count = findCount(text);
  if (shape && count && count > 1 && /画|绘制|放|来|生成|排成/.test(text)) {
    return {
      intent: 'draw_sequence',
      shape,
      count: Math.min(12, count),
      layout: /排成一列|一列|纵向排列|垂直排列/.test(text) ? 'column' : 'row',
      color,
      size: findSize(text),
      ...findPosition(text),
    };
  }
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
