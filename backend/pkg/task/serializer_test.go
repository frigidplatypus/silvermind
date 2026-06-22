package task

import (
	"testing"
)

func TestToMarkdown(t *testing.T) {
	tests := []struct {
		name string
		task Task
		want string
	}{
		{
			name: "empty text",
			task: Task{},
			want: "",
		},
		{
			name: "active task",
			task: Task{Text: "buy milk"},
			want: "- [ ] buy milk",
		},
		{
			name: "done task",
			task: Task{Text: "finished", Status: "x", Done: true},
			want: "- [x] finished",
		},
		{
			name: "with priority and name",
			task: Task{Text: "task", Name: "myTask", Priority: "high"},
			want: "- [ ] task [name: myTask] [priority: high]",
		},
		{
			name: "with due and scheduled",
			task: Task{
				Text:      "task",
				Due:       "[[Journal/2026-06-19]]",
				Scheduled: "[[Journal/2026-06-20]]",
			},
			want: `- [ ] task [due: "[[Journal/2026-06-19]]"] [scheduled: "[[Journal/2026-06-20]]"]`,
		},
		{
			name: "with recur",
			task: Task{Text: "task", Recur: "daily:1"},
			want: "- [ ] task [recur: daily:1]",
		},
		{
			name: "with dependsOn",
			task: Task{Text: "task", DependsOn: []string{"a", "b"}},
			want: "- [ ] task [dependsOn: a b]",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.task.ToMarkdown()
			if got != tt.want {
				t.Errorf("ToMarkdown() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestFormatJournalLink(t *testing.T) {
	tests := []struct {
		date, time, want string
	}{
		{"2026-06-19", "", "[[Journal/2026-06-19]]"},
		{"2026-06-19", "14:00", "[[Journal/2026-06-19]] 14:00"},
	}
	for _, tt := range tests {
		t.Run(tt.date+"/"+tt.time, func(t *testing.T) {
			got := FormatJournalLink(tt.date, tt.time)
			if got != tt.want {
				t.Errorf("FormatJournalLink(%q, %q) = %q, want %q", tt.date, tt.time, got, tt.want)
			}
		})
	}
}

func TestParseJournalLink(t *testing.T) {
	tests := []struct {
		in           string
		wantDate     string
		wantTime     string
		wantOk       bool
	}{
		{"[[Journal/2026-06-19]]", "2026-06-19", "", true},
		{"[[Journal/2026-06-19]] 14:00", "2026-06-19", "14:00", true},
		{"not a link", "", "", false},
		{"[[Journal/bad-date]]", "", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			gotD, gotT, gotOk := ParseJournalLink(tt.in)
			if gotD != tt.wantDate || gotT != tt.wantTime || gotOk != tt.wantOk {
				t.Errorf("ParseJournalLink(%q) = (%q, %q, %v), want (%q, %q, %v)",
					tt.in, gotD, gotT, gotOk, tt.wantDate, tt.wantTime, tt.wantOk)
			}
		})
	}
}

func TestRoundTrip(t *testing.T) {
	original := Task{
		Text:      "buy milk #shopping",
		Status:    "waiting",
		Priority:  "high",
		Name:      "groceries",
		Recur:     "weekly:1",
		Due:       "[[Journal/2026-06-19]]",
		Scheduled: "[[Journal/2026-06-20]]",
		DependsOn: []string{"a", "b"},
	}
	line := original.ToMarkdown()
	parsed, err := ParseTaskLine(line)
	if err != nil {
		t.Fatalf("ParseTaskLine(%q) error: %v", line, err)
	}
	if parsed.Text != original.Text {
		t.Errorf("Text = %q, want %q", parsed.Text, original.Text)
	}
	if parsed.Status != original.Status {
		t.Errorf("Status = %q, want %q", parsed.Status, original.Status)
	}
	if parsed.Priority != original.Priority {
		t.Errorf("Priority = %q, want %q", parsed.Priority, original.Priority)
	}
	if parsed.Name != original.Name {
		t.Errorf("Name = %q, want %q", parsed.Name, original.Name)
	}
	if parsed.Recur != original.Recur {
		t.Errorf("Recur = %q, want %q", parsed.Recur, original.Recur)
	}
	if parsed.Due != original.Due {
		t.Errorf("Due = %q, want %q", parsed.Due, original.Due)
	}
	if parsed.Scheduled != original.Scheduled {
		t.Errorf("Scheduled = %q, want %q", parsed.Scheduled, original.Scheduled)
	}
	if len(parsed.DependsOn) != 2 {
		t.Errorf("DependsOn = %v, want 2 items", parsed.DependsOn)
	}
}
