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

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useSpeechRecognition(onFinalText: (text: string) => void) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const setListening = useDrawingStore((state) => state.setListening);
  const setTranscript = useDrawingStore((state) => state.setTranscript);
  const setFeedback = useDrawingStore((state) => state.setFeedback);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }, [setListening]);

  const start = useCallback(() => {
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
    };
    recognition.onend = () => {
      if (shouldListenRef.current) {
        recognition.start();
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    shouldListenRef.current = true;
    recognition.start();
    setListening(true);
    setFeedback('正在监听。');
  }, [onFinalText, setFeedback, setListening, setTranscript]);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  return { start, stop };
}
