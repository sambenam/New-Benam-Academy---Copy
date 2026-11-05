/**
 * Admin panel — notifications and the bell
 *
 * Notifications come exclusively from appApi.admin.notifications. No
 * localStorage / sessionStorage is used: announced-event ledgers, abuse
 * reports and per-device seen-state are all gone.
 */

function syncNotification(notification) {
  if (
    typeof appApi === "undefined" ||
    !appApi.admin ||
    !appApi.admin.notifications
  )
    return;
  persistAdmin(appApi.admin.notifications.create(notification), "ثبت اعلان");
}

function formatNotificationTime(timestamp, fallback = "همین حالا") {
  if (!timestamp) return fallback;
  const minutes = Math.floor((Date.now() - Number(timestamp)) / 60000);
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return minutes + " دقیقه پیش";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " ساعت پیش";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + " روز پیش";
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks + " هفته پیش";
  return Math.floor(days / 30) + " ماه پیش";
}

const notificationThemes = {
  purchase: "green",
  user: "blue",
  staff: "yellow",
  report: "red",
  deletion: "black",
};

function currentNotificationRole() {
  const member = appState.users.find((u) => u.id === currentStaffProfileId);
  return member ? member.role : currentAdminUserRole === "admin" ? "ادمین" : "مدیر سایت";
}

function canReceiveNotification(notification) {
  return (
    currentNotificationRole() !== "ادمین" ||
    !["staff", "report"].includes(notification.type)
  );
}

function visibleNotifications() {
  return appState.notifications.filter(canReceiveNotification);
}

let bellTimer = null;
let notificationIdHighWater = 0;
let notificationReconcileDepth = 0;
let notificationBatchChanged = false;

function pushAdminNotification(type, title, desc, details = {}) {
  const theme = notificationThemes[type] || "blue";
  const now = Date.now();
  notificationIdHighWater = Math.max(now, notificationIdHighWater + 1);
  const notification = {
    id: notificationIdHighWater,
    type,
    theme,
    title,
    desc,
    time: "همین حالا",
    createdAt: Date.now(),
    unread: true,
    fresh: true,
    details,
  };
  appState.notifications.unshift(notification);
  syncNotification(notification);
  if (canReceiveNotification(notification)) {
    activateNotificationBell(theme);
  }
  if (notificationReconcileDepth) {
    notificationBatchChanged = true;
  } else {
    renderNotificationDropdownItems();
    if (document.getElementById("view-notifications")?.classList.contains("active")) {
      renderNotificationsPage();
    }
  }
  return notification;
}

const notificationDetailSchemas = {
  purchase: { label: "سفارش و پرداخت", icon: "fa-bag-shopping" },
  user: { label: "ثبت‌نام کاربر", icon: "fa-user-plus" },
  staff: { label: "تغییرات پروفایل ادمین", icon: "fa-user-gear" },
  deletion: { label: "حذف حساب مدیریت", icon: "fa-user-slash" },
  report: { label: "گزارش تخلف", icon: "fa-flag" },
};

function activateNotificationBell(theme) {
  const bell = document.getElementById("notificationBtn");
  if (!bell) return;
  clearTimeout(bellTimer);
  bell.classList.remove("bell-green", "bell-blue", "bell-yellow", "bell-red", "bell-black");
  bell.classList.add("bell-red");
  bellTimer = setTimeout(
    () =>
      bell.classList.remove("bell-green", "bell-blue", "bell-yellow", "bell-red", "bell-black"),
    10000,
  );
}

function notificationCardSummary(n) {
  return n.desc;
}

function notificationIcon(type) {
  return type === "purchase"
    ? "fa-circle-check"
    : type === "user"
      ? "fa-user-plus"
      : type === "staff"
        ? "fa-user-gear"
        : type === "deletion"
          ? "fa-user-slash"
          : "fa-flag";
}

function renderNotificationsPage() {
  const container = document.getElementById("notificationsPageList");
  if (!container) return;

  const items = visibleNotifications();
  const clearBtn = document.getElementById("clearAllNotifsBtn");
  if (clearBtn) clearBtn.style.display = items.length ? "inline-flex" : "none";

  if (!items.length) {
    container.innerHTML =
      '<p style="text-align:center;padding:2rem">اعلانی وجود ندارد.</p>';
    return;
  }

  const allowedThemes = new Set(["green", "blue", "yellow", "red", "black"]);
  container.innerHTML = items
    .map((n) => {
      const theme = allowedThemes.has(n.theme) ? n.theme : "blue";
      return `<div class="notification-item notification-${theme}" style="cursor: pointer;" data-open-notification="${escapeAttr(String(n.id))}">
      <i class="fas ${notificationIcon(n.type)}"></i>
      <div><strong>${escapeHtml(n.title || "اعلان")}</strong><p>${escapeHtml(notificationCardSummary(n))}</p>
        <small>${escapeHtml(formatNotificationTime(n.createdAt, n.time))}</small></div>
      <button type="button" class="notif-delete"
              title="حذف این اعلان" aria-label="حذف این اعلان"
              data-delete-notification="${escapeAttr(String(n.id))}">
        <i class="fas fa-trash"></i>
      </button>
    </div>`;
    })
    .join("");
}

