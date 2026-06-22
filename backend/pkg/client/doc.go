// Package client provides HTTP clients for the SilverBullet API.
//
// It supports two SilverBullet API surfaces:
//   - Runtime API (/.runtime/*) for task querying via the task index
//   - File API (/.fs/*) for reading and writing page content
//
// No authentication is used — the SilverBullet instance must be running
// without authentication enabled.
//
// Usage:
//
//	c, err := client.NewClient(client.Config{
//	    SpaceURL: "http://localhost:3000",
//	})
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	tasks, err := c.QueryTasks(map[string]string{
//	    "where[done]": "false",
//	})
package client
