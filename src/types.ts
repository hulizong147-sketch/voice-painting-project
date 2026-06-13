export type ShapeKind = 'circle' | 'rect' | 'triangle' | 'line' | 'star';

export type DrawingCommand =
  | {
      intent: 'draw_shape';
      shape: ShapeKind;
      color?: string;
      strokeColor?: string;
      size?: number;
      x?: number;
      y?: number;
    }
  | { intent: 'set_color'; color: string }
  | { intent: 'set_stroke_width'; width: number }
  | { intent: 'select_all' }
  | {
      intent: 'select_by_description';
      shape?: ShapeKind;
      color?: string;
      position?: 'leftmost' | 'rightmost' | 'topmost' | 'bottommost';
    }
  | { intent: 'delete_selected' }
  | { intent: 'move_selected'; dx: number; dy: number }
  | { intent: 'scale_selected'; factor: number }
  | { intent: 'rotate_selected'; angle: number }
  | { intent: 'bring_forward' }
  | { intent: 'send_backward' }
  | { intent: 'set_free_drawing'; enabled: boolean }
  | { intent: 'toggle_grid'; enabled?: boolean }
  | { intent: 'draw_template'; template: 'smiley' | 'bar_chart' }
  | { intent: 'undo' }
  | { intent: 'redo' }
  | { intent: 'clear_canvas' }
  | { intent: 'export_png' }
  | { intent: 'unknown'; reason: string };

export interface CommandHistoryItem {
  id: string;
  text: string;
  result: string;
  createdAt: number;
  ok: boolean;
}

export interface DrawingContextState {
  currentColor: string;
  currentStrokeColor: string;
  currentStrokeWidth: number;
  selectedCount: number;
  showGrid: boolean;
  freeDrawing: boolean;
  isListening: boolean;
  transcript: string;
  feedback: string;
  commands: CommandHistoryItem[];
}
