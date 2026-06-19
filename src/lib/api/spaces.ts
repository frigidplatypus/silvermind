import { api } from './client';
import type { SpacesResponse } from '$lib/types/space';

export async function getSpaces(): Promise<SpacesResponse> {
  return api.get<SpacesResponse>('/spaces');
}
