import { create } from 'zustand';
import { drawingStyleMap } from '../drawingStyles';
import type { CommandHistoryItem, DrawingContextState, DrawingStyleId } from '../types';

interface DrawingStore extends DrawingContextState {
  setColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setOpacity: (opacity: number) => void;
  setDrawingStyle: (style: DrawingStyleId) => void;
  setSelectedCount: (selectedCount: number) => void;
  setShowGrid: (showGrid: boolean) => void;
  setSnapEnabled: (snapEnabled: boolean) => void;
  setZoom: (zoom: number) => void;
  setFreeDrawing: (freeDrawing: boolean) => void;
  setListening: (isListening: boolean) => void;
  setListeningMode: (listeningMode: 'continuous' | 'push_to_talk') => void;
  setSpeechEngine: (speechEngine: 'baidu' | 'browser' | 'idle') => void;
  setHelpVisible: (helpVisible: boolean) => void;
  setTranscript: (transcript: string) => void;
  setFeedback: (feedback: string) => void;
  addCommand: (item: CommandHistoryItem) => void;
  setCommands: (items: CommandHistoryItem[]) => void;
  clearCommands: () => void;
}

export const useDrawingStore = create<DrawingStore>((set) => ({
  currentColor: '#cf5f45',
  currentStrokeColor: '#172018',
  currentStrokeWidth: 3,
  currentOpacity: 1,
  currentDrawingStyle: 'default',
  selectedCount: 0,
  showGrid: true,
  snapEnabled: false,
  zoom: 1,
  freeDrawing: false,
  isListening: false,
  listeningMode: 'continuous',
  speechEngine: 'idle',
  helpVisible: true,
  transcript: '',
  feedback: '准备就绪，说一句“画一个红色的圆”。',
  commands: [],
  setColor: (color) => set({ currentColor: color }),
  setStrokeColor: (color) => set({ currentStrokeColor: color }),
  setStrokeWidth: (width) => set({ currentStrokeWidth: width }),
  setOpacity: (opacity) => set({ currentOpacity: opacity }),
  setDrawingStyle: (style) => {
    const preset = drawingStyleMap[style];
    set({
      currentDrawingStyle: style,
      currentColor: preset.fill,
      currentStrokeColor: preset.stroke,
      currentStrokeWidth: preset.strokeWidth,
      currentOpacity: preset.opacity,
    });
  },
  setSelectedCount: (selectedCount) => set({ selectedCount }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setZoom: (zoom) => set({ zoom }),
  setFreeDrawing: (freeDrawing) => set({ freeDrawing }),
  setListening: (isListening) => set({ isListening }),
  setListeningMode: (listeningMode) => set({ listeningMode }),
  setSpeechEngine: (speechEngine) => set({ speechEngine }),
  setHelpVisible: (helpVisible) => set({ helpVisible }),
  setTranscript: (transcript) => set({ transcript }),
  setFeedback: (feedback) => set({ feedback }),
  addCommand: (item) =>
    set((state) => ({ commands: [item, ...state.commands].slice(0, 24) })),
  setCommands: (items) => set({ commands: items.slice(0, 24) }),
  clearCommands: () => set({ commands: [] }),
}));
