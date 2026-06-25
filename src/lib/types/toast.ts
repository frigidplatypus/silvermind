export interface ToastComponent {
  showError(message: string): void;
  showSuccess(message: string): void;
  showUndo(message: string, onUndo: () => void): void;
}
