#!/usr/bin/env node
// REST API wrapper around sbtask CLI
// Exposes the endpoints Silvermind expects: /tasks, /inbox, /today, /done, /undo, /spaces, /health

import { createServer } from 'node:http';
import { execSync } from 'node:child_process';

const PORT = 7433;

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'done';
  priority: 'high' | 'medium' | 'none';
  due_date: string | null;
  deferred_date: string | null;
  space_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const SPACES: { id: string; name: string; is_default: boolean }[] = (() => {
  try {
    const raw = execSync('sbtask config --json 2>/dev/null || sbtask config list --json 2>/dev/null', { timeout: 5000, encoding: 'utf-8' });
    const config = JSON.parse(raw);
    if (config.spaces && Array.isArray(config.spaces)) {
      return config.spaces;
    }
  } catch {}
  // Fallback: try listing spaces from sbtask
  try {
    const raw = execSync('sbtask list --json 2>/dev/null', { timeout: 5000, encoding: 'utf-8' });
    const data = JSON.parse(raw);
    // Extract unique space names from tasks
    const names = new Set((data.tasks || data || []).map((t: any) => t.space || 'default'));
    return Array.from(names).map((name, i) => ({
      id: `spc_${(name as string).toLowerCase().replace(/\s+/g, '_')}`,
      name: name as string,
      is_default: i === 0,
    }));
  } catch {}
  return [{ id: 'spc_default', name: 'Default', is_default: true }];
})();

function runSbtask(args: string[]): string {
  return execSync(`sbtask ${args.join(' ')} --json`, { timeout: 10000, encoding: 'utf-8' });
}

function parseTask(raw: any, spaceId: string): Task {
  const now = new Date().toISOString();
  return {
    id: raw.id || raw.ref || String(Math.random()).slice(2, 10),
    title: raw.title || raw.name || '',
    description: raw.description || raw.desc || null,
    status: raw.status || raw.state || 'active',
    priority: raw.priority || raw.prio || 'none',
    due_date: raw.due_date || raw.dueDate || raw.deadline || null,
    deferred_date: raw.deferred_date || raw.deferredDate || raw.schedule || null,
    space_id: raw.space || spaceId,
    created_at: raw.created_at || raw.createdAt || now,
    updated_at: raw.updated_at || raw.updatedAt || now,
    completed_at: raw.completed_at || raw.completedAt || null,
  };
}

