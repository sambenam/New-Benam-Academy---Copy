/**
 * appApi — the frontend HTTP API adapter.
 *
 * BACKEND HANDOFF
 * ===============
 * This repository contains no backend and no mock modules. Every appApi
 * method below uses fetch. Set window.APP_CONFIG.apiBaseUrl before loading
 * this file; if it is empty, requests go to the current origin.
 *
 * appApi is the boundary for HTTP requests. Browser localStorage /
 * sessionStorage is NOT used to simulate a backend: sessions, ads, carts
 * and all data come from the API once it is wired up. docs/API_CONTRACT.md
 * is the request/response contract and is not a mock server.
 *
 * FOUR SECURITY RULES THAT ARE NOT OPTIONAL
 * =========================================
 *   1. Build download entitlements from the ORDERS TABLE. Never trust a list
 *      of product ids sent by the client.
 *   2. Never send "staff" or "report" notification rows to an "ادمین" role.
 *      The client filter is for display only, not for access control.
 *   3. Re-check the account status on EVERY authenticated request. Blocking
 *      an account must stop a session that is already open, not just the
 *      next login.
 *   4. Confirm the amount and the payment result with the gateway itself,
 *      never from a URL parameter.
 *
 * Full checklist: docs/تحویل-به-بک‌اند.md
 */

const APP_API_CONFIG = {
  baseUrl:
    typeof window !== "undefined" && window.APP_CONFIG
      ? window.APP_CONFIG.apiBaseUrl || ""
      : "",
  mode: "real",
  timeout: 10000,
};

/** Roles that may reach the admin panel. */
const ADMIN_ROLES = ["مدیر سایت", "مدیر سیستم", "ادمین", "admin", "manager"];

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status || 0;
    this.details = details || null;
  }
}

/**
 * A money value that is safe to store.
 * Anything that is not a finite, non-negative number becomes 0.
 */
function sanitizeAmount(value) {
  const amount = Number(value);
  if (!isFinite(amount) || amount < 0) return 0;
  return amount;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validateRequired(value, message) {
  if (!String(value || "").trim()) {
    throw new ApiError(message, 422);
  }
}

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return prefix + "-" + crypto.randomUUID();
  }
  return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

async function request(path, options) {
  const settings = options || {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APP_API_CONFIG.timeout);
  const headers = new Headers(settings.headers || {});
  headers.set("Accept", "application/json");

  if (settings.body && typeof settings.body !== "string") {
    headers.set("Content-Type", "application/json");
    settings.body = JSON.stringify(settings.body);
  }

  try {
    const response = await fetch(
      APP_API_CONFIG.baseUrl.replace(/\/+$/, "") +
        "/" +
        path.replace(/^\/+/, ""),
      {
        method: settings.method || "GET",
        headers: headers,
        body: settings.body,
        signal: controller.signal,
      },
    );
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new ApiError(
        payload && payload.message ? payload.message : "ارتباط با سرور ناموفق بود.",
        response.status,
        payload,
      );
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError("زمان پاسخ‌گویی سرور به پایان رسید.", 408);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("امکان برقراری ارتباط با سرور وجود ندارد.", 0, error);
  } finally {
    clearTimeout(timeout);
  }
}

