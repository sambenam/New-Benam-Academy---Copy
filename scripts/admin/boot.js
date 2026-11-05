/**
 * Admin panel — startup
 *
 * MUST BE THE LAST SCRIPT ON THE PAGE. This is the only file whose code
 * runs while it is being parsed, so everything it touches has to exist
 * already.
 *
 * No localStorage is used. The storage listener and System Settings
 * population that previously synced from localStorage are removed; settings
 * come from appApi.admin.settings.get().
 */

window.addEventListener("storage", function () {
  // No cross-tab localStorage sync remains. Other tabs write through the API.
});

function closeAdminHeaderPopovers() {
  const notif = document.getElementById("notificationDropdown");
  if (notif) notif.classList.remove("active");
  document.body.classList.remove("notification-panel-open");
  if (typeof unlockBodyScroll === "function") unlockBodyScroll();
  const msgs = document.getElementById("messagesFloatingPanel");
  if (msgs) msgs.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  // Gate first - everything below assumes an authenticated operator.
  if (!requireAdminSession()) return;

  currentAdminUserRole = readAdminRole();

  refreshMaintenanceNotice();

  attachPriceFormatting();

  hydrateFromApi();

  const messagesHeaderBtn = document.getElementById("messagesHeaderBtn");
  const messagesFloatingPanel = document.getElementById("messagesFloatingPanel");
  const closeFloatingPanelBtn = document.getElementById("closeFloatingPanelBtn");

  if (messagesHeaderBtn && messagesFloatingPanel) {
    messagesHeaderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = messagesFloatingPanel.style.display === "block";
      if (isVisible) {
        messagesFloatingPanel.style.display = "none";
      } else {
        closeAdminHeaderPopovers();
        renderFloatingMessages();
        messagesFloatingPanel.style.display = "block";
      }
    });
  }

  if (closeFloatingPanelBtn && messagesFloatingPanel) {
    closeFloatingPanelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      messagesFloatingPanel.style.display = "none";
    });
  }

  const openMessagesTabBtn = document.getElementById("openMessagesTabBtn");
  if (openMessagesTabBtn) {
    openMessagesTabBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (messagesFloatingPanel) messagesFloatingPanel.style.display = "none";
      switchView("messages");
    });
  }

  document.addEventListener("click", (e) => {
    if (
      messagesFloatingPanel &&
      messagesFloatingPanel.style.display === "block"
    ) {
      if (
        !messagesFloatingPanel.contains(e.target) &&
        messagesHeaderBtn &&
        !messagesHeaderBtn.contains(e.target)
      ) {
        messagesFloatingPanel.style.display = "none";
      }
    }
  });

  initNavigation();
  initMobileSidebar();
  initTables();
  if (recentlyUpdatedStaffId)
    setTimeout(function () {
      const id = recentlyUpdatedStaffId;
      recentlyUpdatedStaffId = null;
      delete recentStaffFieldChanges[id];
      renderStaffTable();
    }, 8000);
  initNotifications();
  initModals();
  initSearch();
  initGlobalSearch();
  initReportReply();
  initRowDeletes();

  // Settings values are now fetched from the API via hydrateFromApi and live
  // in appState.settings. The inputs below are populated from there when the
  // settings view is entered.
  const settingsForm = document.getElementById("settingsGeneralForm");
  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("setSupportEmail").value.trim();
      const phone = document.getElementById("setSupportPhone").value.trim();
      const maintenance = document.getElementById("setMaintenanceMode").checked;

      const currentSettings = (typeof appState !== "undefined" && appState.settings) || {};
      currentSettings.supportEmail = email;
      currentSettings.supportPhone = phone;
      currentSettings.maintenanceMode = maintenance;

      if (typeof appApi !== "undefined" && appApi.admin) {
        persistAdmin(appApi.admin.settings.save(currentSettings), "ذخیره تنظیمات");
      }
      refreshMaintenanceNotice();
      showToast("تنظیمات عمومی و پشتیبانی با موفقیت ذخیره شد.", "success");
    });
  }

  const settingsGatewayForm = document.getElementById("settingsGatewayForm");
  if (settingsGatewayForm) {
    settingsGatewayForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const merchant = document.getElementById("setMerchantId").value.trim();
      const currency = document.getElementById("setCurrencyUnit").value;

      const currentSettings = (typeof appState !== "undefined" && appState.settings) || {};
      currentSettings.merchantId = merchant;
      currentSettings.currencyUnit = currency;

      if (typeof appApi !== "undefined" && appApi.admin) {
        persistAdmin(appApi.admin.settings.save(currentSettings), "ذخیره تنظیمات");
      }
      showToast("تنظیمات درگاه مالی با موفقیت ذخیره شد.", "success");
    });
  }

  const currentPasswordField = document.getElementById("setAdminCurrentPassword");
  if (currentPasswordField) {
    currentPasswordField.value = "";
    currentPasswordField.placeholder = "رمز فعلی را وارد کنید";
  }

  const toggleNewPasswordBtn = document.getElementById("toggleNewPasswordBtn");
  const newPasswordSection = document.getElementById("newPasswordSection");
  if (toggleNewPasswordBtn && newPasswordSection) {
    toggleNewPasswordBtn.addEventListener("click", () => {
      if (newPasswordSection.style.display === "none") {
        newPasswordSection.style.display = "block";
        document.getElementById("setAdminPassword").required = true;
        document.getElementById("setAdminPasswordConfirm").required = true;
      } else {
        newPasswordSection.style.display = "none";
        document.getElementById("setAdminPassword").required = false;
        document.getElementById("setAdminPasswordConfirm").required = false;
        document.getElementById("setAdminPassword").value = "";
        document.getElementById("setAdminPasswordConfirm").value = "";
      }
    });
  }

  const settingsAdminForm = document.getElementById("settingsAdminForm");
  if (settingsAdminForm) {
    settingsAdminForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("setAdminName").value.trim();
      const avatar = document.getElementById("setAdminAvatar").value.trim();

      const currentSettings = (typeof appState !== "undefined" && appState.settings) || {};
      currentSettings.adminName = name;
      currentSettings.adminAvatar = avatar;

      if (typeof appApi !== "undefined" && appApi.admin) {
        persistAdmin(appApi.admin.settings.save(currentSettings), "ذخیره تنظیمات");
      }

      const sideNameEl = document.getElementById("sidebarUserName");
      const sideAvatarEl = document.getElementById("sidebarAvatar");
      if (sideNameEl) sideNameEl.textContent = name;
      if (sideAvatarEl) sideAvatarEl.src = avatar;
      const profileHeading = document.getElementById("profileHeadingName");
      if (profileHeading) profileHeading.textContent = name;

      showToast("پروفایل کاربری با موفقیت به‌روزرسانی شد.", "success");
    });
  }

  document.querySelectorAll(".toggle-password-settings").forEach(function (icon) {
    icon.addEventListener("click", function () {
      const targetId = icon.getAttribute("data-target");
      const targetInput = document.getElementById(targetId);
      if (targetInput) {
        if (targetInput.type === "password") {
          targetInput.type = "text";
          icon.classList.remove("fa-eye");
          icon.classList.add("fa-eye-slash");
          icon.style.color = "var(--primary)";
        } else {
          targetInput.type = "password";
          icon.classList.remove("fa-eye-slash");
          icon.classList.add("fa-eye");
          icon.style.color = "var(--text-secondary)";
        }
      }
    });
  });

  const avatarInput = document.getElementById("profileAvatarFile");
  const avatarChoose = document.getElementById("profilePhotoChoose");
  if (avatarChoose && avatarInput)
    avatarChoose.addEventListener("click", () => avatarInput.click());
  if (avatarInput)
    avatarInput.addEventListener("change", function () {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (event) {
        const src = event.target.result;
        document.getElementById("setAdminAvatar").value = src;
        document.getElementById("profileAvatarPreview").src = src;
      };
      reader.readAsDataURL(file);
    });

  const currentHash = window.location.hash;
  if (currentHash && currentHash.startsWith("#")) {
    const viewName = currentHash.substring(1).replace("-list", "");
    let mappedView = viewName;
    if (["users", "users-list", "add-user", "user-roles"].includes(viewName)) {
      mappedView = "users";
    } else if (
      ["products", "products-list", "add-product", "categories", "inventory"].includes(viewName)
    ) {
      mappedView = "products";
    } else if (["general", "security", "notifications"].includes(viewName)) {
      mappedView = "settings";
    } else if (viewName === "site-content") {
      mappedView = "site-content";
    } else if (viewName === "analytics") {
      mappedView = "analytics";
    } else if (viewName === "messages") {
      mappedView = "messages";
    }

    if (document.getElementById(`view-${mappedView}`)) {
      switchView(mappedView);
    }
  }

  updateDashboardMetrics();
  updateOrdersNotifications();
  updateSettingsLockout();
  updateMessagesBadgeCount();
});

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
