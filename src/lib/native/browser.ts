export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return true;
  } catch {
    return false;
  }
}
