export interface Space {
  id: string;
  name: string;
  url: string;
  active: boolean;
  is_default: boolean;
}

export type SpacesResponse = Space[];
