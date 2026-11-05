/**
 * Admin panel — tab router, dashboard and shared UI helpers
 *
 * switchView() is the only thing that decides which tab is on screen. It
 * also re-renders that tab's data.
 *
 * showToast(), lockBodyScroll() and scrollElementIntoView() live here.
 * No localStorage is used: dashboard data comes from appState (hydrated via appApi).
 */

function orderAmountValue(amount) {
  if (typeof amount === "number") return amount;
  const digits = toEnglishDigits(String(amount || "")).replace(/[^0-9.]/g, "");
  const value = parseFloat(digits);
  return isNaN(value) ? 0 : value;
}

function calculateRevenue(orders) {
  return (orders || [])
    .filter((o) => o && o.status === "success")
    .reduce((sum, o) => sum + orderAmountValue(o.amount), 0);
}

function updateDashboardMetrics() {
  const revenueEl = document.getElementById("stat-revenue");
  const ordersEl = document.getElementById("stat-orders");

  if (typeof appState === "undefined" || !Array.isArray(appState.orders))
    return;

  if (revenueEl) {
    revenueEl.textContent =
      toPersianDigits(calculateRevenue(appState.orders).toLocaleString()) +
      " تومان";
  }

  if (ordersEl) {
    const paid = appState.orders.filter(
      (o) => o && o.status === "success",
    ).length;
    ordersEl.textContent = toPersianDigits(paid.toLocaleString());
  }
}

