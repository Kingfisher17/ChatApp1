/**
 * Undo/Redo stack implementation for image editor
 */

export interface EditorState {
  rotation: number;
  scale: number;
  translateX: number;
  translateY: number;
  cropWidth: number;
  cropHeight: number;
  brightness: number;
  contrast: number;
  saturation: number;
  drawings: any[];
  textStickers: any[];
}

export class UndoRedoStack {
  private undoStack: EditorState[] = [];
  private redoStack: EditorState[] = [];
  private maxStackSize: number;

  constructor(maxStackSize: number = 50) {
    this.maxStackSize = maxStackSize;
  }

  /**
   * Save current state to undo stack
   */
  saveState(state: EditorState): void {
    // Deep clone the state
    const clonedState = this.cloneState(state);
    
    // Add to undo stack
    this.undoStack.push(clonedState);
    
    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    this.redoStack = [];
  }

  /**
   * Undo last action
   */
  undo(currentState: EditorState): EditorState | null {
    if (this.undoStack.length === 0) {
      return null;
    }
    
    // Save current state to redo stack
    this.redoStack.push(this.cloneState(currentState));
    
    // Pop from undo stack
    const previousState = this.undoStack.pop();
    
    return previousState || null;
  }

  /**
   * Redo last undone action
   */
  redo(currentState: EditorState): EditorState | null {
    if (this.redoStack.length === 0) {
      return null;
    }
    
    // Save current state to undo stack
    this.undoStack.push(this.cloneState(currentState));
    
    // Pop from redo stack
    const nextState = this.redoStack.pop();
    
    return nextState || null;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear both stacks
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Deep clone state
   */
  private cloneState(state: EditorState): EditorState {
    return {
      rotation: state.rotation,
      scale: state.scale,
      translateX: state.translateX,
      translateY: state.translateY,
      cropWidth: state.cropWidth,
      cropHeight: state.cropHeight,
      brightness: state.brightness,
      contrast: state.contrast,
      saturation: state.saturation,
      drawings: state.drawings.map(d => ({
        ...d,
        points: [...d.points],
      })),
      textStickers: state.textStickers.map(s => ({...s})),
    };
  }
}