window.pushAdminNotification = pushAdminNotification;

function announceOrder(order) {
  if (!order || !order.id) return;
  pushAdminNotification(
    "purchase",
    "ثبت سفارش جدید",
    `سفارش ${order.id} ثبت شد.`,
    {
      "شماره سفارش": order.id || "—",
      خریدار: order.customer || "—",
      "ایمیل خریدار": order.buyerEmail || "—",
      "تلفن خریدار": order.buyerPhone || "—",
      محصول: order.product || "—",
      مبلغ: order.amount || "—",
      "وضعیت پرداخت": order.status || "—",
      "روش پرداخت": order.gateway || "درگاه پرداخت",
      "کد پیگیری": order.trackingCode || order.id || "—",
      "تاریخ ثبت": order.date || "—",
    },
  );
}

function announceUser(user) {
  if (!user || !user.id) return;
  if (user.role && user.role !== "کاربر عادی") return;
  pushAdminNotification(
    "user",
    "ثبت‌نام کاربر جدید",
    `کاربر «${user.name || "جدید"}» به سامانه پیوست.`,
    {
      "شناسه کاربر": "#" + user.id,
      "نام کاربر": user.name || "—",
      ایمیل: user.email || "—",
      تلفن: user.phone || "—",
      نقش: user.role || "کاربر عادی",
      "وضعیت حساب": user.status || "فعال",
      "روش ثبت‌نام": "فرم ثبت‌نام سایت",
      "تاریخ ثبت‌نام": user.createdAt || "—",
    },
  );
}

function announceReport(report) {
  if (!report || !report.id) return;
  pushAdminNotification(
    "report",
    "گزارش تخلف جدید",
    `کاربر «${report.reporterName || "ناشناس"}» یک گزارش تخلف ثبت کرده است.`,
    {
      "شناسه گزارش": report.id,
      گزارش‌دهنده: report.reporterName || "ناشناس",
      "کاربر/مورد گزارش‌شده": report.subject || "—",
      "نوع گزارش": report.kind || "—",
      "درجه اهمیت": report.severity || "متوسط",
      "وضعیت رسیدگی": report.status === "reviewed" ? "بررسی شد" : "در انتظار بررسی",
      شرح: report.description || "—",
      "مدرک پیوست": report.evidenceImage ? "تصویر پیوست شده" : "—",
      تاریخ: report.date || "—",
    },
  );
}

function loadAbuseReports() {
  return [];
}

function reconcileNotifications() {
  notificationReconcileDepth++;
  notificationBatchChanged = false;
  try {
    (appState.orders || []).slice().reverse().forEach(announceOrder);
    (appState.users || []).forEach(announceUser);
    loadAbuseReports().slice().reverse().forEach(announceReport);
  } finally {
    notificationReconcileDepth = Math.max(0, notificationReconcileDepth - 1);
  }

  if (notificationBatchChanged) {
    renderNotificationDropdownItems();
    if (document.getElementById("view-notifications")?.classList.contains("active")) {
      renderNotificationsPage();
    }
  }
}

function initNotifications() {
  const btn = document.getElementById("notificationBtn");
  const dropdown = document.getElementById("notificationDropdown");
  const markAllBtn = document.getElementById("markAllRead");

  if (btn && dropdown) {
    const setPanelOpen = (isOpen) => {
      dropdown.classList.toggle("active", isOpen);
      document.body.classList.toggle("notification-panel-open", isOpen);
      if (isOpen) lockBodyScroll();
      else unlockBodyScroll();
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains("active");
      if (willOpen) {
        closeAdminHeaderPopovers();
        renderNotificationDropdownItems();
      }
      setPanelOpen(willOpen);
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
        setPanelOpen(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dropdown.classList.contains("active")) {
        setPanelOpen(false);
      }
    });
  }

  updateNotificationBadge();

  if (markAllBtn) {
    markAllBtn.addEventListener("click", () => {
      dropdown.classList.remove("active");
      document.body.classList.remove("notification-panel-open");
      unlockBodyScroll();
      switchView("notifications");
      renderNotificationsPage();
    });
  }
}

