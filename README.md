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
- Current drawing context for color, stroke width, selected count, grid state, and free drawing mode.
- Undo and redo based on canvas snapshots.
- Object operations: select all, delete selected, move, scale, rotate, bring forward, send backward.
- Free drawing mode using Fabric PencilBrush.
- Grid visibility toggle and status display.
- PNG export.
- Manual text command fallback for browsers without speech recognition.

## Example Commands

- 画一个红色的圆
- 画一个蓝色三角形，然后画一个黄色星星
- 换成绿色
- 画笔粗细 8
- 向右移动一点
- 放大两倍
- 旋转 45 度
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
- Object selection is available through canvas direct selection and "全选"; natural language target selection such as "选中最左边的圆" is not implemented yet.

## Not Yet Implemented

- Backend FastAPI/WebSocket service.
- Offline Whisper pipeline.
- LLM-based generative drawing.
- Advanced spatial relation understanding.
- Batch property editing by semantic filters.
- Templates such as smiley faces and charts.
- Accessibility audit automation and latency benchmarking.
