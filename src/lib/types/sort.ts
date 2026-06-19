export type SortMode = 'priority-then-date' | 'created-desc' | 'due-asc' | 'alpha-asc';

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'priority-then-date', label: 'Priority' },
  { value: 'created-desc', label: 'Newest First' },
  { value: 'due-asc', label: 'Due Date' },
  { value: 'alpha-asc', label: 'Alphabetical' },
];