function openNotificationDetails(notification) {
  if (!notification) return;
  const rawDetails = notification.details;
  const details = rawDetails && typeof rawDetails === "object" && !Array.isArray(rawDetails) ? rawDetails : {};
  const schema = notificationDetailSchemas[notification.type] || { label: "اعلان", icon: "fa-bell" };
  const allowedThemes = new Set(["green", "blue", "yellow", "red", "black"]);
  const theme = allowedThemes.has(notification.theme) ? notification.theme : "blue";
  const title = document.getElementById("notifDetailTitle");
  const time = document.getElementById("notifDetailTime");
  const hero = document.getElementById("notifDetailHero");
  const desc = document.getElementById("notifDetailDesc");
  const dynamic = document.getElementById("notifDetailDynamic");
  if (!title || !time || !hero || !desc || !dynamic) return;

  title.textContent = notification.title || "اعلان سیستم";
  time.textContent = formatNotificationTime(notification.createdAt, notification.time) + " · " + schema.label;
  hero.className = `notification-detail-hero notification-detail-hero--${theme}`;
  hero.innerHTML = `<i class="fas ${schema.icon || "fa-bell"}" id="notifDetailIcon" style="font-size: 24px;"></i><div><small>نوع اعلان</small><strong id="notifDetailType" style="font-size: 15px;">${escapeHtml(schema.label)}</strong></div>`;
  desc.textContent = notification.desc || "—";

  const entries = Object.entries(details).slice(0, 60);
  dynamic.innerHTML = entries.length
    ? `<div class="notification-detail-desc" style="margin-top:10px;padding:14px;border-radius:9px;line-height:1.9;">${entries.map(([key, value]) => `<p style="margin:4px 0;"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value == null || value === "" ? "—" : String(value))}</p>`).join("")}</div>`
    : "";

  if (notification.type === "report") {
    if (details["شناسه گزارش"] != null) {
      const reply = document.createElement("button");
      reply.type = "button";
      reply.className = "btn-primary report-reply-btn";
      reply.setAttribute("data-notification-report-reply", String(details["شناسه گزارش"]));
      reply.innerHTML = '<i class="fas fa-reply"></i> پاسخ به کاربر';
      dynamic.appendChild(reply);
    }
  }
  openModal("notificationDetailModal");
}

function deleteNotification(notifId) {
  const notification = appState.notifications.find((n) => String(n.id) === String(notifId));
  if (!notification) return;

  if (!confirm("این اعلان حذف شود؟")) return;

  appState.notifications = appState.notifications.filter((n) => String(n.id) !== String(notifId));
  renderNotificationDropdownItems();
  renderNotificationsPage();
  showToast("اعلان حذف شد.", "success");
}

function clearAllNotifications() {
  const visible = visibleNotifications();
  if (!visible.length) {
    showToast("اعلانی برای حذف وجود ندارد.", "info");
    return;
  }
  if (!confirm(`همه ${visible.length} اعلان حذف شوند؟`)) return;

  const removable = new Set(visible.map((n) => String(n.id)));
  appState.notifications = appState.notifications.filter((n) => !removable.has(String(n.id)));
  renderNotificationDropdownItems();
  renderNotificationsPage();
  showToast("همه اعلان‌ها حذف شدند.", "success");
}

function updateNotificationBadge() {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;
  const unread = visibleNotifications().filter((n) => n.unread).length;
  if (unread > 0) {
    badge.textContent = unread > 99 ? "99+" : unread;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function renderNotificationDropdownItems() {
  updateNotificationBadge();

  const container = document.getElementById("notifListContainer");
  if (!container) return;
  const allowedThemes = new Set(["green", "blue", "yellow", "red", "black"]);
  container.innerHTML = visibleNotifications()
    .slice(0, 10)
    .map((n) => {
      const theme = allowedThemes.has(n.theme) ? n.theme : "blue";
      return `<div class="notif-item notif-item--${theme}" style="cursor: pointer;" data-open-notification="${escapeAttr(String(n.id))}"><span class="notif-event-dot"></span><div><div style="font-size:13px;color:var(--text-primary);font-weight:600;">${escapeHtml(n.title || "اعلان")}</div><div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${escapeHtml(notificationCardSummary(n))} · ${escapeHtml(formatNotificationTime(n.createdAt, n.time))}</div></div></div>`;
    })
    .join("");
}

document.addEventListener("click", (event) => {
  const reply = event.target.closest("[data-notification-report-reply]");
  if (reply) {
    event.stopPropagation();
    openReportReply(reply.getAttribute("data-notification-report-reply"));
    return;
  }
  const trigger = event.target.closest("[data-open-notification]");
  if (!trigger || event.target.closest("[data-delete-notification]")) return;
  const id = trigger.getAttribute("data-open-notification");
  const notification = appState.notifications.find((item) => String(item.id) === String(id));
  if (notification) openNotificationDetails(notification);
});