function updateOrdersNotifications() {
  const badge = document.getElementById("orders-badge");
  if (!badge) return;

  const currentCount = Array.isArray(appState.orders)
    ? appState.orders.length
    : 0;
  const unreadCount = currentCount;
  if (unreadCount > 0) {
    badge.textContent = toPersianDigits(unreadCount.toLocaleString());
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

function refreshMaintenanceNotice() {
  const settings = (typeof appState !== "undefined" && appState.settings) || {};
  const on = Boolean(settings.maintenanceMode);
  let bar = document.getElementById("adminMaintenanceNotice");

  if (!on) {
    if (bar) bar.remove();
    return;
  }
  if (bar) return;

  const host = document.querySelector(".main-content");
  if (!host) return;

  bar = document.createElement("div");
  bar.id = "adminMaintenanceNotice";
  bar.className = "maintenance-notice";
  bar.innerHTML =
    '<i class="fas fa-tools"></i>' +
    "<span>سایت در حالت تعمیر است و بازدیدکنندگان صفحه قفل را می‌بینند.</span>" +
    '<button type="button" class="btn-secondary" id="maintenanceQuickOff">' +
    '<i class="fas fa-power-off"></i> غیرفعال کردن</button>';

  const header = host.querySelector(".top-header");
  if (header && header.nextSibling) {
    host.insertBefore(bar, header.nextSibling);
  } else {
    host.prepend(bar);
  }

  document.getElementById("maintenanceQuickOff")?.addEventListener("click", () => {
    const settings = (typeof appState !== "undefined" && appState.settings) || {};
    settings.maintenanceMode = false;
    if (typeof appApi !== "undefined" && appApi.admin) {
      persistAdmin(appApi.admin.settings.save(settings), "غیرفعال کردن حالت تعمیر");
    }
    const checkbox = document.getElementById("setMaintenanceMode");
    if (checkbox) checkbox.checked = false;
    refreshMaintenanceNotice();
    showToast("حالت تعمیر غیرفعال شد. سایت در دسترس است.", "success");
  });
}

function updateSettingsLockout() {
  const isLocked = currentAdminUserRole === "admin";
  const settingsView = document.getElementById("view-settings");
  if (!settingsView) return;

  const inputs = settingsView.querySelectorAll(
    "#settingsGeneralForm input, #settingsGeneralForm select, #settingsGeneralForm button, #settingsGatewayForm input, #settingsGatewayForm select, #settingsGatewayForm button",
  );
  inputs.forEach(function (el) {
    if (isLocked) {
      el.disabled = true;
      el.style.opacity = "0.5";
      el.style.cursor = "not-allowed";
      if (el.tagName === "INPUT" || el.tagName === "SELECT") {
        el.style.filter = "blur(3px)";
      }
    } else {
      el.disabled = false;
      el.style.opacity = "1";
      el.style.cursor = "auto";
      el.style.filter = "none";
    }
  });

  let warningBanner = document.getElementById("settingsLockWarning");
  if (isLocked) {
    if (!warningBanner) {
      warningBanner = document.createElement("div");
      warningBanner.id = "settingsLockWarning";
      warningBanner.className = "alert alert-error";
      warningBanner.style.background = "rgba(255, 59, 48, 0.08)";
      warningBanner.style.color = "#ff3b30";
      warningBanner.style.border = "1px solid rgba(255, 59, 48, 0.15)";
      warningBanner.style.padding = "12px";
      warningBanner.style.borderRadius = "8px";
      warningBanner.style.marginBottom = "1.5rem";
      warningBanner.style.textAlign = "center";
      warningBanner.style.fontWeight = "bold";
      warningBanner.style.fontSize = "14px";
      warningBanner.style.direction = "rtl";
      warningBanner.innerHTML = `<i class="fas fa-lock" style="margin-left: 6px;"></i> دسترسی مسدود است: تغییر تنظیمات امنیتی، درگاه مالی و عمومی سیستم فقط مخصوص «مدیر کل سایت» می‌باشد.`;
      settingsView
        .querySelector(".dashboard-content")
        .insertBefore(
          warningBanner,
          settingsView.querySelector(".content-grid"),
        );
    }
  } else {
    if (warningBanner) {
      warningBanner.remove();
    }
  }
}

function switchView(viewName, options) {
  document.querySelectorAll(".admin-view").forEach((view) => {
    view.classList.remove("active");
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.add("active");
  }

  document.querySelectorAll(".sidebar-nav li").forEach((li) => {
    li.classList.remove("active");
    if (li.getAttribute("data-view") === viewName) {
      li.classList.add("active");
    }
  });

  document.getElementById("sidebar").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");

  if (!options || options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  if (viewName === "users" && typeof renderUsersTable === "function") renderUsersTable();
  if (viewName === "products" && typeof renderProductsTable === "function") renderProductsTable();
  if (viewName === "orders" && typeof renderOrdersTable === "function") renderOrdersTable();
  if (viewName === "ads" && typeof renderAdsTable === "function") renderAdsTable();

  if (viewName === "site-content" &&
    typeof renderContentTable === "function" &&
    (typeof contentTableHasRendered === "undefined" || !contentTableHasRendered)
  ) {
    renderContentTable();
  }

  if (viewName === "settings" && typeof updateSettingsLockout === "function") {
    updateSettingsLockout();
  }

  if (viewName === "analytics" && typeof renderAnalyticsView === "function") {
    renderAnalyticsView();
  }

  if (viewName === "staff") {
    activatePendingStaffReviews();
    renderStaffTable();
  }

  if (viewName === "notifications") {
    renderNotificationsPage();
  }

  if (viewName === "messages") {
    renderMessages();
  }

  if (viewName === "dashboard") {
    try {
      const activeUsers = Array.isArray(appState.users)
        ? appState.users.filter(
            (u) => u && (u.status === "فعال" || u.status === undefined),
          ).length
        : 0;
      const totalRevenue = Array.isArray(appState.orders)
        ? appState.orders
            .filter((o) => o && o.status === "success")
            .reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
        : 0;
      const newOrdersCount = Array.isArray(appState.orders)
        ? appState.orders.length
        : 0;
      const statUsersEl = document.getElementById("stat-users");
      const statRevenueEl = document.getElementById("stat-revenue");
      const statOrdersEl = document.getElementById("stat-orders");
      if (statUsersEl) statUsersEl.textContent = activeUsers.toLocaleString();
      if (statRevenueEl)
        statRevenueEl.textContent = totalRevenue.toLocaleString();
      if (statOrdersEl)
        statOrdersEl.textContent = newOrdersCount.toLocaleString();
    } catch (e) {}

    try {
      document.getElementById("stat-satisfaction-bar").style.width = "95%";
      document.getElementById("stat-satisfaction").textContent = "۹۵٪";
    } catch (e) {}

    try {
      const ordersTable = document.querySelector("#dashboardOrdersTable tbody");
      if (ordersTable && Array.isArray(appState.orders)) {
        const recentOrders = appState.orders.slice(0, 3);
        ordersTable.innerHTML = recentOrders
          .map(
            (o) =>
              `<tr data-dashboard-order-id="${escapeAttr(String(o.id || ""))}" style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='rgba(0,122,255,0.05)'" onmouseout="this.style.background='transparent'">
          <td>#${escapeHtml(o.id || "—")}</td>
          <td>${escapeHtml(o.customer || "—")}</td>
          <td>${escapeHtml(o.product || "—")}</td>
          <td>${escapeHtml(String((o.amount || 0).toLocaleString()))} تومان</td>
          <td><span style="padding: 3px 8px; border-radius: 6px; background: ${o.status === "success" ? "rgba(22,163,74,0.12)" : o.status === "pending" ? "rgba(234,179,8,0.12)" : "rgba(239,68,68,0.12)"}; color: ${o.status === "success" ? "#16a34a" : o.status === "pending" ? "#ca8a04" : "#ef4444"}; font-size: 11px; font-weight: 700;">${escapeHtml(getStatusText(o.status) || "—")}</span></td>
        </tr>`,
          )
          .join("");
      }
    } catch (e) {}

    try {
      const topProducts = document.getElementById("dashboardTopProducts");
      if (topProducts && Array.isArray(appState.products)) {
        const bestProducts = appState.products.slice(0, 5);
        topProducts.innerHTML = bestProducts
          .map(
            (p) =>
              `<div onclick="switchView('products')" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <span style="font-size: 13px; color: var(--text-primary);">${escapeHtml(p.name || "—")}</span>
          <span style="font-size: 12px; color: var(--text-secondary);">${formatProductPrice(p.price)}</span>
        </div>`,
          )
          .join("");
      }
    } catch (e) {}

    try {
      const activitiesList = document.querySelector(".activities-list");
      if (activitiesList && Array.isArray(appState.notifications)) {
        const latestNotifs = appState.notifications.slice(0, 5);
        activitiesList.innerHTML = latestNotifs
          .map((n) => {
            const iconMap = {
              purchase: "fa-shopping-cart",
              user: "fa-user-plus",
              staff: "fa-user-gear",
              report: "fa-triangle-exclamation",
              deletion: "fa-user-xmark",
            };
            const themeColor =
              n.type === "report"
                ? "red"
                : n.type === "staff"
                  ? "yellow"
                  : n.type === "user"
                    ? "blue"
                    : n.type === "deletion"
                      ? "black"
                      : "green";
            return `<div class="activity-item" onclick="switchView('notifications')" style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
            <div class="activity-icon ${themeColor}"><i class="fas ${iconMap[n.type] || "fa-bell"}"></i></div>
            <div class="activity-info"><h4>${escapeHtml(n.title || "—")}</h4><p>${escapeHtml(n.time || "—")}</p></div>
          </div>`;
          })
          .join("");
      }
    } catch (e) {}

    try {
      const chartBars = document.querySelector(".stats-chart .chart-bars");
      if (chartBars) {
        chartBars.innerHTML = [
          { pct: 45, label: "هفته ۱" },
          { pct: 65, label: "هفته ۲" },
          { pct: 85, label: "هفته ۳" },
          { pct: 70, label: "هفته ۴" },
        ]
          .map(
            (b) =>
              `<div class="chart-bar-item"><div class="chart-bar" style="height: ${b.pct}%"></div><span>${b.label}</span></div>`,
          )
          .join("");
      }
    } catch (e) {}

    try {
      const customersList = document.querySelector(".customers-list");
      if (customersList && Array.isArray(appState.users)) {
        const topCustomers = [];
        customersList.innerHTML = topCustomers
          .map(
            (c, idx) =>
              `<div class="customer-item" onclick="switchView('users')" style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <img src="../images/ravin.png" alt="" />
          <div class="customer-info">
            <h4>${escapeHtml(c.name || "—")}</h4>
            <p>${escapeHtml(String(c.orders || 0))} سفارش • ${escapeHtml(String((c.totalSpent || 0).toLocaleString()))} تومان</p>
          </div>
          <div class="customer-badge"><i class="fas fa-star"></i><span>VIP</span></div>
        </div>`,
          )
          .join("");
      }
    } catch (e) {}

    try {
      const unreadMessagesEl = document.getElementById(
        "dashboardUnreadMessages",
      );
      const unreadSummaryEl = document.getElementById("dashboardUnreadSummary");
      if (
        unreadMessagesEl &&
        unreadSummaryEl &&
        typeof messages !== "undefined"
      ) {
        const unread = messages.filter(isUnreadMessage);
        unreadSummaryEl.textContent =
          unread.length > 0 ? unread.length + " خوانده‌نشده" : "۰ خوانده‌نشده";
        unreadMessagesEl.innerHTML =
          unread
            .slice(0, 3)
            .map(
              (m) =>
                `<div onclick="switchView('messages')" style="cursor: pointer; padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.4); border-left: 3px solid #007aff; box-shadow: 0 4px 20px rgba(0,122,255,0.12); transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.7)'" onmouseout="this.style.background='rgba(255,255,255,0.4)'">
          <h4 style="margin: 0 0 4px; font-size: 13px; color: var(--text-primary);">${escapeHtml(m.sender || "")}</h4>
          <p style="font-size: 11px; color: var(--text-secondary); margin: 0;">${escapeHtml(m.body ? m.body.substring(0, 60) + (m.body.length > 60 ? "..." : "") : "")}</p>
        </div>`,
            )
            .join("") ||
          `<p style="font-size: 12px; color: var(--text-secondary);">پیام خوانده‌نشده‌ای ثبت نشده است.</p>`;
      }
    } catch (e) {}

    try {
      const dashNotifsEl = document.getElementById("dashboardNotifications");
      if (dashNotifsEl && Array.isArray(appState.notifications)) {
        const latest = appState.notifications.slice(0, 5);
        dashNotifsEl.innerHTML =
          latest
            .map((n) => {
              const schema =
                notificationDetailSchemas[n.type] ||
                notificationDetailSchemas["purchase"];
              const dotColor =
                n.type === "report"
                  ? "#FF3B30"
                  : n.type === "staff"
                    ? "#FFCC00"
                    : n.type === "user"
                      ? "#007AFF"
                      : n.type === "deletion"
                        ? "#2C2C2E"
                        : "#34C759";
              return `<div data-open-notification="${escapeAttr(String(n.id))}" style="cursor: pointer; padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.3); transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.7)'" onmouseout="this.style.background='rgba(255,255,255,0.4)'">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span>
              <div><strong style="font-size: 13px; color: var(--text-primary);">${escapeHtml(schema ? schema.label : n.type)}</strong><p style="font-size: 11px; color: var(--text-secondary); margin: 2px 0 0;">${escapeHtml(n.time || "—")}</p></div>
            </div>
          </div>`;
            })
            .join("") ||
          `<p style="font-size: 12px; color: var(--text-secondary);">اعلانی ثبت نشده است.</p>`;
      }
    } catch (e) {}
  }
}

function initNavigation() {
  const dashboardOrders = document.getElementById("dashboardOrdersTable");
  if (dashboardOrders) {
    dashboardOrders.addEventListener("click", (event) => {
      const row = event.target.closest("[data-dashboard-order-id]");
      if (row && typeof openOrderDetailModal === "function") {
        openOrderDetailModal(row.getAttribute("data-dashboard-order-id"));
      }
    });
  }

  const navLinks = document.querySelectorAll(
    ".sidebar-nav a:not(.dropdown-toggle)",
  );
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        const viewName = href.substring(1).replace("-list", "");
        let mappedView = viewName;
        if (
          ["users", "users-list", "add-user", "user-roles"].includes(viewName)
        )
          mappedView = "users";
        else if (
          [
            "products",
            "products-list",
            "add-product",
            "categories",
            "inventory",
          ].includes(viewName)
        )
          mappedView = "products";
        else if (["general", "security", "notifications"].includes(viewName))
          mappedView = "settings";
        else if (viewName === "site-content") mappedView = "site-content";

        if (document.getElementById(`view-${mappedView}`)) {
          e.preventDefault();
          switchView(mappedView);
          window.location.hash = href;
        }
      }
    });
  });

  document.querySelectorAll(".dropdown-toggle").forEach((toggle) => {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      toggle.parentElement.classList.toggle("active");
    });
  });
}

