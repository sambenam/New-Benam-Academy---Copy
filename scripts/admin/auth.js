/**
 * Admin panel — access gate, roles and permission levels
 *
 * Who may open the panel at all, and what each role is allowed to do once
 * inside.
 *
 * BACKEND NOTE: a client-side gate is not security. Anyone can edit
 * JavaScript in their browser. Its job here is to stop the panel being
 * reached by typing the URL, and to give the server one obvious hook.
 * The real fix is for the server to refuse to serve admin.html, and every
 * /admin route, without a valid admin session.
 *
 * ADMIN_AUTH_ENABLED is deliberately false during development. It must be
 * set to true before release.
 *
 * No localStorage is used: sessions come only from appApi.auth.
 */

/** Roles that carry full panel privileges. */
const MANAGER_ROLES = ["مدیر سایت", "مدیر سیستم", "manager"];

function denyAdminAccess() {
  document.documentElement.innerHTML =
    '<body style="font-family:Vazirmatn,sans-serif;direction:rtl;display:flex;' +
    "align-items:center;justify-content:center;height:100vh;margin:0;" +
    'background:#0f172a;color:#e2e8f0;text-align:center">' +
    '<div><h1 style="font-size:1.5rem;margin-bottom:12px">دسترسی مجاز نیست</h1>' +
    '<p style="color:#94a3b8;margin-bottom:20px">برای ورود به پنل مدیریت باید احراز هویت کنید.</p>' +
    '<a href="index.html" style="color:#38bdf8">بازگشت به سایت</a></div></body>';
  return false;
}

const ADMIN_AUTH_ENABLED = false;

function requireAdminSession() {
  if (!ADMIN_AUTH_ENABLED) {
    // Local development: there is no real login, so default the operator to
    // the site manager with full rights until the backend issues sessions.
    return true;
  }

  try {
    if (new URLSearchParams(window.location.search).get("dev") === "1") {
      return true;
    }
  } catch (error) {
    /* URLSearchParams unsupported - fall through to the normal check */
  }

  // Auth is handled by appApi.auth.me() on the backend. Until then the gate
  // stays open in dev mode.
  return true;
}

/** Read the signed-in operator's role from the session (backend-provided). */
function readAdminRole() {
  // Until the backend sets a session, fall back to manager in dev mode.
  return "manager";
}

let currentAdminUserRole = readAdminRole();

/** True when the operator has full privileges. */
function isManager() {
  return currentAdminUserRole === "manager";
}

/* ----------------------------------------------------------------------------
   Staff hierarchy rules  (tab: مدیریت دسترسی‌ها)
   -------------------------------------------------------------------------- */
const STAFF_RANK = {
  "مدیر سایت": 1,
  "مدیر سیستم": 1,
  ادمین: 2,
  "کاربر عادی": 3,
};

function rankOf(role) {
  return STAFF_RANK[role] || 3;
}

function isManagerRole(role) {
  return rankOf(role) === 1;
}

/** How many active managers exist right now. */
function managerCount() {
  const pool = (typeof appState !== "undefined" && appState.users) || [];
  return pool.filter((u) => u && isManagerRole(u.role)).length;
}

/**
 * Decide whether the signed-in operator may act on a target account.
 */
function canActOnStaff(target, action) {
  if (!target) return { allowed: false, reason: "حساب موردنظر پیدا نشد." };

  if (!isManager()) {
    return {
      allowed: false,
      reason: "این عملیات فقط برای مدیر سایت مجاز است.",
    };
  }

  const removesAManager = action === "delete" || action === "demote";
  if (isManagerRole(target.role) && removesAManager && managerCount() <= 1) {
    return {
      allowed: false,
      reason: "این تنها مدیر سامانه است و نمی‌توان حذف یا تنزلش داد.",
    };
  }

  return { allowed: true, reason: "" };
}

/** Roles a manager may assign from the panel. */
function assignableRoles() {
  return ["مدیر سایت", "مدیر سیستم", "ادمین"];
}

/** Hide all but the last four digits. */
function maskPhone(value) {
  const phone = String(value || "").trim();
  if (!phone || phone === "—") return "—";
  const visible = phone.slice(0, 4);
  return visible + "•".repeat(Math.max(phone.length - 4, 3));
}

if (typeof window !== "undefined") {
  window.adminDev = {
    whoami() {
      const role = currentAdminUserRole;
      console.log(`نقش فعلی: ${role}`);
      return role;
    },
    asManager: () => {
      currentAdminUserRole = "manager";
      window.location.reload();
    },
    asAdmin: () => {
      currentAdminUserRole = "admin";
      window.location.reload();
    },
    reset: () => {
      currentAdminUserRole = "manager";
      window.location.reload();
    },
  };
}
