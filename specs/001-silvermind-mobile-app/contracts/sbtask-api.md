# sbtask API Contract (Consumer View)

**Date**: 2026-06-18
**Source-of-truth note**: This is the Silvermind-side contract for the `sbtask serve` REST API. The actual sbtask `serve` implementation is owned by a separate project. This document captures the surface Silvermind depends on. If sbtask changes, this contract is the integration boundary.

## Base URL

- `http://127.0.0.1:7433`
- Port `7433` is the default; if sbtask is configured for a different port, Silvermind must be updated to match (the port is read from sbtask's startup banner or config).
- HTTP (not HTTPS) — loopback is exempt from iOS ATS requirements.
- All requests are local. No CORS, no auth headers.

## Content Type

- Request: `application/json`
- Response: `application/json`

## Error Format

All error responses use:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

Status codes follow REST conventions: 200, 201, 204, 400, 404, 409, 500.

## Endpoints

### GET /tasks

List all tasks in the active space. Honors the active space selection (passed via query param or implicit).

**Query parameters**:
- `space_id` (optional, string) — filter to a specific space. If omitted, uses the active space.
- `status` (optional, enum: `active` | `done` | `all`) — default `active`.
- `sort` (optional, enum: `priority-then-date` | `created-desc` | `due-asc` | `alpha-asc`) — default `priority-then-date`.

**Response 200**:
```json
{
  "tasks": [
    {
      "id": "tsk_abc123",
      "title": "Buy milk",
      "description": null,
      "status": "active",
      "priority": "high",
      "due_date": null,
      "scheduled_date": "2026-06-18",
      "space_id": "spc_personal",
      "created_at": "2026-06-18T10:00:00Z",
      "updated_at": "2026-06-18T10:00:00Z",
      "completed_at": null
    }
  ],
  "count": 1
}
```

### GET /inbox

Convenience endpoint — equivalent to `GET /tasks?status=active&sort=priority-then-date`.

**Response 200**: same as `GET /tasks` response shape.

### GET /today

Returns tasks grouped for "today" view: overdue, due today, scheduled today.

**Response 200**:
```json
{
  "overdue": [ { /* Task */ } ],
  "due_today": [ { /* Task */ } ],
  "scheduled_today": [ { /* Task */ } ],
  "date": "2026-06-18"
}
```

If a section is empty, it is an empty array, not omitted.

### POST /tasks

Create a new task.

**Request body**:
```json
{
  "title": "Buy milk",
  "description": "optional long text",
  "priority": "medium",
  "due_date": "2026-06-20",
  "scheduled_date": null,
  "space_id": "spc_personal"
}
```

**Required**: `title`, `space_id`. All others optional. If `priority` omitted, defaults to `none`.

**Response 201**:
```json
{ "task": { /* Task */ } }
```

**Errors**:
- 400 if `title` empty/whitespace or >200 chars.
- 400 if `space_id` does not exist.
- 400 if `priority` is not a valid value.

### GET /tasks/{id}

Fetch a single task by id.

**Response 200**: `{ "task": { /* Task */ } }`

**Errors**:
- 404 if id not found.

### PATCH /tasks/{id}

Update one or more task fields. Only the fields provided in the body are updated.

**Request body** (any subset):
```json
{
  "title": "Buy milk and eggs",
  "description": "Updated",
  "priority": "high",
  "due_date": "2026-06-20",
  "scheduled_date": null
}
```

**Response 200**: `{ "task": { /* Task, with updated_at refreshed */ } }`

**Errors**:
- 400 for invalid field values.
- 404 if id not found.

### DELETE /tasks/{id}

Delete a task permanently.

**Response 204**: empty body.

**Errors**:
- 404 if id not found.

### POST /done

Mark a task as done. Equivalent to setting `status=done` and `completed_at=now`.

**Request body**:
```json
{ "id": "tsk_abc123" }
```

**Response 200**: `{ "task": { /* Task, with status=done, completed_at set */ } }`

**Errors**:
- 400 if `id` missing.
- 404 if id not found.
- 409 if task is already done (or: idempotent — return current state with 200).

### POST /undo

Mark a task as active again. Equivalent to setting `status=active` and clearing `completed_at`.

**Request body**:
```json
{ "id": "tsk_abc123" }
```

**Response 200**: `{ "task": { /* Task, with status=active, completed_at=null */ } }`

**Errors**:
- 400 if `id` missing.
- 404 if id not found.

### GET /spaces

List all configured spaces.

**Response 200**:
```json
{
  "spaces": [
    {
      "id": "spc_personal",
      "name": "Personal",
      "is_default": true,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### GET /health

Health check used by the `sbtask-ios` plugin for polling.

**Response 200**:
```json
{
  "status": "ok",
  "version": "1.2.3",
  "uptime_seconds": 42
}
```

**Response 503**: returned if the service is in a degraded state.

## Idempotency

- `POST /done` and `POST /undo` are idempotent: re-applying the same operation returns the current state without error.
- `DELETE /tasks/{id}` on a non-existent id returns 404.
- `POST /tasks` is not idempotent — each call creates a new task. Clients should not retry blindly.

## Versioning

- sbtask returns its version in `/health`.
- Silvermind pins against the `latest` semver-major of sbtask at build time. Major version mismatches are surfaced to the user as an incompatibility error.

## Silvermind-Side Concerns

- All requests are issued from inside the iOS WebView, which means cookies and credentials would be persisted in the WebView if used. Silvermind sends no credentials.
- Network failure (server down) is handled by the `sbtask-ios` plugin, not by the fetch client. The client sees a regular error from the plugin's shim or from `fetch` rejecting.
- Timeouts: 5s default on Silvermind side for user-initiated calls; 2s for health check polling.
