# AppService Contract

**Date**: 2026-06-19
**Feature**: [spec.md](../spec.md)
**Communication**: Wails v3 service pattern. Go backend exposes methods callable from Svelte frontend via `@wailsio/runtime`. Frontend events propagate to Go via Wails event system.

## Service: AppService

Exposed by the Go backend. Frontend imports as:

```ts
import { AppService } from '@wailsio/runtime';
```

### Methods

#### `StartSbtask()`

Starts the sbtask serve HTTP server in-process on `localhost:7433`. Called once at app launch. Returns a `ServiceHealth` object.

- **Returns**: `Promise<ServiceHealth>`
- **Errors**: Returns `{ state: "failed", error: "reason" }` if startup fails

#### `StopSbtask()`

Gracefully shuts down the sbtask serve HTTP server. Called on window close.

- **Returns**: `Promise<void>`
- **Timeout**: 5 seconds graceful, then force stop

#### `GetHealth()`

Returns current service health.

- **Returns**: `Promise<ServiceHealth>`

#### `ListSpaces()`

Reads all spaces from `~/.config/sbtask/config.yaml`.

- **Returns**: `Promise<SpaceConfig[]>`
- **Errors**: Returns empty array if config file missing

#### `AddSpace(config: SpaceConfig)`

Adds a new space to the config file.

- **Returns**: `Promise<SpaceConfig[]>`
- **Errors**: Returns error if space with same name exists

#### `UpdateSpace(name: string, config: Partial<SpaceConfig>)`

Updates an existing space's configuration.

- **Returns**: `Promise<SpaceConfig[]>`
- **Errors**: Returns error if space doesn't exist

#### `RemoveSpace(name: string)`

Removes a space from the config file. Prompts confirmation via native dialog.

- **Returns**: `Promise<SpaceConfig[]>`
- **Errors**: Returns error if space doesn't exist

#### `SetActiveSpace(name: string)`

Sets the active space. Calling this restarts sbtask serve with the new space's URL.

- **Returns**: `Promise<{ spaces: SpaceConfig[], health: ServiceHealth }>`
- **Side effect**: sbtask serve restarts with new space

#### `GetConfigPath()`

Returns the path to the sbtask config file.

- **Returns**: `Promise<string>`

## Events (Go → Frontend)

#### `service:health-changed`

Emitted when the sbtask serve health changes. Payload: `ServiceHealth`.

#### `config:spaces-changed`

Emitted when the space configuration changes (add/remove/edit). Payload: `SpaceConfig[]`.

## Types (shared between Go and JS)

```typescript
interface SpaceConfig {
  name: string;
  url: string;
  default_page: string;
  inbox_page: string;
}

interface ServiceHealth {
  state: 'starting' | 'running' | 'unhealthy' | 'failed';
  port: number;
  space_url: string;
  error?: string;
}
```
