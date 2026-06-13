# VoiceDraw

VoiceDraw is a browser-based voice drawing workbench built from the project design document. It uses React, TypeScript, Vite, Fabric.js, Web Speech API, SpeechSynthesis, and a local rule-based Chinese NLU parser.

## Run

```bash
npm install
npm run dev -- --port 5173
```

Open http://127.0.0.1:5173.

## Implemented

- Fabric.js vector canvas with circle, rectangle, triangle, line, and star creation.
- Chinese text and voice command parsing for basic drawing commands.
- Continuous Web Speech API listening with zh-CN recognition.
- SpeechSynthesis feedback after command execution.
- Command decomposition for multi-step instructions such as "画一个蓝色三角形，然后画一个红色的圆".
- Current drawing context for fill color, stroke color, stroke width, opacity, selected count, grid state, and free drawing mode.
- Undo and redo based on canvas snapshots.
- Object operations: select all, delete selected, copy, paste, duplicate, move, scale, rotate, align, distribute, style, bring forward, send backward.
- Natural language object selection by color, shape, and simple positional words.
- Relative drawing near the current selection.
- Built-in smiley and bar chart templates.
- Additional templates for flowcharts, suns, and houses.
- Free drawing mode using Fabric PencilBrush.
- Grid visibility toggle and status display.
- PNG export.
- SVG export.
- Canvas JSON save and restore.
- Batch color updates by simple object filters.
- Correction commands that revise the most recently touched objects.
- Canvas view controls for zoom, reset-to-fit, pan, and grid snapping.
- Listening mode switch between continuous recognition and push-to-talk.
- In-app command help panel with voice/text commands for showing or hiding help.
- Manual text command fallback for browsers without speech recognition.

## Example Commands

- 画一个红色的圆
- 画一个蓝色三角形，然后画一个黄色星星
- 换成绿色
- 描边改成蓝色
- 画笔粗细 8
- 透明度 50%
- 半透明
- 向右移动一点
- 放大两倍
- 旋转 45 度
- 复制选中
- 粘贴
- 复制一份
- 左对齐
- 水平居中
- 横向均匀分布
- 排成一列
- 选中红色的圆
- 选中最左边的圆
- 画一个笑脸
- 画一个柱状图
- 画一个流程图
- 画一个太阳
- 画一个房子
- 把所有红色圆改成蓝色
- 导出 SVG
- 保存 JSON 工程
- 打开 JSON 工程
- 不对，改成深蓝色
- 等一下，放大一点
- 不是，旋转 30 度
- 放大画布
- 缩小画布
- 适应屏幕
- 开启吸附
- 画布向右移动
- 切换到按住说话，然后按住空格发出命令
- 帮助
- 隐藏帮助
- 删除选中
- 撤销
- 重做
- 开始画
- 停笔
- 隐藏网格
- 导出 PNG

## Partially Implemented

- Voice capture uses the browser Web Speech API. Whisper and third-party ASR are not integrated yet.
- NLU uses deterministic local rules. LLM fallback is not integrated yet.
- Context management covers current color, stroke width, selection count, grid, free drawing, history, and feedback. Pronoun/reference resolution is not implemented.
- Natural language selection supports simple color, shape, and edge-position filters. More complex phrases such as "第二个圆" or "离三角形最近的矩形" are not implemented yet.

## Not Yet Implemented

- Backend FastAPI/WebSocket service.
- Offline Whisper pipeline.
- LLM-based generative drawing.
- Advanced spatial relation understanding.
- Templates such as smiley faces and charts.
- Accessibility audit automation and latency benchmarking.
