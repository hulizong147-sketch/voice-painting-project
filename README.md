# VoiceDraw AI 语音绘图工具

VoiceDraw 是围绕“AI 语音绘图工具”题目开发的浏览器绘图应用。用户可以通过语音指令完成图形创建、对象选择、编辑、布局、导出以及 AI 草稿生成等操作，核心目标是验证纯语音绘图场景下的指令理解、容错、响应延迟和复杂指令拆解能力。

## 功能概览

- 语音输入：支持百度短语音识别，浏览器 Web Speech API 作为降级方案。
- 指令理解：内置中文规则解析器，支持颜色、形状、数量、位置、选择、编辑、撤销重做等常见口语表达。
- 复杂指令：支持“画一个蓝色三角形，然后画一个黄色星星”这类多步语音拆解并顺序执行。
- 画布能力：基于 Fabric.js 实现矢量画布、对象选择、移动、缩放、旋转、翻转、对齐、分布、编组、锁定、隐藏、图层调整。
- 画风状态：支持默认、二次元、水墨、简笔画风，并在顶部状态栏显示当前画风。
- AI 草稿：接入 Right Code 绘图接口，可根据语音/文本 prompt 生成 AI 草稿并放入画布。
- 局部修改：支持“加尾巴、加耳朵、戴帽子、加胡须、眼睛变大、线条加粗”等局部编辑，其中简单局部编辑会叠加新图层，避免重绘破坏原图细节。
- 反馈闭环：命令执行后展示文字反馈，并通过百度 TTS 或浏览器语音合成播报结果。
- 文件能力：支持 PNG、SVG 导出，支持 JSON 工程保存与恢复。

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

启动后打开：

```text
http://127.0.0.1:5173/
```

如果 Windows 终端中文显示乱码，可先执行：

```powershell
chcp 65001
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
npm run dev
```

## 环境变量

复制 `.env.example` 为 `.env`，按需填写：

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
- `ENABLE_LOCAL_SKETCH_FALLBACK=true` 只建议本地调试时使用，正式演示建议关闭，避免出现占位草稿。

## 常用语音指令

基础绘图：

- “画一个红色的圆”
- “画三个蓝色三角形排成一排”
- “画一个黄色星星”
- “添加文字 VoiceDraw”
- “画一个房子”
- “画一个流程图”

选择与编辑：

- “选中红色的圆”
- “选中最左边的圆”
- “向右移动一点”
- “放大一点”
- “旋转 45 度”
- “水平翻转”
- “左对齐”
- “横向均匀分布”
- “复制选中”
- “粘贴”
- “删除选中”

样式与画布：

- “换成蓝色”
- “描边改成黑色”
- “画笔粗细 6”
- “透明度 50%”
- “切换成二次元画风”
- “以后用水墨画风”
- “显示网格”
- “开启吸附”
- “画布改成 1280x720”
- “适应屏幕”

AI 绘图与局部修改：

- “画一个松鼠”
- “画一个二次元少女头像”
- “AI 画笔画一个长发二次元少女头像线稿”
- “给它戴帽子”
- “给它加胡须”
- “眼睛变大一点”
- “线条加粗”

历史与导出：

- “撤销”
- “撤销三步”
- “重做”
- “导出 PNG”
- “导出 SVG”
- “保存 JSON 工程”
- “打开 JSON 工程”
- “新建画布”

## 项目结构

```text
server/                 本地后端代理，负责百度 ASR/TTS 和 AI 生图接口
scripts/dev.mjs          同时启动后端代理和 Vite 前端
src/App.tsx              应用主界面、语音命令入口和侧栏
src/components/          画布工作区和 AI 草稿测试面板
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

- 浏览器安全限制下，首次使用语音需要用户手动授权麦克风。
- 百度短语音识别对噪声、麦克风距离和口音较敏感，嘈杂环境下识别质量会下降。
- 当前 NLU 主要是规则解析，能覆盖比赛演示和常见绘图口令，但还不是通用自然语言智能体。
- AI 生图耗时取决于外部接口，复杂 prompt 可能超过 5 秒。
- “只局部改动不改变原图细节”目前对帽子、胡须、尾巴等使用叠加图层策略，更高级的精确局部编辑仍需图像分割或局部 inpainting 能力。
