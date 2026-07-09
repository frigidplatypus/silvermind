// Matches the task shape returned by Silvermind's SilverBullet-backed API layer.
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
  alerts?: string[];
  extra_attrs?: Record<string, string>;
}

export interface NewTaskInput {
  text: string;
  page?: string;
  due?: string;
  deferred?: string;
  priority?: string;
  name?: string;
  tags?: string[];
}
