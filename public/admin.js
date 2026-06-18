const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
let passcode = sessionStorage.getItem("empireAdminPasscode") || "";
let data = null;

document.addEventListener("DOMContentLoaded", () => {
  $("#workerLink").href = `${location.origin}/worker`;
  $("#workerLink").textContent = `${location.origin}/worker`;
  bindForms();
  if (passcode) load();
});

function bindForms() {
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    passcode = event.currentTarget.passcode.value;
    sessionStorage.setItem("empireAdminPasscode", passcode);
    await load();
  });

  $("#refreshBtn").addEventListener("click", load);
  $("#positionForm").addEventListener("submit", (event) => save(event, "positions"));
  $("#workerForm").addEventListener("submit", (event) => save(event, "workers"));
  $("#projectForm").addEventListener("submit", (event) => save(event, "projects"));
  $("#taskForm").addEventListener("submit", (event) => save(event, "tasks"));

  $("#positions").addEventListener("click", recordClick);
  $("#workers").addEventListener("click", recordClick);
  $("#projects").addEventListener("click", recordClick);
  $("#tasks").addEventListener("click", recordClick);
  $("#entries").addEventListener("click", entryClick);
}

async function load() {
  try {
    data = await api(`/api/admin-data?passcode=${encodeURIComponent(passcode)}`);
    $("#login").classList.add("hidden");
    render();
  } catch (error) {
    $("#login").classList.remove("hidden");
    $("#loginMsg").className = "msg bad";
    $("#loginMsg").textContent = error.message;
  }
}

