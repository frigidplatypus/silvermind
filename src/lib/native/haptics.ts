export async function impactLight(): Promise<void> {
  try {
    const { Haptics } = await import('@capacitor/haptics') as any;
    await Haptics.impact({ style: 'LIGHT' });
  } catch { /* no haptics available */ }
}

export async function impactMedium(): Promise<void> {
  try {
    const { Haptics } = await import('@capacitor/haptics') as any;
    await Haptics.impact({ style: 'MEDIUM' });
  } catch { /* no haptics available */ }
}

export async function impactHeavy(): Promise<void> {
  try {
    const { Haptics } = await import('@capacitor/haptics') as any;
    await Haptics.impact({ style: 'HEAVY' });
  } catch { /* no haptics available */ }
}

export async function notifySuccess(): Promise<void> {
  try {
    const { Haptics } = await import('@capacitor/haptics') as any;
    await Haptics.notification({ type: 'SUCCESS' });
  } catch { /* no haptics available */ }
}

export async function notifyError(): Promise<void> {
  try {
    const { Haptics } = await import('@capacitor/haptics') as any;
    await Haptics.notification({ type: 'ERROR' });
  } catch { /* no haptics available */ }
}

export async function notifyWarning(): Promise<void> {
  try {
    const { Haptics } = await import('@capacitor/haptics') as any;
    await Haptics.notification({ type: 'WARNING' });
  } catch { /* no haptics available */ }
}
