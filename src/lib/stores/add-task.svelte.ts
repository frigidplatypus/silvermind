let _trigger = $state(0);

export function triggerAddTask() { _trigger++; }
export function getAddTaskTrigger() { return _trigger; }
