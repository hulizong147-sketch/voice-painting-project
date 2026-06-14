import { useCallback, useEffect, useRef } from 'react';
import { useDrawingStore } from '../store/drawingStore';

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface BaiduAsrResponse {
  text?: string;
  error?: string;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const TARGET_SAMPLE_RATE = 16000;
const VOICE_RMS_THRESHOLD = 0.01;
const CONTINUOUS_SILENCE_MS = 1300;
const CONTINUOUS_MAX_RECORDING_MS = 9000;
const CONTINUOUS_MIN_RECORDING_MS = 550;
const PRE_ROLL_BUFFER_COUNT = 12;

function mergeBuffers(buffers: Float32Array[]) {
  const length = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  buffers.forEach((buffer) => {
    result.set(buffer, offset);
    offset += buffer.length;
  });
  return result;
}

function downsample(buffer: Float32Array, inputSampleRate: number) {
  if (inputSampleRate === TARGET_SAMPLE_RATE) {
    return buffer;
  }

  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const length = Math.round(buffer.length / ratio);
  const result = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), buffer.length);
    let sum = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      sum += buffer[sampleIndex];
    }
    result[index] = sum / Math.max(1, end - start);
  }
  return result;
}

function encodeWav(samples: Float32Array) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function calculateRms(samples: Float32Array) {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }
  return Math.sqrt(sum / samples.length);
}

