package task

import (
	"testing"
)

func TestParseRecurrence(t *testing.T) {
	tests := []struct {
		in     string
		wantI  string
		wantN  int
		wantOk bool
	}{
		{"daily:1", "daily", 1, true},
		{"weekly:2", "weekly", 2, true},
		{"monthly:3", "monthly", 3, true},
		{"yearly:1", "yearly", 1, true},
		{"daily:0", "", 0, false},
		{"daily", "", 0, false},
		{"hourly:1", "", 0, false},
		{"daily:-1", "", 0, false},
		{"", "", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			gotI, gotN, gotOk := ParseRecurrence(tt.in)
			if gotI != tt.wantI || gotN != tt.wantN || gotOk != tt.wantOk {
				t.Errorf("ParseRecurrence(%q) = (%q, %d, %v), want (%q, %d, %v)",
					tt.in, gotI, gotN, gotOk, tt.wantI, tt.wantN, tt.wantOk)
			}
		})
	}
}

func TestParseTaskLine(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		wantErr bool
		check   func(*testing.T, *Task)
	}{
		{
			name: "simple active",
			in:   "- [ ] buy milk",
			check: func(t *testing.T, tk *Task) {
				if tk.Text != "buy milk" {
					t.Errorf("Text = %q, want %q", tk.Text, "buy milk")
				}
				if tk.Status != "" {
					t.Errorf("Status = %q, want empty", tk.Status)
				}
				if tk.Done {
					t.Error("Done = true, want false")
				}
			},
		},
		{
			name: "done task",
			in:   "- [x] finished task",
			check: func(t *testing.T, tk *Task) {
				if !tk.Done {
					t.Error("Done = false, want true")
				}
				if tk.Status != "x" {
					t.Errorf("Status = %q, want %q", tk.Status, "x")
				}
			},
		},
		{
			name: "waiting status",
			in:   "- [waiting] maybe later",
			check: func(t *testing.T, tk *Task) {
				if tk.Status != "waiting" {
					t.Errorf("Status = %q, want %q", tk.Status, "waiting")
				}
			},
		},
		{
			name: "with attributes",
			in:   `- [ ] task text [due: "2026-06-19"] [priority: high] [name: myTask]`,
			check: func(t *testing.T, tk *Task) {
				if tk.Due != `2026-06-19` {
					t.Errorf("Due = %q, want %q", tk.Due, `2026-06-19`)
				}
				if tk.Priority != "high" {
					t.Errorf("Priority = %q, want %q", tk.Priority, "high")
				}
				if tk.Name != "myTask" {
					t.Errorf("Name = %q, want %q", tk.Name, "myTask")
				}
			},
		},
		{
			name: "with dependsOn",
			in:   "- [ ] task [dependsOn: a b c]",
			check: func(t *testing.T, tk *Task) {
				if len(tk.DependsOn) != 3 {
					t.Errorf("DependsOn = %v, want 3 items", tk.DependsOn)
				}
			},
		},
		{
			name: "with tags",
			in:   "- [ ] task #foo #bar",
			check: func(t *testing.T, tk *Task) {
				if len(tk.Tags) != 2 {
					t.Errorf("Tags = %v, want 2", tk.Tags)
				}
			},
		},
		{
			name: "hierarchical tag",
			in:   "- [ ] task #meta/library",
			check: func(t *testing.T, tk *Task) {
				if len(tk.Tags) != 1 || tk.Tags[0] != "meta/library" {
					t.Errorf("Tags = %v, want [meta/library]", tk.Tags)
				}
			},
		},
		{
			name: "empty task",
			in:   "- [ ] ",
			wantErr: true,
		},
		{
			name: "empty task with attrs only",
			in:   "- [ ] [priority: high]",
			wantErr: true,
		},
		{
			name: "not a task",
			in:   "regular text",
			wantErr: true,
		},
		{
			name: "valid recur",
			in:   "- [ ] task [recur: daily:1]",
			check: func(t *testing.T, tk *Task) {
				if tk.Recur != "daily:1" {
					t.Errorf("Recur = %q, want %q", tk.Recur, "daily:1")
				}
			},
		},
		{
			name: "invalid recur ignored",
			in:   "- [ ] task [recur: garbage:1]",
			check: func(t *testing.T, tk *Task) {
				if tk.Recur != "" {
					t.Errorf("Recur = %q, want empty (invalid should be ignored)", tk.Recur)
				}
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tk, err := ParseTaskLine(tt.in)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseTaskLine(%q) error = %v, wantErr = %v", tt.in, err, tt.wantErr)
			}
			if !tt.wantErr && tt.check != nil {
				tt.check(t, tk)
			}
		})
	}
}

func TestFindNthTask(t *testing.T) {
	content := `# heading
- [ ] task 1
paragraph
- [x] task 2 done
- [ ] task 3
`
	lines := splitLines(content)
	if idx := FindNthTask(lines, 1); idx != 1 {
		t.Errorf("FindNthTask(1) = %d, want 1", idx)
	}
	if idx := FindNthTask(lines, 2); idx != 3 {
		t.Errorf("FindNthTask(2) = %d, want 3", idx)
	}
	if idx := FindNthTask(lines, 3); idx != 4 {
		t.Errorf("FindNthTask(3) = %d, want 4", idx)
	}
	if idx := FindNthTask(lines, 4); idx != -1 {
		t.Errorf("FindNthTask(4) = %d, want -1", idx)
	}
}

func splitLines(s string) []string {
	var out []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			out = append(out, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		out = append(out, s[start:])
	}
	return out
}

func TestParseTasksFromPage(t *testing.T) {
	content := `# heading
- [ ] task 1
- [ ] 
- [x] task 2
plain text
- [ ] task 3
`
	tasks, err := ParseTasksFromPage(content, "TestPage")
	if err != nil {
		t.Fatalf("ParseTasksFromPage error: %v", err)
	}
	if len(tasks) != 3 {
		t.Errorf("got %d tasks, want 3 (empty task should be skipped)", len(tasks))
	}
	if tasks[0].Position != 1 || tasks[1].Position != 2 || tasks[2].Position != 3 {
		t.Errorf("positions = %d, %d, %d, want 1, 2, 3", tasks[0].Position, tasks[1].Position, tasks[2].Position)
	}
}
