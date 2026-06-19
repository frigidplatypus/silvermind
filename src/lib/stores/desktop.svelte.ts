let selectedTaskId = $state<string | null>(null);
let splitRatio = $state(0.66);
let isDesktop = $state(false);

export function getSelectedTaskId(): string | null { return selectedTaskId; }
export function getSplitRatio(): number { return splitRatio; }
export function getIsDesktop(): boolean { return isDesktop; }

export function setSelectedTaskId(id: string | null): void { selectedTaskId = id; }
export function setSplitRatio(r: number): void { splitRatio = Math.max(0.2, Math.min(0.8, r)); }
export function setDesktopMode(desktop: boolean): void { isDesktop = desktop; }