export function useSpeechRecognition(onFinalText: (text: string) => void) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBuffersRef = useRef<Float32Array[]>([]);
  const preRollBuffersRef = useRef<Float32Array[]>([]);
  const inputSampleRateRef = useRef(TARGET_SAMPLE_RATE);
  const baiduRecordingRef = useRef(false);
  const continuousBaiduRef = useRef(false);
  const speechActiveRef = useRef(false);
  const baiduTranscribingRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const setListening = useDrawingStore((state) => state.setListening);
  const setSpeechEngine = useDrawingStore((state) => state.setSpeechEngine);
  const setTranscript = useDrawingStore((state) => state.setTranscript);
  const setFeedback = useDrawingStore((state) => state.setFeedback);

  const stopBrowserSpeech = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setSpeechEngine('idle');
  }, [setListening, setSpeechEngine]);

  const startBrowserSpeech = useCallback(() => {
    const SpeechRecognitionApi = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      setFeedback('当前浏览器不支持 Web Speech API，可先使用文本命令。');
      return;
    }

    const recognition = recognitionRef.current ?? new SpeechRecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript.trim() ?? '';
        if (result.isFinal) {
          setTranscript('');
          onFinalText(text);
        } else {
          interim += text;
        }
      }
      if (interim) {
        setTranscript(interim);
      }
    };
    recognition.onerror = (event) => {
      setFeedback(`语音识别出错：${event.error}`);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldListenRef.current = false;
        setListening(false);
      }
    };
    recognition.onend = () => {
      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch {
          shouldListenRef.current = false;
          setListening(false);
          setFeedback('语音监听已停止，可重新开始。');
        }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    shouldListenRef.current = true;
    try {
      recognition.start();
      setListening(true);
      setSpeechEngine('browser');
      setFeedback('正在使用浏览器语音识别监听。');
    } catch {
      shouldListenRef.current = false;
      setListening(false);
      setFeedback('语音监听启动失败，可使用文本命令。');
    }
  }, [onFinalText, setFeedback, setListening, setSpeechEngine, setTranscript]);

  const resetBaiduSegmentation = useCallback(() => {
    audioBuffersRef.current = [];
    preRollBuffersRef.current = [];
    speechActiveRef.current = false;
    lastVoiceAtRef.current = 0;
    recordingStartedAtRef.current = 0;
  }, []);

  const cleanupBaiduRecording = useCallback(() => {
    audioProcessorRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioStreamRef.current = null;
    audioContextRef.current = null;
    baiduRecordingRef.current = false;
    continuousBaiduRef.current = false;
    setSpeechEngine('idle');
    resetBaiduSegmentation();
  }, [resetBaiduSegmentation, setSpeechEngine]);

  const transcribeBaiduAudio = useCallback(async (samples: Float32Array, showShortMessage: boolean) => {
    if (samples.length < inputSampleRateRef.current * 0.2) {
      if (showShortMessage) {
        setFeedback('录音太短，请说完整命令。');
      }
      return;
    }

    try {
      baiduTranscribingRef.current = true;
      setSpeechEngine('baidu');
      setFeedback('正在使用百度语音识别...');
      const wav = encodeWav(downsample(samples, inputSampleRateRef.current));
      const speech = await blobToBase64(wav);
      const response = await fetch('/api/asr/baidu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speech, format: 'wav', rate: TARGET_SAMPLE_RATE }),
      });
      const data = await response.json() as BaiduAsrResponse;
      if (!response.ok || data.error) {
        throw new Error(data.error ?? '百度语音识别失败');
      }
      const text = data.text?.trim();
      if (!text) {
        setFeedback('没有识别到有效语音，请再试一次。');
        return;
      }
      setFeedback(`识别到：${text}`);
      onFinalText(text);
    } catch (error) {
      setFeedback(error instanceof Error ? `百度语音识别失败：${error.message}` : '百度语音识别失败');
    } finally {
      baiduTranscribingRef.current = false;
      if (!baiduRecordingRef.current) {
        setSpeechEngine('idle');
      }
    }
  }, [onFinalText, setFeedback, setSpeechEngine]);

  const flushContinuousBaiduAudio = useCallback(() => {
    if (baiduTranscribingRef.current || audioBuffersRef.current.length === 0) {
      return;
    }

    const merged = mergeBuffers(audioBuffersRef.current);
    resetBaiduSegmentation();
    setTranscript('');
    void transcribeBaiduAudio(merged, false);
  }, [resetBaiduSegmentation, setTranscript, transcribeBaiduAudio]);

  const stopBaiduAsr = useCallback(async () => {
    if (!baiduRecordingRef.current) {
      stopBrowserSpeech();
      return;
    }

    const wasContinuous = continuousBaiduRef.current;
    const hadSpeech = speechActiveRef.current || audioBuffersRef.current.length > 0;
    const merged = mergeBuffers(audioBuffersRef.current);
      setListening(false);
      setSpeechEngine('idle');
      setTranscript('');
    cleanupBaiduRecording();

    if (wasContinuous) {
      if (hadSpeech) {
        await transcribeBaiduAudio(merged, false);
      } else {
        setFeedback('已停止持续监听。');
      }
      return;
    }

    await transcribeBaiduAudio(merged, true);
  }, [cleanupBaiduRecording, setFeedback, setListening, setTranscript, stopBrowserSpeech, transcribeBaiduAudio]);

  const startBaiduAsr = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      startBrowserSpeech();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const isContinuous = useDrawingStore.getState().listeningMode === 'continuous';
      resetBaiduSegmentation();
      inputSampleRateRef.current = audioContext.sampleRate;
      continuousBaiduRef.current = isContinuous;
      processor.onaudioprocess = (event) => {
        if (!baiduRecordingRef.current) {
          return;
        }

        const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
        if (!continuousBaiduRef.current) {
          audioBuffersRef.current.push(chunk);
          return;
        }

        const rms = calculateRms(chunk);
        const now = Date.now();
        if (!speechActiveRef.current) {
          preRollBuffersRef.current.push(chunk);
          if (preRollBuffersRef.current.length > PRE_ROLL_BUFFER_COUNT) {
            preRollBuffersRef.current.shift();
          }

          if (rms > VOICE_RMS_THRESHOLD && !baiduTranscribingRef.current) {
            speechActiveRef.current = true;
            recordingStartedAtRef.current = now;
            lastVoiceAtRef.current = now;
            audioBuffersRef.current = [...preRollBuffersRef.current];
            setTranscript('正在听你说话...');
          }
          return;
        }

        audioBuffersRef.current.push(chunk);
        if (rms > VOICE_RMS_THRESHOLD) {
          lastVoiceAtRef.current = now;
        }

        const recordingDuration = now - recordingStartedAtRef.current;
        const silenceDuration = now - lastVoiceAtRef.current;
        if (
          recordingDuration >= CONTINUOUS_MIN_RECORDING_MS &&
          (silenceDuration >= CONTINUOUS_SILENCE_MS || recordingDuration >= CONTINUOUS_MAX_RECORDING_MS)
        ) {
          flushContinuousBaiduAudio();
        }
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      audioContextRef.current = audioContext;
      audioStreamRef.current = stream;
      audioSourceRef.current = source;
      audioProcessorRef.current = processor;
      baiduRecordingRef.current = true;
      setListening(true);
      setSpeechEngine('baidu');
      setTranscript('');
      setFeedback(isContinuous ? '正在持续监听，说完后会自动识别。' : '正在录音，松开或再次点击后发送到百度识别。');
    } catch {
      setSpeechEngine('browser');
      setFeedback('麦克风启动失败，已退回浏览器语音识别。');
      startBrowserSpeech();
    }
  }, [flushContinuousBaiduAudio, resetBaiduSegmentation, setFeedback, setListening, setSpeechEngine, setTranscript, startBrowserSpeech]);

  const stop = useCallback(() => {
    void stopBaiduAsr();
  }, [stopBaiduAsr]);

  const start = useCallback(() => {
    void startBaiduAsr();
  }, [startBaiduAsr]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      cleanupBaiduRecording();
    };
  }, [cleanupBaiduRecording]);

  return { start, stop };
}
