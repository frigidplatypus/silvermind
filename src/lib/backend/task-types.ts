export interface Task {
  page: string;
  position: number;
  _spaceName?: string;
  _spaceUrl?: string;
  _spaceAuthToken?: string;
  text: string;
  status: string;
  done: boolean;
  due: string;
  due_parsed: { date: string } | null;
  deferred: string;
  deferred_parsed: { date: string } | null;
  name: string;
  priority: string;
  tags: string[];
  parent?: string;
  depends_on?: string[];
  blocked: boolean;
  recur?: string;
  alerts?: string[];
  extra_attrs?: Record<string, string>;
}

export interface TaskFilter {
  status?: string[];
  page?: string;
  dueBefore?: string;
  dueAfter?: string;
  deferredBefore?: string;
  deferredAfter?: string;
  name?: string;
  priority?: string;
  tags?: string[];
  excludeTags?: string[];
  parent?: string;
  orphan?: boolean;
  recur?: boolean;
  overdue?: boolean;
  textSearch?: string;
  sortBy?: string;
  sortOrder?: string;
  limit?: number;
  offset?: number;
}

export interface FavoriteQuery {
  page: string;
  heading: string;
  block: number;
}

export interface SpaceConfigRemote {
  inbox_mode?: string;
  inbox_page?: string;
  exclude_tags?: string[];
  default_sort_by?: string;
  default_sort_order?: string;
  favorites?: FavoriteQuery[];
}

export interface SpaceConfig {
  name: string;
  url: string;
  default_page: string;
  auth_token?: string;
}

export interface SilvermindConfig {
  spaces: Record<string, SpaceConfig>;
  active_space: string;
}

export interface QueryBlock {
  page: string;
  number: number;
  title: string;
  sliq: string;
  raw?: string;
  heading?: string;
  result_count?: number;
}

export interface QueryBlockPage {
  page: string;
  blocks: QueryBlock[];
}

export interface SilverBulletPage {
  content: string;
  lastModified: number;
}

export class SbClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'SbClientError';
    this.status = status;
    this.code = code;
  }
}

export class PreconditionFailedError extends SbClientError {
  constructor() {
    super(412, 'PRECONDITION_FAILED', 'Page was modified concurrently');
    this.name = 'PreconditionFailedError';
  }
}
