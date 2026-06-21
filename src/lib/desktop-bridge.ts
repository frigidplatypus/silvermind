export interface SpaceInfo {
  name: string;
  url: string;
  default_page: string;
  inbox_page: string;
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
  inboxPage?: string,
  authToken?: string,
): Promise<SpaceInfo[]> {
  return go().AddSpace(name, url, defaultPage || '', inboxPage || '', authToken || '');
}

export async function updateSpaceDesktop(
  name: string,
  newName: string,
  url: string,
  defaultPage?: string,
  inboxPage?: string,
  authToken?: string,
): Promise<SpaceInfo[]> {
  return go().UpdateSpace(name, newName, url, defaultPage || '', inboxPage || '', authToken || '');
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
