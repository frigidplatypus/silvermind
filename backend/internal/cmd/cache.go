package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/justin/sbtask/pkg/task"
)

type cachedTask struct {
	task.Task
	Ref int `json:"ref"`
}

type listCache struct {
	Tasks    []cachedTask `json:"tasks"`
	CachedAt time.Time    `json:"cached_at"`
}

func cachePath() (string, error) {
	dir := os.Getenv("XDG_CACHE_HOME")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("cannot determine cache directory: %w", err)
		}
		dir = filepath.Join(home, ".cache")
	}
	return filepath.Join(dir, "sbtask", "last-list.json"), nil
}

func saveListCache(tasks []task.Task) error {
	path, err := cachePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create cache dir: %w", err)
	}

	ct := make([]cachedTask, len(tasks))
	for i, t := range tasks {
		ct[i] = cachedTask{Task: t, Ref: i + 1}
	}

	c := listCache{
		Tasks:    ct,
		CachedAt: time.Now(),
	}
	data, err := json.Marshal(&c)
	if err != nil {
		return fmt.Errorf("marshal cache: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

func loadListCache() ([]cachedTask, error) {
	path, err := cachePath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("no cached task list — run 'sbtask list' first")
		}
		return nil, fmt.Errorf("read cache: %w", err)
	}

	var c listCache
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse cache: %w", err)
	}
	if len(c.Tasks) == 0 {
		return nil, fmt.Errorf("cache is empty — run 'sbtask list' first")
	}
	return c.Tasks, nil
}

func resolveTask(tasks []cachedTask, num int) (page string, position int, t task.Task, err error) {
	for _, ct := range tasks {
		if ct.Ref == num {
			return ct.Page, ct.Position, ct.Task, nil
		}
	}
	return "", 0, task.Task{}, fmt.Errorf("task #%d not found in cached list — run 'sbtask list' to refresh", num)
}

