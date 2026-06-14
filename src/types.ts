export type ShapeKind = 'circle' | 'rect' | 'triangle' | 'line' | 'star' | 'text';

export type DrawingStyleId = 'default' | 'anime' | 'ink' | 'simple';

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
  | {
      intent: 'draw_sequence';
      shape: ShapeKind;
      count: number;
      layout: 'row' | 'column';
      color?: string;
      strokeColor?: string;
      size?: number;
      x?: number;
      y?: number;
    }
  | {
      intent: 'add_text';
      text: string;
      color?: string;
      x?: number;
      y?: number;
    }
  | { intent: 'update_text_selected'; text: string }
  | { intent: 'set_text_size'; size: number }
  | { intent: 'set_text_weight'; bold: boolean }
  | { intent: 'set_color'; color: string }
  | { intent: 'set_stroke_color'; color: string }
  | { intent: 'set_stroke_width'; width: number }
  | { intent: 'set_opacity'; opacity: number }
  | { intent: 'set_drawing_style'; style: DrawingStyleId }
  | { intent: 'set_canvas_background'; color: string }
  | { intent: 'select_all' }
  | { intent: 'clear_selection' }
  | { intent: 'invert_selection' }
  | { intent: 'select_by_visibility'; visible: boolean }
  | {
      intent: 'select_by_description';
      shape?: ShapeKind;
      color?: string;
      position?: 'leftmost' | 'rightmost' | 'topmost' | 'bottommost';
    }
  | { intent: 'delete_selected' }
  | {
      intent: 'delete_by_description';
      filter: {
        shape?: ShapeKind;
        color?: string;
      };
    }
  | { intent: 'copy_selected' }
  | { intent: 'paste_selected' }
  | { intent: 'duplicate_selected' }
  | { intent: 'group_selected' }
  | { intent: 'ungroup_selected' }
  | { intent: 'lock_selected'; locked: boolean }
  | { intent: 'set_visibility_selected'; visible: boolean }
  | { intent: 'show_all_objects' }
  | { intent: 'move_selected'; dx: number; dy: number }
  | { intent: 'scale_selected'; factor: number }
  | { intent: 'rotate_selected'; angle: number }
  | { intent: 'flip_selected'; axis: 'horizontal' | 'vertical' }
  | {
      intent: 'align_selected';
      alignment: 'left' | 'right' | 'top' | 'bottom' | 'center_horizontal' | 'center_vertical';
    }
  | { intent: 'distribute_selected'; axis: 'horizontal' | 'vertical' }
  | {
      intent: 'batch_update';
      filter: {
        shape?: ShapeKind;
        color?: string;
      };
      updates: {
        color?: string;
        strokeColor?: string;
        strokeWidth?: number;
      };
    }
  | {
      intent: 'correct_last';
      updates: {
        color?: string;
        sizeFactor?: number;
        angle?: number;
      };
    }
  | { intent: 'bring_forward' }
  | { intent: 'send_backward' }
  | { intent: 'bring_to_front' }
  | { intent: 'send_to_back' }
  | { intent: 'set_free_drawing'; enabled: boolean }
  | { intent: 'toggle_grid'; enabled?: boolean }
  | { intent: 'toggle_snap'; enabled?: boolean }
  | { intent: 'zoom_canvas'; factor: number }
  | { intent: 'fit_canvas' }
  | { intent: 'set_canvas_size'; width: number; height: number }
  | { intent: 'pan_canvas'; dx: number; dy: number }
  | { intent: 'ai_brush_draw'; prompt: string }
  | {
      intent: 'draw_template';
      template:
        | 'smiley'
        | 'bar_chart'
        | 'flowchart'
        | 'sun'
        | 'house'
        | 'woman_head';
    }
  | { intent: 'undo'; steps?: number }
  | { intent: 'redo'; steps?: number }
  | { intent: 'new_canvas' }
  | { intent: 'clear_canvas' }
  | { intent: 'export_png' }
  | { intent: 'export_svg' }
  | { intent: 'save_json' }
  | { intent: 'open_json' }
  | { intent: 'show_help'; visible?: boolean }
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
  currentOpacity: number;
  currentDrawingStyle: DrawingStyleId;
  selectedCount: number;
  showGrid: boolean;
  snapEnabled: boolean;
  zoom: number;
  freeDrawing: boolean;
  isListening: boolean;
  listeningMode: 'continuous' | 'push_to_talk';
  speechEngine: 'baidu' | 'browser' | 'idle';
  helpVisible: boolean;
  transcript: string;
  feedback: string;
  commands: CommandHistoryItem[];
}
