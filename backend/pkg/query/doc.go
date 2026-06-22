// Package query provides a query engine that translates task filters
// into SilverBullet Runtime API requests.
//
// It wraps the client.Client to execute filtered task queries against
// the /.runtime/objects/task endpoint, converting the raw RuntimeTask
// objects into domain Task structs with custom attribute parsing.
//
// The query engine handles:
//   - Filter parameter translation (status, page, dates, name, text search)
//   - Server-side pagination and sorting
//   - Client-side post-filtering (overdue detection, date-string sorting)
//
// Usage:
//
//	c, _ := client.NewClient(client.Config{SpaceURL: "http://localhost:3000"})
//	q := query.NewQuery(c)
//
//	tasks, err := q.Execute(task.TaskFilter{
//	    Status:  []string{"waiting"},
//	    Overdue: true,
//	    SortBy:  "due",
//	})
package query
