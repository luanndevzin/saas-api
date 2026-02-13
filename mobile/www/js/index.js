(function () {
  "use strict";

  var DEFAULT_API_URL = "https://diplomatic-simplicity-production-70e0.up.railway.app/v1";
  var STORAGE_KEYS = {
    apiUrl: "ponto_api_url",
    token: "ponto_token",
    role: "ponto_role"
  };

  var state = {
    apiUrl: "",
    token: "",
    role: ""
  };

  var ui = {
    loginScreen: document.getElementById("login-screen"),
    clockScreen: document.getElementById("clock-screen"),
    loginForm: document.getElementById("login-form"),
    apiUrlInput: document.getElementById("api-url"),
    emailInput: document.getElementById("email"),
    passwordInput: document.getElementById("password"),
    loginButton: document.getElementById("login-button"),
    loginError: document.getElementById("login-error"),
    employeeName: document.getElementById("employee-name"),
    statusText: document.getElementById("status-text"),
    todayHours: document.getElementById("today-hours"),
    entriesList: document.getElementById("entries-list"),
    clockError: document.getElementById("clock-error"),
    refreshButton: document.getElementById("refresh-button"),
    clockInButton: document.getElementById("clock-in-button"),
    clockOutButton: document.getElementById("clock-out-button"),
    logoutButton: document.getElementById("logout-button")
  };

  function normalizeApiUrl(value) {
    var url = (value || "").trim();
    if (!url) {
      return DEFAULT_API_URL;
    }
    url = url.replace(/\/+$/, "");
    if (!/\/v1$/i.test(url)) {
      url += "/v1";
    }
    return url;
  }

  function setError(element, message) {
    if (!message) {
      element.textContent = "";
      element.hidden = true;
      return;
    }
    element.textContent = message;
    element.hidden = false;
  }

  function translateError(error) {
    var msg = String(error && error.message ? error.message : error || "Erro inesperado");
    var raw = msg.toLowerCase();

    if (raw.indexOf("failed to fetch") >= 0 || raw.indexOf("network") >= 0) {
      return "Nao foi possivel conectar na API.";
    }
    if (raw.indexOf("invalid credentials") >= 0) {
      return "Email ou senha invalidos.";
    }
    if (raw.indexOf("employee profile not linked") >= 0) {
      return "Seu usuario nao esta vinculado a um colaborador.";
    }
    if (raw.indexOf("employee is not active") >= 0) {
      return "Seu cadastro nao esta ativo para bater ponto.";
    }
    return msg;
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleString("pt-BR");
  }

  function formatHours(seconds) {
    var value = Number(seconds || 0) / 3600;
    return value.toFixed(2) + " h";
  }

  async function api(path, options) {
    options = options || {};
    var method = options.method || "GET";
    var auth = options.auth !== false;

    var headers = {
      "Content-Type": "application/json"
    };
    if (auth && state.token) {
      headers.Authorization = "Bearer " + state.token;
    }

    var response = await fetch(state.apiUrl + path, {
      method: method,
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    var text = await response.text();
    var data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = { error: text };
    }

    if (!response.ok) {
      var message = (data && (data.error || data.message)) || text || "Erro na API";
      throw new Error(message);
    }

    return data;
  }

  function showLogin() {
    ui.loginScreen.hidden = false;
    ui.clockScreen.hidden = true;
  }

  function showClock() {
    ui.loginScreen.hidden = true;
    ui.clockScreen.hidden = false;
  }

  function saveSession() {
    localStorage.setItem(STORAGE_KEYS.apiUrl, state.apiUrl);
    localStorage.setItem(STORAGE_KEYS.token, state.token);
    localStorage.setItem(STORAGE_KEYS.role, state.role || "");
  }

  function clearSession() {
    state.token = "";
    state.role = "";
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.role);
  }

  function ensureCollaboratorRole(role) {
    return role === "colaborador" || role === "member";
  }

  function renderEntries(entries) {
    ui.entriesList.innerHTML = "";
    if (!entries || entries.length === 0) {
      var empty = document.createElement("li");
      empty.textContent = "Sem batidas registradas.";
      ui.entriesList.appendChild(empty);
      return;
    }

    entries.forEach(function (entry) {
      var li = document.createElement("li");
      var endLabel = entry.end_at ? formatDate(entry.end_at) : "em aberto";
      var status = entry.is_running ? "aberto" : "encerrado";
      li.textContent =
        formatDate(entry.start_at) +
        " -> " +
        endLabel +
        " | " +
        formatHours(entry.duration_seconds) +
        " | " +
        status;
      ui.entriesList.appendChild(li);
    });
  }

  async function refreshClock() {
    setError(ui.clockError, "");
    try {
      var data = await api("/time-entries/me?limit=20");
      var hasOpenEntry = !!data.open_entry;

      ui.employeeName.textContent = data.employee_name || "Colaborador";
      ui.statusText.textContent = hasOpenEntry ? "Em expediente" : "Fora de expediente";
      ui.todayHours.textContent = formatHours(data.today_seconds || 0);
      ui.clockInButton.disabled = hasOpenEntry;
      ui.clockOutButton.disabled = !hasOpenEntry;
      renderEntries(data.entries || []);
    } catch (error) {
      var message = translateError(error);
      setError(ui.clockError, message);

      if (String(error.message || "").toLowerCase().indexOf("unauthorized") >= 0) {
        clearSession();
        showLogin();
      }
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError(ui.loginError, "");
    ui.loginButton.disabled = true;

    try {
      state.apiUrl = normalizeApiUrl(ui.apiUrlInput.value);
      var auth = await api("/auth/login", {
        method: "POST",
        auth: false,
        body: {
          email: ui.emailInput.value.trim(),
          password: ui.passwordInput.value
        }
      });

      if (!ensureCollaboratorRole(auth.role)) {
        throw new Error("Este app e exclusivo para colaborador.");
      }

      state.token = auth.access_token;
      state.role = auth.role;
      saveSession();

      ui.passwordInput.value = "";
      showClock();
      await refreshClock();
    } catch (error) {
      setError(ui.loginError, translateError(error));
    } finally {
      ui.loginButton.disabled = false;
    }
  }

  async function handleClockIn() {
    setError(ui.clockError, "");
    ui.clockInButton.disabled = true;
    try {
      await api("/time-entries/clock-in", { method: "POST" });
      await refreshClock();
    } catch (error) {
      setError(ui.clockError, translateError(error));
      ui.clockInButton.disabled = false;
    }
  }

  async function handleClockOut() {
    setError(ui.clockError, "");
    ui.clockOutButton.disabled = true;
    try {
      await api("/time-entries/clock-out", { method: "POST" });
      await refreshClock();
    } catch (error) {
      setError(ui.clockError, translateError(error));
      ui.clockOutButton.disabled = false;
    }
  }

  function handleLogout() {
    clearSession();
    showLogin();
  }

  async function bootstrap() {
    state.apiUrl = normalizeApiUrl(localStorage.getItem(STORAGE_KEYS.apiUrl) || DEFAULT_API_URL);
    state.token = (localStorage.getItem(STORAGE_KEYS.token) || "").trim();
    state.role = (localStorage.getItem(STORAGE_KEYS.role) || "").trim();

    ui.apiUrlInput.value = state.apiUrl;

    ui.loginForm.addEventListener("submit", handleLogin);
    ui.refreshButton.addEventListener("click", refreshClock);
    ui.clockInButton.addEventListener("click", handleClockIn);
    ui.clockOutButton.addEventListener("click", handleClockOut);
    ui.logoutButton.addEventListener("click", handleLogout);

    if (state.token && ensureCollaboratorRole(state.role)) {
      showClock();
      await refreshClock();
      return;
    }

    showLogin();
  }

  if (window.cordova) {
    document.addEventListener("deviceready", bootstrap, false);
  } else {
    document.addEventListener("DOMContentLoaded", bootstrap, false);
  }
})();
