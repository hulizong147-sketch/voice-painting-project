import { create } from 'zustand';
import type { CommandHistoryItem, DrawingContextState } from '../types';

interface DrawingStore extends DrawingContextState {
  setColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setOpacity: (opacity: number) => void;
  setSelectedCount: (selectedCount: number) => void;
  setShowGrid: (showGrid: boolean) => void;
  setSnapEnabled: (snapEnabled: boolean) => void;
  setZoom: (zoom: number) => void;
  setFreeDrawing: (freeDrawing: boolean) => void;
  setListening: (isListening: boolean) => void;
  setListeningMode: (listeningMode: 'continuous' | 'push_to_talk') => void;
  setHelpVisible: (helpVisible: boolean) => void;
  setTranscript: (transcript: string) => void;
  setFeedback: (feedback: string) => void;
  addCommand: (item: CommandHistoryItem) => void;
}

export const useDrawingStore = create<DrawingStore>((set) => ({
  currentColor: '#cf5f45',
  currentStrokeColor: '#172018',
  currentStrokeWidth: 3,
  currentOpacity: 1,
  selectedCount: 0,
  showGrid: true,
  snapEnabled: false,
  zoom: 1,
  freeDrawing: false,
  isListening: false,
  listeningMode: 'continuous',
  helpVisible: true,
  transcript: '',
  feedback: '准备就绪，说一句“画一个红色的圆”。',
  commands: [],
  setColor: (color) => set({ currentColor: color }),
  setStrokeColor: (color) => set({ currentStrokeColor: color }),
  setStrokeWidth: (width) => set({ currentStrokeWidth: width }),
  setOpacity: (opacity) => set({ currentOpacity: opacity }),
  setSelectedCount: (selectedCount) => set({ selectedCount }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setZoom: (zoom) => set({ zoom }),
  setFreeDrawing: (freeDrawing) => set({ freeDrawing }),
  setListening: (isListening) => set({ isListening }),
  setListeningMode: (listeningMode) => set({ listeningMode }),
  setHelpVisible: (helpVisible) => set({ helpVisible }),
  setTranscript: (transcript) => set({ transcript }),
  setFeedback: (feedback) => set({ feedback }),
  addCommand: (item) =>
    set((state) => ({ commands: [item, ...state.commands].slice(0, 24) })),
}));