function initMobileSidebar() {
  const menuToggle = document.getElementById("menuToggle");
  const closeSidebar = document.getElementById("closeSidebar");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("active");
    overlay.classList.add("active");
  });

  closeSidebar.addEventListener("click", () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (!confirm("آیا می‌خواهید از پنل مدیریت خارج شوید؟")) return;

    try {
      if (typeof appApi !== "undefined") await appApi.auth.logout();
    } catch (error) {
      /* clearing the local session is enough without a backend */
    }

    showToast("با موفقیت خارج شدید", "info");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 700);
  });
}

function initTables() {
  const activeView = document.querySelector(".admin-view.active");
  const viewName = activeView && activeView.id.replace(/^view-/, "");
  if (viewName === "dashboard") switchView("dashboard", { scroll: false });
}

function renderDashboardOrders() {
  const tbody = document.querySelector("#dashboardOrdersTable tbody");
  if (!tbody) return;
  tbody.innerHTML = appState.orders
    .slice(0, 5)
    .map(
      (order) => `
        <tr data-dashboard-order-id="${escapeAttr(String(order.id || ""))}" style="cursor:pointer">
            <td>${escapeHtml(order.id || "—")}</td>
            <td>${escapeHtml(order.customer || "—")}</td>
            <td>${escapeHtml(order.product || "—")}</td>
            <td>${escapeHtml(order.amount == null ? "—" : String(order.amount))}</td>
            <td><span class="status ${["success", "pending", "failed", "cancelled"].includes(order.status) ? order.status : "pending"}">${escapeHtml(getStatusText(order.status))}</span></td>
        </tr>
    `,
    )
    .join("");
}

