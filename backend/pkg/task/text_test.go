package task

import (
	"testing"
)

func TestAppendTags(t *testing.T) {
	tests := []struct {
		name string
		text string
		tags []string
		want string
	}{
		{"empty tags", "buy milk", nil, "buy milk"},
		{"single tag", "buy milk", []string{"urgent"}, "buy milk #urgent"},
		{"multiple tags", "buy milk", []string{"urgent", "shopping"}, "buy milk #urgent #shopping"},
		{"dedup case-insensitive", "buy milk", []string{"Urgent", "urgent"}, "buy milk #Urgent"},
		{"dedup same case", "buy milk", []string{"foo", "foo"}, "buy milk #foo"},
		{"empty tag skipped", "buy milk", []string{"", "foo"}, "buy milk #foo"},
		{"trims trailing space", "buy milk ", []string{"foo"}, "buy milk #foo"},
		{"hierarchical tag", "task", []string{"meta/library"}, "task #meta/library"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := AppendTags(tt.text, tt.tags)
			if got != tt.want {
				t.Errorf("AppendTags(%q, %v) = %q, want %q", tt.text, tt.tags, got, tt.want)
			}
		})
	}
}

func TestStripHashtags(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"no tags", "buy milk", "buy milk"},
		{"single trailing", "buy milk #urgent", "buy milk"},
		{"multiple", "buy milk #urgent #shopping", "buy milk"},
		{"leading", "#urgent buy milk", "buy milk"},
		{"hierarchical", "task #meta/library", "task"},
		{"multi-segment hierarchical", "task #meta/template/slash", "task"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := StripHashtags(tt.in)
			if got != tt.want {
				t.Errorf("StripHashtags(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestSplitDateTime(t *testing.T) {
	tests := []struct {
		in     string
		wantD  string
		wantT  string
	}{
		{"2026-06-19", "2026-06-19", ""},
		{"2026-06-19 14:00", "2026-06-19", "14:00"},
		{"2026-06-19 14:00:00", "2026-06-19", "14:00:00"},
		{"", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			gotD, gotT := SplitDateTime(tt.in)
			if gotD != tt.wantD || gotT != tt.wantT {
				t.Errorf("SplitDateTime(%q) = (%q, %q), want (%q, %q)", tt.in, gotD, gotT, tt.wantD, tt.wantT)
			}
		})
	}
}

func TestValidPriority(t *testing.T) {
	for _, v := range []string{"high", "medium", "low", "HIGH", "Medium"} {
		if !ValidPriority(v) {
			t.Errorf("ValidPriority(%q) = false, want true", v)
		}
	}
	for _, v := range []string{"", "urgent", "h", "med", "1", "banana"} {
		if ValidPriority(v) {
			t.Errorf("ValidPriority(%q) = true, want false", v)
		}
	}
}

func TestValidTag(t *testing.T) {
	good := []string{"foo", "foo-bar", "foo_bar", "meta/library", "a/b/c", "abc123"}
	for _, v := range good {
		if !ValidTag(v) {
			t.Errorf("ValidTag(%q) = false, want true", v)
		}
	}
	bad := []string{"", "with space", "with.dot", "tag!", "foo,bar"}
	for _, v := range bad {
		if ValidTag(v) {
			t.Errorf("ValidTag(%q) = true, want false", v)
		}
	}
}

func TestValidStatus(t *testing.T) {
	for _, v := range []string{"", "waiting", "maybe", "x"} {
		if !ValidStatus(v) {
			t.Errorf("ValidStatus(%q) = false, want true", v)
		}
	}
	for _, v := range []string{"foo:bar", "x:y", ":"} {
		if ValidStatus(v) {
			t.Errorf("ValidStatus(%q) = true, want false", v)
		}
	}
}

func TestValidateTask(t *testing.T) {
	tests := []struct {
		name    string
		task    Task
		wantErr bool
	}{
		{"valid empty", Task{}, false},
		{"valid priority", Task{Priority: "high"}, false},
		{"invalid priority", Task{Priority: "urgent"}, true},
		{"valid recur", Task{Recur: "daily:1"}, false},
		{"invalid recur", Task{Recur: "yearly"}, true},
		{"valid status", Task{Status: "waiting"}, false},
		{"invalid status", Task{Status: "x:y"}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tk := tt.task
			err := ValidateTask(&tk)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateTask() error = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}

func TestExtractTags(t *testing.T) {
	tests := []struct {
		in   string
		want []string
	}{
		{"plain text", nil},
		{"one #foo", []string{"foo"}},
		{"#foo and #bar", []string{"foo", "bar"}},
		{"#foo #foo", []string{"foo"}},
		{"#meta/library", []string{"meta/library"}},
		{"#meta/template/slash", []string{"meta/template/slash"}},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			if len(tt.want) == 0 {
				if got := ExtractTags(tt.in); len(got) != 0 {
					t.Errorf("ExtractTags(%q) = %v, want empty", tt.in, got)
				}
				return
			}
			got := ExtractTags(tt.in)
			if len(got) != len(tt.want) {
				t.Errorf("ExtractTags(%q) = %v, want %v", tt.in, got, tt.want)
				return
			}
			for i, w := range tt.want {
				if got[i] != w {
					t.Errorf("ExtractTags(%q)[%d] = %q, want %q", tt.in, i, got[i], w)
				}
			}
		})
	}
}
