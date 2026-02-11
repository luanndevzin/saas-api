const els = {
  apiBase: document.getElementById("api-base"),
  apiToken: document.getElementById("api-token"),
  employeeSelect: document.getElementById("employee-select"),
  timestamp: document.getElementById("timestamp"),
  note: document.getElementById("note"),
  clockIn: document.getElementById("clock-in"),
  clockOut: document.getElementById("clock-out"),
  entries: document.getElementById("entries"),
  toast: document.getElementById("toast"),
  statusBadge: document.getElementById("status-badge"),
  refreshEmployees: document.getElementById("refresh-employees"),
  saveSettings: document.getElementById("save-settings"),
  autoAction: document.getElementById("auto-action"),
  scanStatus: document.getElementById("scan-status"),
  toggleScan: document.getElementById("toggle-scan"),
};

let employees = [];
let reader = null;
let scanning = false;

async function loadEnvFile() {
  try {
    const res = await fetch("./.env");
    if (!res.ok) return;
    const txt = await res.text();
    const map = Object.fromEntries(
      txt
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=");
          if (idx === -1) return [line, ""];
          return [line.slice(0, idx), line.slice(idx + 1)];
        })
    );
    if (map.API_BASE) els.apiBase.value = map.API_BASE;
    if (map.API_TOKEN) els.apiToken.value = map.API_TOKEN;
    if (map.AUTO_ACTION) els.autoAction.value = map.AUTO_ACTION;
    saveSettings();
  } catch (e) {
    console.debug("Could not load .env (optional):", e);
  }
}

const STORAGE_KEY = "kiosk-settings";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    els.apiBase.value = s.apiBase || "";
    els.apiToken.value = s.apiToken || "";
    els.autoAction.value = s.autoAction || "none";
  } catch (e) {
    console.error(e);
  }
}

function saveSettings() {
  const data = {
    apiBase: els.apiBase.value.trim(),
    apiToken: els.apiToken.value.trim(),
    autoAction: els.autoAction.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function showToast(text, variant = "info") {
  const node = els.toast;
  node.textContent = text;
  node.style.borderColor = variant === "error" ? "#ef4444" : "#1f2735";
  node.classList.remove("hidden");
  setTimeout(() => node.classList.add("hidden"), 3500);
}

async function api(path, options = {}) {
  const base = els.apiBase.value.trim().replace(/\/$/, "");
  const token = els.apiToken.value.trim();
  if (!base || !token) throw new Error("Configure API base e token");
  const url = `${base}/${path.replace(/^\//, "")}`;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === "string" ? data : data?.error || "Erro API");
  return data;
}

async function loadEmployees() {
  try {
    const data = await api("/employees?status=active");
    employees = Array.isArray(data) ? data : [];
    els.employeeSelect.innerHTML = `<option value="">Selecione</option>` + employees.map(e => `<option value="${e.id}">${e.name} (#${e.id})</option>`).join("");
    els.statusBadge.textContent = `Conectado · ${employees.length} ativos`;
    els.statusBadge.style.background = "#0f3a1f";
    els.statusBadge.style.color = "#34d399";
  } catch (e) {
    els.statusBadge.textContent = "Offline";
    els.statusBadge.style.background = "#301212";
    els.statusBadge.style.color = "#fca5a5";
    showToast(e.message, "error");
  }
}

async function clock(type) {
  const employee_id = Number(els.employeeSelect.value);
  if (!employee_id) {
    showToast("Selecione colaborador", "error");
    return;
  }
  const tsRaw = els.timestamp.value;
  const note = els.note.value.trim();
  const body = { employee_id };
  if (tsRaw) {
    const d = new Date(tsRaw);
    if (!Number.isNaN(d.getTime())) body.timestamp = d.toISOString();
  }
  if (note) body.note = note;
  try {
    await api(type === "in" ? "/time-entries/clock-in" : "/time-entries/clock-out", { method: "POST", body });
    showToast(type === "in" ? "Entrada registrada" : "Saída registrada", "success");
    els.note.value = "";
    await loadEntries();
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function loadEntries() {
  const emp = els.employeeSelect.value;
  const params = emp ? `?employee_id=${emp}&from=${new Date().toISOString().slice(0,10)}` : "";
  try {
    const data = await api(`/time-entries${params}`);
    const list = Array.isArray(data) ? data.slice(0, 20) : [];
    els.entries.innerHTML = list.map(item => {
      const open = !item.clock_out;
      return `<div class="item">
        <div class="left">
          <div class="text">${item.employee_id} • ${item.clock_in}</div>
          <div class="small">${item.clock_out || "-"}</div>
        </div>
        <div class="pill ${open ? "warn" : "success"}">${open ? "Aberto" : "Fechado"}</div>
      </div>`;
    }).join("") || '<div class="small-text">Nenhuma marcação hoje</div>';
  } catch (e) {
    showToast(e.message, "error");
  }
}

function parseEmployeeFromQR(text) {
  try {
    const j = JSON.parse(text);
    if (j.employee_id) return Number(j.employee_id);
  } catch (_) { /* ignore */ }
  const asInt = parseInt(text, 10);
  if (!Number.isNaN(asInt)) return asInt;
  return null;
}

async function handleScan(text) {
  const empId = parseEmployeeFromQR(text);
  if (!empId) {
    showToast("QR inválido. Esperado ID ou JSON {employee_id}", "error");
    return;
  }
  const opt = Array.from(els.employeeSelect.options).find(o => Number(o.value) === empId);
  if (!opt) {
    showToast("ID não encontrado na lista de colaboradores ativos", "error");
    return;
  }
  els.employeeSelect.value = String(empId);
  els.scanStatus.textContent = `Lido QR do ID ${empId}`;
  const auto = els.autoAction.value;
  if (auto === "in" || auto === "out") {
    await clock(auto);
  }
}

function toggleScan() {
  if (scanning) {
    reader?.stop().catch(console.error);
    scanning = false;
    els.toggleScan.textContent = "Iniciar câmera";
    els.scanStatus.textContent = "Scanner parado";
    return;
  }
  reader = new Html5Qrcode("reader");
  reader.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (text) => handleScan(text),
    (err) => console.debug("scan err", err)
  ).then(() => {
    scanning = true;
    els.toggleScan.textContent = "Parar câmera";
    els.scanStatus.textContent = "Lendo QR...";
  }).catch((err) => {
    showToast("Não foi possível iniciar câmera: " + err, "error");
  });
}

// event bindings
els.saveSettings.onclick = () => { saveSettings(); loadEmployees().then(loadEntries); };
els.refreshEmployees.onclick = () => { loadEmployees().then(loadEntries); };
els.clockIn.onclick = () => clock("in");
els.clockOut.onclick = () => clock("out");
els.toggleScan.onclick = toggleScan;
els.employeeSelect.onchange = loadEntries;

// bootstrap
loadSettings();
loadEnvFile().finally(() => loadEmployees().then(loadEntries));
