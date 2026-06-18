const $ = (selector) => document.querySelector(selector);
const dateFormat = new Intl.DateTimeFormat("en-AU", { dateStyle: "full" });
let data = { projects: [], workers: [], tasks: [], openEntries: [] };

document.addEventListener("DOMContentLoaded", () => {
  $("#todayLabel").textContent = dateFormat.format(new Date());
  $("#workerForm").addEventListener("submit", submitTime);
  $("#workerForm").projectId.addEventListener("change", () => {
    renderTasks();
    renderOpenEntries();
  });
  load();
});

async function load() {
  try {
    data = await api("/api/worker-data");
    render();
    setMsg("Ready.", "good");
  } catch (error) {
    setMsg(error.message, "bad");
  }
}

function render() {
  const selectedProjectId = $("#workerForm").projectId.value;
  const selectedWorkerId = $("#workerForm").workerId.value;

  $("#workerForm").projectId.innerHTML = data.projects.map((project) => option(project.id, `${project.name} (${project.code})`)).join("");
  $("#workerForm").workerId.innerHTML = data.workers.map((worker) => option(worker.id, worker.name)).join("");

  if (data.projects.some((project) => project.id === selectedProjectId)) {
    $("#workerForm").projectId.value = selectedProjectId;
  }

  if (data.workers.some((worker) => worker.id === selectedWorkerId)) {
    $("#workerForm").workerId.value = selectedWorkerId;
  }

  renderTasks();
  renderOpenEntries();
}

function renderTasks() {
  const projectId = $("#workerForm").projectId.value;
  const tasks = data.tasks.filter((task) => !task.projectId || task.projectId === projectId);
  $("#workerForm").taskId.innerHTML = tasks.length
    ? tasks.map((task) => option(task.id, task.name)).join("")
    : `<option value="">No tasks available</option>`;
}

function renderOpenEntries() {
  const projectId = $("#workerForm").projectId.value;
  const rows = projectId ? data.openEntries.filter((entry) => entry.projectId === projectId) : data.openEntries;
  $("#openEntries").innerHTML = rows.length
    ? rows.map((entry) => `
        <article class="record">
          <span class="pill open">open</span>
          <b>${entry.workerName}</b>
          <div>${entry.projectName} - ${entry.taskName}</div>
          <div class="meta">${formatDateTime(entry.checkInAt)}</div>
        </article>
      `).join("")
    : `<div class="msg">No workers are checked in right now.</div>`;
}

async function submitTime(event) {
  event.preventDefault();
  const button = event.submitter;
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

  if (!payload.projectId || !payload.workerId || !payload.taskId) {
    setMsg("Ask admin to add at least one active project, worker, and task.", "bad");
    return;
  }

  button.disabled = true;
  setMsg("Saving...", "");

  try {
    const result = await api(`/api/${button.dataset.action}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    data = result.data;
    event.currentTarget.notes.value = "";
    render();
    setMsg(result.message, "good");
  } catch (error) {
    setMsg(error.message, "bad");
  } finally {
    button.disabled = false;
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Request failed.");
  return json;
}

function option(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function setMsg(text, type) {
  $("#msg").className = `msg ${type || ""}`.trim();
  $("#msg").textContent = text;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
