package task

type Task struct {
	Page      string   `json:"page"`
	Position  int      `json:"position"`
	Text      string   `json:"text"`
	Status    string   `json:"status"`
	Done      bool     `json:"done"`
	Due       string   `json:"due,omitempty"`
	Scheduled string   `json:"scheduled,omitempty"`
	Name      string   `json:"name,omitempty"`
	Priority  string   `json:"priority,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Parent    string   `json:"parent,omitempty"`
	DependsOn []string `json:"depends_on,omitempty"`
	Blocked   bool     `json:"blocked"`
	Recur     string            `json:"recur,omitempty"`
	ExtraAttrs map[string]string `json:"extra_attrs,omitempty"`
	RawLine   string            `json:"rawline,omitempty"`
}

const (
	StatusActive  = ""
	StatusWaiting = "waiting"
	StatusMaybe   = "maybe"
	StatusDone    = "x"
)

type TaskFilter struct {
	Status          []string
	Page            string
	DueBefore       string
	DueAfter        string
	ScheduledBefore string
	ScheduledAfter  string
	Name            string
	Priority        string
	Tags            []string
	ExcludeTags     []string
	Parent          string
	Orphan          bool
	Recur           bool
	Overdue         bool
	TextSearch      string
	SortBy          string
	SortOrder       string
	Limit           int
	Offset          int
}
