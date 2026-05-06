const BASE = `${import.meta.env.VITE_API_URL}/api`;

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 240) || res.statusText || "Request failed" };
    }
  }
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// Auth
export const login = (email, password) =>
  req("POST", "/auth/login", { email, password });
export const requestClientForgotPassword = (email) =>
  req("POST", "/auth/forgot-password", { email });

export async function validateClientResetToken(token) {
  const res = await fetch(
    `${BASE}/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
    { credentials: "include" },
  );
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return false;
    }
  }
  return Boolean(data?.valid);
}

export const submitClientPasswordReset = (payload) =>
  req("POST", "/auth/reset-password", payload);

export const logout = () => req("POST", "/auth/logout");
export const getMe = () => req("GET", "/auth/me");

// Clients
export const getClients = () => req("GET", "/clients");
export const getClient = (id) => req("GET", `/clients/${id}`);
export const createClient = (data) => req("POST", "/clients", data);
export const updateClient = (id, data) => req("PUT", `/clients/${id}`, data);
export const deleteClient = (id) => req("DELETE", `/clients/${id}`);
export const getClientDocuments = (clientId) =>
  req("GET", `/clients/${clientId}/documents`);
export const presignClientDocumentUpload = (clientId, payload) =>
  req("POST", `/clients/${clientId}/documents/presign`, payload);
export const createClientDocument = (clientId, payload) =>
  req("POST", `/clients/${clientId}/documents`, payload);

// Team
export const getTeamMembers = () => req("GET", "/team");
export const createTeamMember = (data) => req("POST", "/team", data);
export const updateTeamMember = (id, data) => req("PUT", `/team/${id}`, data);
export const deleteTeamMember = (id) => req("DELETE", `/team/${id}`);

// Events
export const getEvents = () => req("GET", "/events");
export const createEvent = (data) => req("POST", "/events", data);
export const updateEvent = (id, data) => req("PUT", `/events/${id}`, data);
export const deleteEvent = (id) => req("DELETE", `/events/${id}`);

// Tasks
export const getTasks = () => req("GET", "/tasks");
export const getArchivedTasks = (clientId) =>
  req(
    "GET",
    clientId
      ? `/tasks/archived?clientId=${encodeURIComponent(clientId)}`
      : "/tasks/archived",
  );
export const createTask = (data) => req("POST", "/tasks", data);
export const updateTask = (id, data) => req("PUT", `/tasks/${id}`, data);
export const reorderTasks = (payload) => req("PATCH", "/tasks/reorder", payload);
export const archiveTask = (id, archivedReason = "manual") =>
  req("POST", `/tasks/${id}/archive`, { archivedReason });
export const restoreTask = (id) => req("POST", `/tasks/${id}/restore`);

// Batches / Workspace (legacy — kept for back-compat / existing Batch data)
export const getBatches = () => req("GET", "/batches");
export const createBatch = (data) => req("POST", "/batches", data);
export const updateBatch = (id, data) => req("PUT", `/batches/${id}`, data);
export const deleteBatch = (id) => req("DELETE", `/batches/${id}`);
export const addVideo = (batchId, data) =>
  req("POST", `/batches/${batchId}/videos`, data);
export const updateVideo = (batchId, videoId, data) =>
  req("PUT", `/batches/${batchId}/videos/${videoId}`, data);
export const deleteVideo = (batchId, videoId) =>
  req("DELETE", `/batches/${batchId}/videos/${videoId}`);

// Workspaces (new hierarchy: Workspace → Batches → Videos)
export const getWorkspaces = () => req("GET", "/workspaces");
export const createWorkspace = (data) => req("POST", "/workspaces", data);
export const updateWorkspace = (id, data) =>
  req("PUT", `/workspaces/${id}`, data);
export const deleteWorkspace = (id) => req("DELETE", `/workspaces/${id}`);

export const addWorkspaceBatch = (wsId, data) =>
  req("POST", `/workspaces/${wsId}/batches`, data);
export const updateWorkspaceBatch = (wsId, bId, data) =>
  req("PUT", `/workspaces/${wsId}/batches/${bId}`, data);
export const deleteWorkspaceBatch = (wsId, bId) =>
  req("DELETE", `/workspaces/${wsId}/batches/${bId}`);

export const addWorkspaceVideo = (wsId, bId, data) =>
  req("POST", `/workspaces/${wsId}/batches/${bId}/videos`, data);
export const updateWorkspaceVideo = (wsId, bId, vId, data) =>
  req("PUT", `/workspaces/${wsId}/batches/${bId}/videos/${vId}`, data);
export const deleteWorkspaceVideo = (wsId, bId, vId) =>
  req("DELETE", `/workspaces/${wsId}/batches/${bId}/videos/${vId}`);

// Portal (team side)
export const getPortalNotes = (clientId) =>
  req("GET", `/portal/${clientId}/notes`);
export const sendPortalNote = (clientId, text, author) =>
  req("POST", `/portal/${clientId}/notes`, { text, author });
export const getPortalVideos = (clientId) =>
  req("GET", `/portal/${clientId}/videos`);
export const markNotesRead = (clientId) =>
  req("POST", `/portal/${clientId}/notes/read`);
export const getPortalUnreadSummary = () =>
  req("GET", "/portal/unread-summary");
export const getPortalActivity = (params = {}) => {
  const search = new URLSearchParams();
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.before) search.set("before", String(params.before));
  const qs = search.toString();
  return req("GET", `/portal/activity${qs ? `?${qs}` : ""}`);
};
export const presignPortalWhatsappUpload = (clientId, payload) =>
  req("POST", `/portal/${clientId}/whatsapp/presign`, payload);
export const createPortalWhatsappMessage = (clientId, payload) =>
  req("POST", `/portal/${clientId}/whatsapp/messages`, payload);
export const getPortalWhatsappMessages = (clientId) =>
  req("GET", `/portal/${clientId}/whatsapp/messages`);

// Portal (client side)
export const getPortalMe = () => req("GET", "/portal/me");
export const sendClientNote = (text) =>
  req("POST", "/portal/me/notes", { text });
export const approveVideo = (videoId) =>
  req("POST", `/portal/me/videos/${videoId}/approve`);
export const requestRevision = (videoId, note) =>
  req("POST", `/portal/me/videos/${videoId}/revision`, { note });

// Questionnaire
export const getQuestionnaire = (clientId) =>
  req("GET", `/questionnaire/${clientId}`);
export const saveQuestionnaire = (answers, submitted = false) =>
  req("POST", "/questionnaire/me", { answers, submitted });

// Stats
export const getActivity = () => req("GET", "/activity");
export const getPulse = () => req("GET", "/pulse");

// Video checker
export const analyzeCheckerText = (payload) =>
  req("POST", "/checker/analyze", payload);

export const presignVideoCheckerUpload = (payload) =>
  req("POST", "/checker/upload/presign", payload);

export const saveVideoCheckerRun = (payload) =>
  req("POST", "/checker/runs", payload);
