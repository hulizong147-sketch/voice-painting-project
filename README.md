# VoiceDraw AI 语音绘图工具

VoiceDraw 是围绕“AI 语音绘图工具”题目开发的浏览器绘图应用。项目目标是让用户主要通过语音完成绘图创作，包括绘制、选择、编辑、画风设置、AI 草稿生成、局部修改和导出。

当前版本的界面按“纯语音控制”思路收敛：顶部颜色、画笔粗细、画风等状态为只读展示，必须通过语音指令调整；AI 生成结果默认放在画布中心，并会参考顶部当前颜色、画笔粗细和画风生成。

## 功能概览

- 语音输入：支持百度短语音识别，浏览器 Web Speech API 作为降级方案。
- 指令理解：本地中文规则 NLU，支持颜色、形状、数量、位置、选择、编辑、撤销重做等口语表达。
- 复杂指令拆解：支持“然后、接着、并且、同时”等连接词，将一句话拆成多条指令顺序执行。
- 画布编辑：基于 Fabric.js 实现矢量画布、选择、移动、缩放、旋转、对齐、分布、删除、撤销、重做和导出。
- 状态驱动：当前颜色、画笔粗细、画风、选中数量和缩放比例显示在顶部状态栏。
- 语音调状态：可说“换成棕色”“画笔粗细 6”“切换成水墨画风”等更新当前状态。
- AI 草稿：接入 Right Code Draw API，根据语音 prompt 生成图片并放入画布中心。
- AI 状态联动：AI 生成会自动参考当前颜色、画笔粗细和画风；例如“换成棕色”后再画松鼠，会要求主体大面积使用棕色。
- 局部修改：支持“给它戴帽子、加胡须、加尾巴、眼睛变大、线条加粗”等局部叠加，不替换原图。
- 反馈闭环：命令执行后显示文字反馈，并通过百度 TTS 或浏览器语音合成播报。

## 技术栈

- 前端：React 18、TypeScript、Vite
- 画布：Fabric.js
- 状态管理：Zustand
- 图标：lucide-react
- 语音识别：百度智能云短语音识别，浏览器 Web Speech API fallback
- 语音播报：百度 TTS，浏览器 SpeechSynthesis fallback
- AI 生图：Right Code Draw API，OpenAI Images API fallback

## 快速运行

```bash
npm install
copy .env.example .env
npm run dev
```

打开：

```text
http://127.0.0.1:5173/
```

Windows 终端中文乱码时可先执行：

```powershell
chcp 65001
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
npm run dev
```

## 环境变量

复制 `.env.example` 为 `.env`，填写需要的接口密钥：

```bash
BAIDU_ASR_API_KEY=your_baidu_api_key
BAIDU_ASR_SECRET_KEY=your_baidu_secret_key
BAIDU_ASR_CUID=voicedraw-web
BAIDU_ASR_DEV_PID=1537

BAIDU_TTS_CUID=voicedraw-web
BAIDU_TTS_PER=0
BAIDU_TTS_SPD=5
BAIDU_TTS_PIT=5
BAIDU_TTS_VOL=7
BAIDU_TTS_AUE=3

RIGHT_CODES_DRAW_API_KEY=your_right_codes_draw_key
RIGHT_CODES_DRAW_BASE_URL=https://www.right.codes/draw
RIGHT_CODES_DRAW_MODEL=gpt-image-2
RIGHT_CODES_DRAW_SIZE=1024x1024
RIGHT_CODES_DRAW_RESPONSE_FORMAT=url

OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1024

ENABLE_LOCAL_SKETCH_FALLBACK=false
```

说明：

- 百度 ASR/TTS 用于语音识别和语音反馈。
- Right Code Draw API 用于 AI 草稿生成。
- OpenAI Images 是备用生图接口。
- `ENABLE_LOCAL_SKETCH_FALLBACK=true` 仅建议本地调试时使用。

## 常用语音指令

基础绘图：

- “画一个红色的圆”
- “画三个蓝色三角形排成一排”
- “画一个黄色星星”
- “添加文字 VoiceDraw”
- “画一个房子”
- “画一个流程图”

复杂指令拆解：

- “画一个红色的圆，然后画三个蓝色三角形排成一排”
- “选中红色的圆，然后向右移动一点，然后放大一点”
- “切换成水墨画风，然后换成棕色，然后画一个松鼠”

状态控制：

- “换成棕色”
- “画笔粗细 6”
- “切换成水墨画风”
- “切换成二次元画风”
- “透明度 50%”
- “显示网格”
- “适应屏幕”

选择与编辑：

- “选中红色的圆”
- “选中最左边的圆”
- “向右移动一点”
- “放大一点”
- “旋转 45 度”
- “水平翻转”
- “删除选中”

AI 绘图与局部修改：

- “画一个松鼠”
- “画一个二次元少女头像”
- “换成棕色，然后画一个松鼠”
- “给它戴帽子”
- “给它加胡须”
- “线条加粗”

导出：

- “撤销”
- “重做”
- “导出 PNG”
- “导出 SVG”
- “新建画布”

## 项目结构

```text
server/                 本地后端代理，负责百度 ASR/TTS 和 AI 生图接口
scripts/dev.mjs          同时启动后端代理和 Vite 前端
src/App.tsx              应用主界面、语音命令入口和侧栏
src/components/          画布工作区
src/hooks/               语音识别和 Fabric 画布执行逻辑
src/nlu/                 中文命令解析与颜色词识别
src/services/            AI 草稿、路径追踪、语音播报
src/store/               全局绘图状态
src/types.ts             指令和状态类型定义
docs/                    设计文档
```

## 设计文档

完整设计说明见：

[docs/AI语音绘图工具_设计文档.md](docs/AI语音绘图工具_设计文档.md)

## 已知限制

- 浏览器首次使用麦克风必须由用户授权。
- 百度短语音识别受噪声、麦克风距离和口音影响。
- 当前 NLU 是本地规则解析，适合演示和常见绘图口令，但不是通用自然语言智能体。
- AI 生图耗时取决于外部接口，复杂 prompt 可能需要等待。
- AI 图片是一整张图片，不能像矢量对象一样精确选择“皮毛、眼睛、尾巴”等局部区域。
- 局部修改采用叠加图层策略，适合加帽子、胡须等，不是真正的图像局部重绘。