function render() {
  $("#workerForm").positionId.innerHTML = data.positions.map((item) => option(item.id, `${item.title} - ${money.format(item.rate)}/hr`)).join("");
  $("#taskForm").projectId.innerHTML = `<option value="">Global task</option>` + data.projects.map((item) => option(item.id, item.name)).join("");

  $("#metricOpen").textContent = data.entries.filter((entry) => !entry.checkOutAt).length;
  $("#metricPending").textContent = data.entries.filter((entry) => entry.status === "pending").length;
  $("#metricHours").textContent = Number(data.payroll.totals.hours || 0).toFixed(2);
  $("#metricPay").textContent = money.format(data.payroll.totals.pay || 0);

  $("#liveEntries").innerHTML = data.entries.filter((entry) => !entry.checkOutAt).length
    ? data.entries.filter((entry) => !entry.checkOutAt).map(entryCard).join("")
    : `<div class="msg">No workers are checked in right now.</div>`;

  $("#positions").innerHTML = data.positions.map((item) => simpleRecord("positions", item.id, item.title, `${money.format(item.rate)} / hour`)).join("");
  $("#workers").innerHTML = data.workers.map((item) => simpleRecord("workers", item.id, item.name, `PIN ${item.pin || "-"} - ${item.positionTitle || "No position"}`)).join("");
  $("#projects").innerHTML = data.projects.map((item) => simpleRecord("projects", item.id, item.name, `${item.code} - ${item.address}`)).join("");
  $("#tasks").innerHTML = data.tasks.map((item) => {
    const project = data.projects.find((projectItem) => projectItem.id === item.projectId);
    return simpleRecord("tasks", item.id, item.name, project ? project.name : "Global task");
  }).join("");

  $("#entries").innerHTML = data.entries.length ? data.entries.map(entryCard).join("") : `<div class="msg">No time entries yet.</div>`;
  $("#payroll").innerHTML = data.payroll.rows.length
    ? data.payroll.rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.workerName)}</td>
          <td>${escapeHtml(row.positionTitle)}</td>
          <td>${escapeHtml(row.projectName)}</td>
          <td>${escapeHtml(row.taskName)}</td>
          <td>${Number(row.hours || 0).toFixed(2)}</td>
          <td>${money.format(row.pay || 0)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="6">No approved entries yet.</td></tr>`;
}

async function save(event, type) {
  event.preventDefault();
  const item = Object.fromEntries(new FormData(event.currentTarget).entries());
  data = await api("/api/admin-save", {
    method: "POST",
    body: JSON.stringify({ passcode, type, item })
  });
  event.currentTarget.reset();
  render();
}

async function recordClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, type, id } = button.dataset;

  if (action === "delete") {
    if (!confirm("Delete this record? Old time records stay saved.")) return;
    data = await api("/api/admin-delete", {
      method: "POST",
      body: JSON.stringify({ passcode, type, id })
    });
    render();
    return;
  }

  const current = data[type].find((item) => item.id === id);
  const item = promptEdit(type, current);
  if (!item) return;
  data = await api("/api/admin-update", {
    method: "POST",
    body: JSON.stringify({ passcode, type, id, item })
  });
  render();
}

async function entryClick(event) {
  const button = event.target.closest("button[data-status]");
  if (!button) return;
  data = await api("/api/admin-entry-status", {
    method: "POST",
    body: JSON.stringify({ passcode, id: button.dataset.id, status: button.dataset.status })
  });
  render();
}

function promptEdit(type, current) {
  if (type === "positions") {
    const title = prompt("Position title", current.title);
    if (title === null) return null;
    const rate = prompt("Hourly rate", current.rate);
    if (rate === null) return null;
    return { title, rate };
  }

  if (type === "workers") {
    const name = prompt("Worker name", current.name);
    if (name === null) return null;
    const pin = prompt("Worker PIN", current.pin || "");
    if (pin === null) return null;
    const positionTitle = prompt("Position title", current.positionTitle || "");
    if (positionTitle === null) return null;
    const position = data.positions.find((item) => item.title.toLowerCase() === positionTitle.trim().toLowerCase());
    if (!position) {
      alert("Position not found. Use a position title from the Positions list.");
      return null;
    }
    return { name, pin, positionId: position.id };
  }

  if (type === "projects") {
    const name = prompt("Project name", current.name);
    if (name === null) return null;
    const address = prompt("Project address", current.address);
    if (address === null) return null;
    const code = prompt("Project code", current.code);
    if (code === null) return null;
    return { name, address, code };
  }

  if (type === "tasks") {
    const name = prompt("Task name", current.name);
    if (name === null) return null;
    const projectCode = prompt("Project code. Leave blank for global task.", data.projects.find((item) => item.id === current.projectId)?.code || "");
    if (projectCode === null) return null;
    const project = projectCode.trim() ? data.projects.find((item) => item.code.toLowerCase() === projectCode.trim().toLowerCase()) : null;
    if (projectCode.trim() && !project) {
      alert("Project code not found.");
      return null;
    }
    return { name, projectId: project ? project.id : "" };
  }

  return null;
}

function simpleRecord(type, id, title, detail) {
  return `
    <article class="record">
      <b>${escapeHtml(title)}</b>
      <div class="meta">${escapeHtml(detail || "")}</div>
      <div class="row">
        <button data-action="edit" data-type="${type}" data-id="${id}" type="button">Edit</button>
        <button class="danger" data-action="delete" data-type="${type}" data-id="${id}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function entryCard(entry) {
  return `
    <article class="record">
      <span class="pill ${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span>
      <b>${escapeHtml(entry.workerName)}</b>
      <div>${escapeHtml(entry.projectName)} - ${escapeHtml(entry.taskName)}</div>
      <div class="meta">${formatDateTime(entry.checkInAt)} to ${entry.checkOutAt ? formatDateTime(entry.checkOutAt) : "open"}</div>
      <div>${Number(entry.hours || 0).toFixed(2)} hrs - ${money.format(entry.pay || 0)}</div>
      ${entry.notes ? `<div class="meta">${escapeHtml(entry.notes)}</div>` : ""}
      ${entry.checkOutAt ? `
        <div class="row">
          <button data-id="${entry.id}" data-status="approved" type="button">Approve</button>
          <button data-id="${entry.id}" data-status="pending" type="button">Pending</button>
          <button class="danger" data-id="${entry.id}" data-status="rejected" type="button">Reject</button>
        </div>
      ` : ""}
    </article>
  `;
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