function json(res: any, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function errorJson(res: any, code: string, message: string, status = 400) {
  json(res, { error: { code, message } }, status);
}

async function parseBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: string) => (body += chunk));
    req.on('end', () => resolve(body ? JSON.parse(body) : {}));
  });
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  try {
    // Health
    if (url.pathname === '/health') {
      return json(res, { status: 'ok', version: 'sbtask-cli', uptime_seconds: process.uptime() });
    }

    // Spaces
    if (url.pathname === '/spaces') {
      return json(res, {
        spaces: SPACES.map((s) => ({
          ...s,
          created_at: '2025-01-01T00:00:00Z',
        })),
      });
    }

    const spaceId = url.searchParams.get('space_id') || SPACES[0]?.id || 'spc_default';

    // /inbox → sbtask list (active tasks)
    if (url.pathname === '/inbox') {
      try {
        const raw = runSbtask(['list', '--status', 'active']);
        const data = JSON.parse(raw);
        const taskList = Array.isArray(data.tasks) ? data.tasks : Array.isArray(data) ? data : [];
        const tasks = taskList.map((t: any) => parseTask(t, spaceId));
        return json(res, { tasks, count: tasks.length });
      } catch (e: any) {
        return json(res, { tasks: [], count: 0 });
      }
    }

    // /today → sbtask today
    if (url.pathname === '/today') {
      try {
        const raw = runSbtask(['today']);
        const data = JSON.parse(raw);
        return json(res, {
          overdue: (data.overdue || []).map((t: any) => parseTask(t, spaceId)),
          due_today: (data.due_today || data.dueToday || []).map((t: any) => parseTask(t, spaceId)),
          deferred_today: (data.deferred_today || data.deferredToday || []).map((t: any) => parseTask(t, spaceId)),
          date: new Date().toISOString().slice(0, 10),
        });
      } catch (e: any) {
        return json(res, { overdue: [], due_today: [], deferred_today: [], date: '' });
      }
    }

    // /tasks collection
    if (url.pathname === '/tasks') {
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const title = body.title || '';
        if (!title.trim()) return errorJson(res, 'invalid', 'Title is required', 400);
        try {
          const raw = runSbtask(['create', `"${title.replace(/"/g, '\\"')}"`]);
          const data = JSON.parse(raw);
          const task = parseTask(data.task || data, spaceId);
          return json(res, { task }, 201);
        } catch (e: any) {
          return errorJson(res, 'create_failed', e.message, 500);
        }
      }
      // GET /tasks
      const status = url.searchParams.get('status') || 'active';
      try {
        const raw = runSbtask(['list', status === 'all' ? '' : `--status=${status}`].filter(Boolean));
        const data = JSON.parse(raw);
        const taskList = Array.isArray(data.tasks) ? data.tasks : Array.isArray(data) ? data : [];
        const tasks = taskList.map((t: any) => parseTask(t, spaceId));
        return json(res, { tasks, count: tasks.length });
      } catch {
        return json(res, { tasks: [], count: 0 });
      }
    }

    // /done
    if (url.pathname === '/done' && req.method === 'POST') {
      const body = await parseBody(req);
      try {
        const raw = runSbtask(['done', body.id || '']);
        const data = JSON.parse(raw);
        const task = parseTask(data.task || data, spaceId);
        return json(res, { task });
      } catch (e: any) {
        return json(res, { task: { id: body.id, status: 'done' } });
      }
    }

    // /undo
    if (url.pathname === '/undo' && req.method === 'POST') {
      const body = await parseBody(req);
      try {
        const raw = runSbtask(['undo', body.id || '']);
        const data = JSON.parse(raw);
        const task = parseTask(data.task || data, spaceId);
        return json(res, { task });
      } catch (e: any) {
        return json(res, { task: { id: body.id, status: 'active' } });
      }
    }

    // /tasks/{id}
    const taskMatch = url.pathname.match(/^\/tasks\/(.+)$/);
    if (taskMatch) {
      const id = taskMatch[1];
      if (req.method === 'GET') {
        try {
          const raw = runSbtask(['modify', id, '--get']);
          const data = JSON.parse(raw);
          return json(res, { task: parseTask(data.task || data, spaceId) });
        } catch {
          return errorJson(res, 'not_found', 'Task not found', 404);
        }
      }
      if (req.method === 'PATCH') {
        const body = await parseBody(req);
        const args = ['modify', id];
        if (body.title) args.push('--title', `"${body.title.replace(/"/g, '\\"')}"`);
        if (body.priority) args.push('--priority', body.priority);
        if (body.due_date) args.push('--due', body.due_date);
        if (body.description) args.push('--description', `"${body.description.replace(/"/g, '\\"')}"`);
        try {
          const raw = runSbtask(args);
          const data = JSON.parse(raw);
          return json(res, { task: parseTask(data.task || data, spaceId) });
        } catch (e: any) {
          return errorJson(res, 'update_failed', e.message, 500);
        }
      }
      if (req.method === 'DELETE') {
        try {
          runSbtask(['modify', id, '--delete']);
          res.writeHead(204);
          return res.end();
        } catch (e: any) {
          return errorJson(res, 'delete_failed', e.message, 500);
        }
      }
    }

    return errorJson(res, 'not_found', 'Not found', 404);
  } catch (e: any) {
    return errorJson(res, 'server_error', e.message, 500);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sbtask-api] Silvermind REST API wrapping sbtask CLI on http://0.0.0.0:${PORT}`);
});
