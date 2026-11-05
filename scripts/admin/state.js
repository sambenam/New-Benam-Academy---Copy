/**
 * Admin panel — the single source of data
 *
 * appState is the one object every view reads from. It starts EMPTY and is
 * hydrated exclusively through appApi (the backend). No localStorage /
 * sessionStorage is used to simulate users, orders, products, messages or
 * ads. See docs/تحویل-به-بک‌اند.md for the backend handoff.
 *
 * persistAdmin() is the only way a change reaches the API. It never throws
 * at the caller: a failed write shows a toast and leaves the local copy
 * alone, so a dropped connection cannot wipe what is on screen.
 *
 * Split out of scripts/admin.js, which had grown to 5,241 lines. Every
 * classic <script> shares one global scope, so these files see each other
 * exactly as one file would. The load order in html/admin.html matters only
 * for code that runs while a file is being parsed; boot.js is last because
 * it is the only file that does that on purpose.
 */

function toPersianDigits(value) {
  const charMap = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const text = value === null || value === undefined ? "" : String(value);
  return text.replace(/[0-9]/g, (match) => charMap[parseInt(match)]);
}

/* ----------------------------------------------------------------------------
   Loaders — all return empty until the backend is wired. No localStorage.
   -------------------------------------------------------------------------- */
function loadDynamicProducts() {
  return [];
}

function loadDynamicAds() {
  return [];
}

function loadDynamicOrders() {
  return [];
}

function loadDynamicUsers() {
  return [];
}

function normalizeUserContact(user) {
  return user;
}

function loadSystemSettings() {
  return {
    supportEmail: "support@benamacademy.ir",
    supportPhone: "۰۹۱۲۳۴۵۶۷۸۹",
    maintenanceMode: false,
    merchantId: "",
    currencyUnit: "toman",
    adminName: "مدیر کل سایت",
    adminAvatar: "../images/ravin.png",
  };
}

function loadDynamicMessages() {
  return [];
}

/** Roles with full panel access. */
const MANAGER_ROLES = ["مدیر سایت", "مدیر سیستم", "مدیر", "admin", "manager"];

/**
 * Which staff record belongs to the signed-in operator.
 * Resolved from the session by email once the backend sets a session.
 * Falls back to the first manager while auth is disabled in development.
 */
function resolveCurrentStaffId() {
  const pool = (typeof appState !== "undefined" && appState.users) || [];
  const firstManager = pool.find((u) => MANAGER_ROLES.indexOf(u.role) !== -1);
  return firstManager ? firstManager.id : null;
}

// Seeded empty; resolved from the session as soon as appState exists and the
// backend provides users. Until then currentStaffProfileId stays null.
let currentStaffProfileId = null;

let appState = {
  users: loadDynamicUsers(),
  products: loadDynamicProducts(),
  orders: loadDynamicOrders(),
  notifications: [],
  messages: loadDynamicMessages(),
  ads: loadDynamicAds(),
  settings: loadSystemSettings(),
};

/* ============================================================================
   API HYDRATION LAYER
   ----------------------------------------------------------------------------
   appState starts empty above. hydrateFromApi() pulls the authoritative data
   through appApi and re-renders. appApi.admin.* is the ONLY place that knows
   where data comes from; once the backend is attached this hits the server.
   ========================================================================== */
async function hydrateFromApi() {
  if (typeof appApi === "undefined" || !appApi.admin) return;

  const tasks = [
    ["users", appApi.admin.users.list()],
    ["products", appApi.admin.products.list()],
    ["orders", appApi.admin.orders.list()],
    ["messages", appApi.admin.messages.list()],
    ["notifications", appApi.admin.notifications.list()],
    ["ads", appApi.admin.ads.list()],
    ["settings", appApi.admin.settings.get()],
  ];

  const results = await Promise.allSettled(tasks.map(([, p]) => p));

  results.forEach((result, index) => {
    const key = tasks[index][0];
    if (result.status === "fulfilled" && result.value) {
      if (key === "notifications") {
        const incoming = Array.isArray(result.value) ? result.value : [];
        const known = new Set(incoming.map((n) => String(n.id)));
        const local = (appState.notifications || []).filter(
          (n) => !known.has(String(n.id)),
        );
        appState.notifications = local.concat(incoming);
      } else if (key === "settings" && typeof result.value === "object") {
        appState.settings = { ...appState.settings, ...result.value };
      } else if (Array.isArray(result.value)) {
        appState[key] = result.value;
      }
    } else if (result.status === "rejected") {
      console.warn("admin: hydration failed for " + key, result.reason);
    }
  });

  currentStaffProfileId = resolveCurrentStaffId();

  if (typeof reconcileNotifications === "function") reconcileNotifications();
  refreshAllViews();
}

/**
 * Fire-and-report helper for admin writes.
 *
 * The panel updates appState optimistically so the UI stays snappy; this
 * pushes the same change through appApi and surfaces failures. Once a real
 * backend is attached, a rejected promise here means the server refused the
 * write - that is the single place to add rollback if you want it.
 */
function persistAdmin(promise, label) {
  if (!promise || typeof promise.catch !== "function") return promise;
  return promise.catch((error) => {
    console.warn("admin: " + label + " failed to persist", error);
    if (typeof showToast === "function") {
      const detail = error && error.message ? error.message : "خطای ناشناخته";
      showToast(label + " در سرور ذخیره نشد: " + detail, "error");
    }
  });
}

/** Re-render whatever is currently on screen after data changes. */
function refreshAllViews() {
  const safe = (fn) => {
    try {
      if (typeof fn === "function") fn();
    } catch (error) {
      console.warn("admin: refresh step failed", error);
    }
  };
  const active = document.querySelector(".admin-view.active")?.id.replace(/^view-/, "");

  safe(typeof renderDashboardOrders === "function" ? renderDashboardOrders : null);
  safe(typeof renderDashboardProducts === "function" ? renderDashboardProducts : null);
  safe(typeof updateDashboardMetrics === "function" ? updateDashboardMetrics : null);
  if (active === "users") safe(typeof renderUsersTable === "function" ? renderUsersTable : null);
  if (active === "staff") safe(typeof renderStaffTable === "function" ? renderStaffTable : null);
  if (active === "products") safe(typeof renderProductsTable === "function" ? renderProductsTable : null);
  if (active === "orders") safe(typeof renderOrdersTable === "function" ? renderOrdersTable : null);
  if (active === "messages") safe(typeof renderMessages === "function" ? renderMessages : null);
  if (active === "ads") safe(typeof renderAdsTable === "function" ? renderAdsTable : null);

  safe(typeof updateMessagesBadgeCount === "function" ? updateMessagesBadgeCount : null);
}
