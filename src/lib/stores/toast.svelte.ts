import type { ToastComponent } from '$lib/types/toast';

let _toastRef: ToastComponent | null = null;

export function registerToast(ref: ToastComponent | null) {
  _toastRef = ref;
}

export function showError(message: string) {
  _toastRef?.showError(message);
}

export function showSuccess(message: string) {
  _toastRef?.showSuccess(message);
}
