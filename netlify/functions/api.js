const { getStore } = require("@netlify/blobs");

const STORE_KEY = "empire-time-tracker-db";

exports.handler = async (event) => {
  try {
    const path = event.path.replace(/^.*\/api\/?/, "");
    const method = event.httpMethod;

    if (method === "OPTIONS") {
      return response(204, {});
    }

    if (method === "GET" && path === "worker-data") {
      const db = await loadDb();
      return response(200, publicData(db));
    }

    if (method === "POST" && path === "check-in") {
      const payload = parseBody(event);
      const db = await loadDb();
      const worker = findActive(db.workers, payload.workerId);
      const project = findActive(db.projects, payload.projectId);
      const task = findActive(db.tasks, payload.taskId);
      if (!worker || !project || !task) throw statusError(400, "Choose a valid worker, project, and task.");
      if (task.projectId && task.projectId !== project.id) throw statusError(400, "Choose a task that belongs to the selected project.");
      if (worker.pin && String(worker.pin) !== String(payload.pin || "")) throw statusError(403, "Worker PIN is incorrect.");

      const open = db.entries.find((entry) => entry.workerId === worker.id && !entry.checkOutAt);
      if (open) throw statusError(409, `${worker.name} is already checked in.`);

      db.entries.unshift({
        id: id(),
        workerId: worker.id,
        workerName: worker.name,
        projectId: project.id,
        projectName: project.name,
        taskId: task.id,
        taskName: task.name,
        checkInAt: new Date().toISOString(),
        checkOutAt: "",
        hours: 0,
        pay: 0,
        status: "open",
        notes: String(payload.notes || "")
      });
      await saveDb(db);
      return response(200, { message: "Checked in successfully.", data: publicData(db) });
    }

    if (method === "POST" && path === "check-out") {
      const payload = parseBody(event);
      const db = await loadDb();
      const worker = findActive(db.workers, payload.workerId);
      if (!worker) throw statusError(400, "Choose a valid worker.");
      if (worker.pin && String(worker.pin) !== String(payload.pin || "")) throw statusError(403, "Worker PIN is incorrect.");

      const open = db.entries.find((entry) => entry.workerId === worker.id && !entry.checkOutAt);
      if (!open) throw statusError(404, `${worker.name} is not currently checked in.`);

      const position = db.positions.find((item) => item.id === worker.positionId);
      open.checkOutAt = new Date().toISOString();
      open.status = "pending";
      open.hours = roundHours((new Date(open.checkOutAt) - new Date(open.checkInAt)) / 3600000);
      open.pay = roundMoney(open.hours * Number(position?.rate || 0));
      if (payload.notes) open.notes = [open.notes, payload.notes].filter(Boolean).join(" | ");

      await saveDb(db);
      return response(200, { message: "Checked out successfully.", data: publicData(db) });
    }

    if (path.startsWith("admin")) {
      const payload = method === "GET" ? event.queryStringParameters || {} : parseBody(event);
      requireAdmin(payload.passcode);
      const db = await loadDb();

      if (method === "GET" && path === "admin-data") {
        return response(200, adminData(db));
      }

      if (method === "POST" && path === "admin-save") {
        const type = collectionName(payload.type);
        const item = normalizeItem(payload.type, payload.item);
        db[type].unshift({ id: id(), active: true, ...item });
        await saveDb(db);
        return response(200, adminData(db));
      }

      if (method === "POST" && path === "admin-update") {
        const type = collectionName(payload.type);
        const item = db[type].find((record) => record.id === payload.id);
        if (!item) throw statusError(404, "Record not found.");
        Object.assign(item, normalizeItem(payload.type, payload.item));
        await saveDb(db);
        return response(200, adminData(db));
      }

      if (method === "POST" && path === "admin-delete") {
        const type = collectionName(payload.type);
        const item = db[type].find((record) => record.id === payload.id);
        if (!item) throw statusError(404, "Record not found.");
        item.active = false;
        await saveDb(db);
        return response(200, adminData(db));
      }

      if (method === "POST" && path === "admin-entry-status") {
        const entry = db.entries.find((record) => record.id === payload.id);
        if (!entry) throw statusError(404, "Entry not found.");
        entry.status = String(payload.status || "pending");
        await saveDb(db);
        return response(200, adminData(db));
      }
    }

    return response(404, { error: "Not found." });
  } catch (error) {
    return response(error.statusCode || 500, { error: error.message || "Something went wrong." });
  }
};

async function loadDb() {
  const store = openStore();
  const db = await store.get(STORE_KEY, { type: "json" });
  if (db) return normalizeDb(db);

  const seeded = seedDb();
  await store.setJSON(STORE_KEY, seeded);
  return seeded;
}

