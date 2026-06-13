import { create } from 'zustand';
import type { CommandHistoryItem, DrawingContextState } from '../types';

interface DrawingStore extends DrawingContextState {
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setSelectedCount: (selectedCount: number) => void;
  setShowGrid: (showGrid: boolean) => void;
  setSnapEnabled: (snapEnabled: boolean) => void;
  setZoom: (zoom: number) => void;
  setFreeDrawing: (freeDrawing: boolean) => void;
  setListening: (isListening: boolean) => void;
  setTranscript: (transcript: string) => void;
  setFeedback: (feedback: string) => void;
  addCommand: (item: CommandHistoryItem) => void;
}

export const useDrawingStore = create<DrawingStore>((set) => ({
  currentColor: '#cf5f45',
  currentStrokeColor: '#172018',
  currentStrokeWidth: 3,
  selectedCount: 0,
  showGrid: true,
  snapEnabled: false,
  zoom: 1,
  freeDrawing: false,
  isListening: false,
  transcript: '',
  feedback: '准备就绪，说一句“画一个红色的圆”。',
  commands: [],
  setColor: (color) => set({ currentColor: color }),
  setStrokeWidth: (width) => set({ currentStrokeWidth: width }),
  setSelectedCount: (selectedCount) => set({ selectedCount }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setZoom: (zoom) => set({ zoom }),
  setFreeDrawing: (freeDrawing) => set({ freeDrawing }),
  setListening: (isListening) => set({ isListening }),
  setTranscript: (transcript) => set({ transcript }),
  setFeedback: (feedback) => set({ feedback }),
  addCommand: (item) =>
    set((state) => ({ commands: [item, ...state.commands].slice(0, 24) })),
}));