const appApi = {
  config: APP_API_CONFIG,
  request: request,

  auth: {
    login: (payload) =>
      request("/auth/login", { method: "POST", body: payload }),
    register: (payload) =>
      request("/auth/register", { method: "POST", body: payload }),
    logout: () => request("/auth/logout", { method: "POST" }),
    promote: (payload) =>
      request("/auth/promote", { method: "POST", body: payload }),
    me: () => request("/auth/me"),
    forgotPassword: (payload) =>
      request("/auth/forgot-password", { method: "POST", body: payload }),
  },

  assistant: {
    chat: (payload) =>
      request("/assistant/chat", { method: "POST", body: payload }),
  },

  support: {
    sendMessage: (payload) =>
      request("/support/messages", { method: "POST", body: payload }),
    myMessages: (payload) =>
      request("/support/my-messages", { method: "POST", body: payload || {} }),
    reportAbuse: (payload) =>
      request("/support/reports", { method: "POST", body: payload }),
  },

  newsletter: {
    subscribe: (payload) =>
      request("/newsletter/subscribe", { method: "POST", body: payload }),
  },

  profile: {
    update: (payload) =>
      request("/profile/update", { method: "PATCH", body: payload }),
    changePassword: (payload) =>
      request("/profile/password", { method: "POST", body: payload }),
  },

  commerce: {
    validateCoupon: (payload) =>
      request("/commerce/coupon", { method: "POST", body: payload }),
    createPayment: (payload) =>
      request("/commerce/payment", { method: "POST", body: payload }),
    recordCancelled: (payload) =>
      request("/commerce/cancelled", { method: "POST", body: payload }),
    myOrders: (payload) =>
      request("/commerce/my-orders", { method: "POST", body: payload || {} }),
    entitlements: () =>
      request("/commerce/entitlements", { method: "POST", body: {} }),
  },

  content: {
    get: (itemId) =>
      request("/content/items/" + encodeURIComponent(itemId)),
    update: (itemId, payload) =>
      request("/content/items/" + encodeURIComponent(itemId), {
        method: "PATCH",
        body: payload,
      }),
    remove: (itemId) =>
      request("/content/items/" + encodeURIComponent(itemId), {
        method: "DELETE",
      }),
  },

  /* Active promotional banners shown on home / list / single-post pages. */
  ads: {
    list: async () => {
      return await request("/ads");
    },
  },

  /* ------------------------------------------------------------------------
     ADMIN PANEL API
     Every admin-panel data operation goes through here. A backend developer
     implements the endpoints and the panel keeps working unchanged.
     ------------------------------------------------------------------------ */
  admin: {
    products: {
      list: () => request("/admin/products"),
      create: (payload) =>
        request("/admin/products", { method: "POST", body: payload }),
      update: (id, payload) =>
        request("/admin/products/" + encodeURIComponent(id), {
          method: "PATCH",
          body: payload,
        }),
      remove: (id) =>
        request("/admin/products/" + encodeURIComponent(id), {
          method: "DELETE",
        }),
    },
    orders: {
      list: () => request("/admin/orders"),
      create: (payload) =>
        request("/admin/orders", { method: "POST", body: payload }),
      updateStatus: (id, status) =>
        request(
          "/admin/orders/" + encodeURIComponent(id) + "/status",
          { method: "PATCH", body: { status } },
        ),
    },
    users: {
      list: () => request("/admin/users"),
      create: (payload) =>
        request("/admin/users", { method: "POST", body: payload }),
      updateStatus: (id, status) =>
        request(
          "/admin/users/" + encodeURIComponent(id) + "/status",
          { method: "PATCH", body: { status } },
        ),
      updateRole: (id, role) =>
        request(
          "/admin/users/" + encodeURIComponent(id) + "/role",
          { method: "PATCH", body: { role } },
        ),
      remove: (id) =>
        request("/admin/users/" + encodeURIComponent(id), {
          method: "DELETE",
        }),
    },
    notifications: {
      list: () => request("/admin/notifications"),
      create: (payload) =>
        request("/admin/notifications", { method: "POST", body: payload }),
      markRead: (id) =>
        request(
          "/admin/notifications/" + encodeURIComponent(id) + "/read",
          { method: "PATCH", body: {} },
        ),
      remove: (id) =>
        request("/admin/notifications/" + encodeURIComponent(id), {
          method: "DELETE",
        }),
      clear: () => request("/admin/notifications", { method: "DELETE" }),
    },
    pendingChanges: {
      list: () => request("/admin/pending-changes"),
      stage: (staffId, changes) =>
        request(
          "/admin/pending-changes/" + encodeURIComponent(staffId),
          { method: "POST", body: changes },
        ),
      clear: (staffId) =>
        request(
          "/admin/pending-changes/" + encodeURIComponent(staffId),
          { method: "DELETE" },
        ),
    },
    audit: {
      list: (staffId) =>
        request("/admin/audit/" + encodeURIComponent(staffId)),
      record: (staffId, entry) =>
        request(
          "/admin/audit/" + encodeURIComponent(staffId),
          { method: "POST", body: entry },
        ),
    },
    contentItems: {
      list: () => request("/admin/content-items"),
      create: (payload) =>
        request("/admin/content-items", { method: "POST", body: payload }),
      remove: (id) =>
        request("/admin/content-items/" + encodeURIComponent(id), {
          method: "DELETE",
        }),
    },
    reports: {
      list: () => request("/admin/reports"),
      setStatus: (id, status) =>
        request(
          "/admin/reports/" + encodeURIComponent(id) + "/status",
          { method: "PATCH", body: { status } },
        ),
      reply: (id, payload) =>
        request(
          "/admin/reports/" + encodeURIComponent(id) + "/reply",
          { method: "POST", body: payload },
        ),
      remove: (id) =>
        request("/admin/reports/" + encodeURIComponent(id), {
          method: "DELETE",
        }),
    },
    messages: {
      list: () => request("/admin/messages"),
      reply: (id, payload) =>
        request(
          "/admin/messages/" + encodeURIComponent(id) + "/reply",
          { method: "POST", body: payload },
        ),
      markRead: (id) =>
        request(
          "/admin/messages/" + encodeURIComponent(id) + "/read",
          { method: "PATCH", body: {} },
        ),
      remove: (id) =>
        request("/admin/messages/" + encodeURIComponent(id), {
          method: "DELETE",
        }),
    },
    settings: {
      get: () => request("/admin/settings"),
      save: (payload) =>
        request("/admin/settings", { method: "PUT", body: payload }),
    },
    ads: {
      list: async () => {
        return await request("/admin/ads");
      },
      create: async (payload) => {
        return await request("/admin/ads", { method: "POST", body: payload });
      },
      update: async (id, payload) => {
        return await request("/admin/ads/" + encodeURIComponent(id), {
          method: "PATCH",
          body: payload,
        });
      },
      remove: async (id) => {
        return await request("/admin/ads/" + encodeURIComponent(id), {
          method: "DELETE",
        });
      },
    },
  },
};

if (typeof window !== "undefined") {
  window.appApi = appApi;
  window.ApiError = ApiError;
}

if (typeof module !== "undefined") {
  module.exports = { appApi, ApiError, APP_API_CONFIG };
}