function renderDashboardProducts() {
  const container = document.getElementById("dashboardTopProducts");
  if (!container) return;
  container.innerHTML = appState.products
    .slice(0, 4)
    .map(
      (prod) => `
        <div class="product-item">
            <img src="${escapeAttr(prod.img || "../images/ravin.png")}" alt="">
            <div class="product-info">
                <h4>${escapeHtml(prod.name || "—")}</h4>
                <p>شناسه: ${escapeHtml(prod.id || "—")}</p>
            </div>
            <div class="product-price">
                <span style="font-weight: bold; color: var(--success);">${formatProductPrice(prod.price)}</span>
            </div>
        </div>
    `,
    )
    .join("");
}

function lockBodyScroll() {
  const width = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty("--scrollbar-width", width + "px");
}

function unlockBodyScroll() {
  document.documentElement.style.setProperty("--scrollbar-width", "0px");
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const styles = {
    success: { icon: "fa-check-circle", color: "success" },
    error: { icon: "fa-exclamation-circle", color: "danger" },
    info: { icon: "fa-info-circle", color: "primary" },
  };
  const safeType = styles[type] ? type : "info";
  const toast = document.createElement("div");
  toast.className = `toast ${safeType}`;
  const icon = document.createElement("i");
  icon.className = `fas ${styles[safeType].icon}`;
  icon.style.cssText = `font-size: 18px; color: var(--${styles[safeType].color});`;
  const text = document.createElement("span");
  text.textContent = message == null ? "" : String(message);
  toast.append(icon, text);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function scrollElementIntoView(element, options) {
  if (!element || typeof element.scrollIntoView !== "function") return;
  try {
    element.scrollIntoView(options);
  } catch (error) {
    /* Scrolling is a nicety; never let it stop the highlight. */
  }
}