async function saveDb(db) {
  const store = openStore();
  db.updatedAt = new Date().toISOString();
  await store.setJSON(STORE_KEY, db);
}

function openStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const name = "empire-time-tracker";

  if (siteID && token) {
    return getStore({ name, siteID, token });
  }

  return getStore({ name });
}

function seedDb() {
  const laborer = id();
  const foreman = id();
  const project = id();
  return {
    positions: [
      { id: foreman, title: "Foreman", rate: 55, active: true },
      { id: laborer, title: "Formworker", rate: 42, active: true }
    ],
    workers: [
      { id: id(), name: "Sample Worker", pin: "1234", positionId: laborer, active: true }
    ],
    projects: [
      { id: project, name: "Sample Project", address: "Site address", code: "SAMPLE", active: true }
    ],
    tasks: [
      { id: id(), name: "Formwork", projectId: "", active: true },
      { id: id(), name: "Concrete preparation", projectId: project, active: true }
    ],
    entries: [],
    updatedAt: new Date().toISOString()
  };
}

function publicData(db) {
  const activeProjects = db.projects.filter((item) => item.active);
  const activeProjectIds = new Set(activeProjects.map((project) => project.id));

  return {
    positions: db.positions.filter((item) => item.active),
    workers: db.workers.filter((item) => item.active).map((worker) => ({ id: worker.id, name: worker.name, positionId: worker.positionId })),
    projects: activeProjects,
    tasks: db.tasks.filter((item) => item.active && (!item.projectId || activeProjectIds.has(item.projectId))),
    openEntries: db.entries.filter((entry) => !entry.checkOutAt),
    updatedAt: db.updatedAt || ""
  };
}

function adminData(db) {
  return {
    ...db,
    positions: db.positions.filter((item) => item.active),
    workers: db.workers.filter((item) => item.active).map((worker) => ({
      ...worker,
      positionTitle: db.positions.find((position) => position.id === worker.positionId)?.title || ""
    })),
    projects: db.projects.filter((item) => item.active),
    tasks: db.tasks.filter((item) => item.active),
    entries: db.entries,
    payroll: payroll(db),
    updatedAt: db.updatedAt || ""
  };
}

function payroll(db) {
  const rows = db.entries
    .filter((entry) => entry.checkOutAt && entry.status === "approved")
    .map((entry) => {
      const worker = db.workers.find((item) => item.id === entry.workerId);
      const position = db.positions.find((item) => item.id === worker?.positionId);
      return {
        ...entry,
        positionTitle: position?.title || "",
        rate: Number(position?.rate || 0)
      };
    });

  return {
    rows,
    totals: {
      hours: roundHours(rows.reduce((total, row) => total + Number(row.hours || 0), 0)),
      pay: roundMoney(rows.reduce((total, row) => total + Number(row.pay || 0), 0))
    }
  };
}

function requireAdmin(passcode) {
  const expected = process.env.ADMIN_PASSCODE || "1234";
  if (String(passcode || "") !== String(expected)) {
    throw statusError(403, "Incorrect admin passcode.");
  }
}

function collectionName(type) {
  const allowed = ["positions", "workers", "projects", "tasks"];
  if (!allowed.includes(type)) throw statusError(400, "Invalid record type.");
  return type;
}

function normalizeItem(type, item = {}) {
  if (type === "positions") return { title: text(item.title), rate: Number(item.rate || 0), active: true };
  if (type === "workers") return { name: text(item.name), pin: text(item.pin), positionId: text(item.positionId), active: true };
  if (type === "projects") return { name: text(item.name), address: text(item.address), code: text(item.code).toUpperCase(), active: true };
  if (type === "tasks") return { name: text(item.name), projectId: text(item.projectId), active: true };
  return item;
}

function normalizeDb(db) {
  return {
    positions: Array.isArray(db.positions) ? db.positions : [],
    workers: Array.isArray(db.workers) ? db.workers : [],
    projects: Array.isArray(db.projects) ? db.projects : [],
    tasks: Array.isArray(db.tasks) ? db.tasks : [],
    entries: Array.isArray(db.entries) ? db.entries : [],
    updatedAt: db.updatedAt || ""
  };
}

function findActive(items, idValue) {
  return items.find((item) => item.id === idValue && item.active);
}

function parseBody(event) {
  return event.body ? JSON.parse(event.body) : {};
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    },
    body: statusCode === 204 ? "" : JSON.stringify(body)
  };
}

function statusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function text(value) {
  return String(value || "").trim();
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function roundHours(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
