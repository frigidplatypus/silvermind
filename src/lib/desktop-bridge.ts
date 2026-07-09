export interface SpaceInfo {
  name: string;
  url: string;
  default_page: string;
  active: boolean;
}

function go(): any {
  return (window as any).go?.main?.App;
}

export function isDesktopApp(): boolean {
  return !!go();
}

export async function listSpacesDesktop(): Promise<SpaceInfo[]> {
  return go().ListSpaces();
}

export async function addSpaceDesktop(
  name: string,
  url: string,
  defaultPage?: string,
  _inboxPage?: string,
  authToken?: string,
  _excludeTags?: string[],
): Promise<SpaceInfo[]> {
  return go().AddSpace(name, url, defaultPage || '', '', authToken || '', []);
}

export async function updateSpaceDesktop(
  name: string,
  newName: string,
  url: string,
  defaultPage?: string,
  _inboxPage?: string,
  authToken?: string,
  _excludeTags?: string[],
): Promise<SpaceInfo[]> {
  return go().UpdateSpace(name, newName, url, defaultPage || '', '', authToken || '', []);
}

export async function removeSpaceDesktop(name: string): Promise<SpaceInfo[]> {
  return go().RemoveSpace(name);
}

export async function setActiveSpaceDesktop(name: string): Promise<SpaceInfo[]> {
  return go().SetActiveSpace(name);
}

export async function getConfigPath(): Promise<string> {
  return go().GetConfigPath();
}

export interface ConfigStatusDesktop {
  exists: boolean;
  space_count: number;
  spaces: SpaceInfo[];
}

export async function getConfigStatusDesktop(): Promise<ConfigStatusDesktop> {
  return go().GetConfigStatus();
}

export interface VerifyResultDesktop {
  ok: boolean;
  task_count?: number;
  error?: string;
}

export async function verifySpaceDesktop(
  url: string,
  authToken?: string,
): Promise<VerifyResultDesktop> {
  const { verifySpace } = await import('$lib/backend/space-operations');
  return verifySpace(url, authToken);
}

export function notifyAlertDesktop(title: string, body: string): void {
  try {
    go().NotifyAlert(title, body);
  } catch {
    /* silently fail */
  }
}
