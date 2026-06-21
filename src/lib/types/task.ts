// Matches sbtask serve actual API response format
export interface Task {
  page: string;
  position: number;
  text: string;
  status: string;
  done: boolean;
  due: string;
  due_parsed: { date: string } | null;
  scheduled: string;
  scheduled_parsed: { date: string } | null;
  name: string;
  priority: string;
  tags: string[];
  parent?: string;
  depends_on?: string[];
  blocked: boolean;
  recur?: string;
}

export interface NewTaskInput {
  text: string;
  page?: string;
  due?: string;
  scheduled?: string;
  priority?: string;
  name?: string;
  tags?: string[];
}
