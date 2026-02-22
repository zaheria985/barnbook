// Vikunja task sync integration with graceful degradation
// Requires VIKUNJA_URL and VIKUNJA_API_TOKEN

export interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  due_date: string | null;
  project_id: number;
}

export function isConfigured(): boolean {
  return !!(process.env.VIKUNJA_URL && process.env.VIKUNJA_API_TOKEN);
}

function getBaseUrl(): string {
  return process.env.VIKUNJA_URL!.replace(/\/$/, "");
}

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.VIKUNJA_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// Normalize a date value (Date object or string) to "YYYY-MM-DDT12:00:00.000Z"
// Uses noon UTC so the date never shifts in any US timezone.
function toNoonUTC(val: string | Date): string {
  const iso = val instanceof Date ? val.toISOString() : String(val);
  const dateOnly = iso.split("T")[0];
  return `${dateOnly}T12:00:00.000Z`;
}

export async function createTask(data: {
  title: string;
  description?: string;
  due_date?: string | Date | null;
  project_id: number;
}): Promise<VikunjaTask> {
  const body = {
    title: data.title,
    description: data.description || "",
    due_date: data.due_date ? toNoonUTC(data.due_date) : null,
  };

  const res = await fetch(`${getBaseUrl()}/api/v1/projects/${data.project_id}/tasks`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Vikunja create task failed: ${res.status} — ${text} (project=${data.project_id}, due=${body.due_date})`
    );
  }

  return res.json();
}

export async function updateTask(
  taskId: number,
  data: { title?: string; done?: boolean; due_date?: string | null }
): Promise<VikunjaTask> {
  const res = await fetch(`${getBaseUrl()}/api/v1/tasks/${taskId}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Vikunja update task failed: ${res.status}`);
  }

  return res.json();
}

export async function getTask(taskId: number): Promise<VikunjaTask> {
  const res = await fetch(`${getBaseUrl()}/api/v1/tasks/${taskId}`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Vikunja get task failed: ${res.status}`);
  }

  return res.json();
}

export async function deleteTask(taskId: number): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/v1/tasks/${taskId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Vikunja delete task failed: ${res.status}`);
  }
}

export interface VikunjaProject {
  id: number;
  title: string;
}

export async function getProjects(): Promise<VikunjaProject[]> {
  const res = await fetch(`${getBaseUrl()}/api/v1/projects`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Vikunja list projects failed: ${res.status}`);
  return res.json();
}

export async function checkHealth(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  if (!isConfigured()) {
    return { ok: false, error: "Not configured" };
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/info`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const info = await res.json();
    return { ok: true, version: info.version };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
