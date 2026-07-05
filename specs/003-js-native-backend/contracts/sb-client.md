# Contract: SilverBullet HTTP Client

**Module**: `src/lib/backend/sb-client.ts`

## Interface

```typescript
interface SbClient {
  readPage(path: string): Promise<SilverBulletPage>;
  writePage(path: string, content: string, lastModified?: number): Promise<void>;
  readModifyWrite(path: string, fn: (content: string) => Promise<string>): Promise<void>;
  queryTasks(params: Record<string, string>): Promise<RuntimeTask[]>;
  getTask(ref: string): Promise<RuntimeTask | null>;
  findPagesByTag(tag: string): Promise<string[]>;
}
```

## Constructor

```typescript
function createSbClient(config: { spaceURL: string; authToken?: string }): SbClient
```

## Methods

### readPage

```
GET /.fs/{path}
  Headers: Authorization: Bearer {token} (if set)
  Response: 200 OK → { content, lastModified }
            404 Not Found → "" (empty page)
            Other → throw SbClientError
  Fallback: If path returns 404, retry with path.md
```

### writePage

```
PUT /.fs/{path}
  Headers: Content-Type: text/markdown
           If-Match: {lastModified} (for optimistic concurrency)
           Authorization: Bearer {token} (if set)
  Response: 200 OK / 201 Created → success
            412 Precondition Failed → throw PreconditionFailedError
            Other → throw SbClientError
```

### readModifyWrite

```
Loop (max 3 retries):
  1. readPage → get content + lastModified
  2. fn(content) → modified content
  3. writePage with lastModified
  4. If 412 → retry (re-read page first)
  5. If other error → throw
```

### queryTasks

```
GET /.runtime/objects/task?{params}
  Headers: Authorization: Bearer {token} (if set)
  Response: 200 OK → RuntimeTask[]
            503 → throw "Runtime API unavailable"
            Other → throw SbClientError
```

### getTask

```
GET /.runtime/objects/task/{ref}
  Response: 200 OK → RuntimeTask
            404 Not Found → null
```

### findPagesByTag

```
GET /.runtime/objects/page?tag={tag}
  Response: 200 OK → string[] (page names)
```

## Error Types

```typescript
class SbClientError extends Error {
  status: number;
  code: string;
}

class PreconditionFailedError extends SbClientError {
  // status = 412
}
```

## Platform Transport

The client delegates actual HTTP to a platform-specific transport function:

```typescript
type Transport = (url: string, options: RequestInit) => Promise<Response>;

// Desktop (Wails WebView): window.fetch
// iOS/Android (Capacitor): CapacitorHttp.request
// Browser (dev): window.fetch (via Vite proxy)
```

The transport is injected at construction time.

## Auth Token Handling

- Token stored in Silvermind config (per space)
- Sent as `Authorization: Bearer {token}` header
- Never logged, never sent to Sentry
- URL-encoded in path parameters
