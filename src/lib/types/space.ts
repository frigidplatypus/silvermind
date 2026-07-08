export interface Space {
  id: string;
  name: string;
  url: string;
  inbox_page: string;
  default_exclude_tags: string[];
  active: boolean;
  is_default: boolean;
}

export type SpacesResponse = Space[];
