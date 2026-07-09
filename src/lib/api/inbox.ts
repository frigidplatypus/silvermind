import { getSbClient, getActiveSpace, getSpaceConfig } from '$lib/backend/backend-context';
import { getInbox as getInboxOps } from '$lib/backend/inbox-operations';
import type { Task } from '$lib/types/task';

export async function getInbox(): Promise<Task[]> {
  const active = await getActiveSpace();
  if (!active) return [];
  const sbClient = await getSbClient();
  const spaceConfig = getSpaceConfig();
  return (await getInboxOps([active], active, sbClient, spaceConfig)) as Task[];
}
