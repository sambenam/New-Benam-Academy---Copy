/**
 * Front-end-only rendering for administrator-added header items.
 *
 * Custom menu items previously lived in localStorage. That was a client-side
 * simulation of the menu API. No localStorage is used now: read() returns []
 * until the backend menu endpoints are connected.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "benamacademyHeaderCustomItems";
  const HIDDEN_KEY = "benamacademyHeaderHiddenItems";
  const ROOT = "root";
  const MAX_DEPTH = 3;
  const MAX_ITEMS = 150;
  const NONLINK_LABEL_KEYS = new Set(["studentsBooks", "studentsExamGroup", "studentsProjects"]);
  const STATIC_DESCENDANTS = {
    forStudents: ["studentsBooks", "diploma", "associate_degree", "bachelor", "master", "phd", "studentsExamGroup", "konkur1", "konkur2", "konkur3", "studentsProjects", "Enterpreneurship_projects", "Enternship-projects", "Financial-project", "allForStudents"],
    courses: ["allCourses", "beginner", "intermediate", "advanced", "videos"],
    regulations: ["allRegulations", "constitution", "commercialLaw", "laborLaw", "taxLaw", "socialSecurityLaw"],
    studentsBooks: ["diploma", "associate_degree", "bachelor", "master", "phd"],
    studentsExamGroup: ["konkur1", "konkur2", "konkur3"],
    studentsProjects: ["Enterpreneurship_projects", "Enternship-projects", "Financial-project"],
  };
  const BUILTIN_MENUS = [
    { key: "forStudents", fallback: "برای دانشجویان" },
    { key: "courses", fallback: "دوره‌ها" },
    { key: "regulations", fallback: "قوانین و مقررات" },
    { key: "news", fallback: "اخبار" },
    { key: "aboutUs", fallback: "درباره ما" },
  ];

  function staticParentFields() {
    const fields = window.BenamHeaderLabels ? window.BenamHeaderLabels.fields : [];
    return fields.filter((field) => !BUILTIN_MENUS.some((menu) => menu.key === field.key));
  }

  function isBuiltInSubmenuKey(key) {
    return staticParentFields().some((field) => field.key === key);
  }

  function cleanHref(value) {
    const href = String(value || "").trim();
    if (!href || href.length > 500 || /[\u0000-\u001f]/.test(href)) return "";
    if (/^(javascript|data|vbscript):/i.test(href)) return "";
    try {
      const parsed = new URL(href, window.location.href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return href;
    } catch (error) {
      return "";
    }
  }

  function normalizeItems(raw) {
    if (!Array.isArray(raw)) return [];
    const unique = new Map();
    raw.slice(0, MAX_ITEMS).forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const id = String(entry.id || "").slice(0, 80);
      const label = String(entry.label || "").trim().slice(0, 80);
      const parentKey = String(entry.parentKey || "");
      const kind = ["menu", "group", "link"].includes(entry.kind)
        ? entry.kind
        : (parentKey === ROOT ? "menu" : "link");
      const href = kind === "group" ? "" : cleanHref(entry.href);
      if (!id || !/^[\w-]+$/.test(id) || !label || (kind !== "group" && !href) || !parentKey || unique.has(id)) return;
      unique.set(id, { id, label, href, parentKey, kind });
    });

    const depths = new Map();
    const valid = new Map();
    let progressed = true;
    while (progressed) {
      progressed = false;
      unique.forEach((item, id) => {
        if (valid.has(id)) return;
        let depth = null;
        if (item.parentKey === ROOT) depth = 1;
        else if (BUILTIN_MENUS.some((menu) => menu.key === item.parentKey)) depth = 2;
        else if (isBuiltInSubmenuKey(item.parentKey)) depth = 3;
        else if (depths.has(item.parentKey)) depth = depths.get(item.parentKey) + 1;
        if (depth && depth <= MAX_DEPTH) {
          depths.set(id, depth);
          valid.set(id, item);
          progressed = true;
        }
      });
    }
    return Array.from(valid.values());
  }

  function read() {
    /* no localStorage - custom menu items come from the backend */
    return [];
  }

  function readHidden() {
    return [];
  }

  function isHidden(key) {
    return false;
  }

  function itemIsHidden(item, items) {
    return false;
  }

  function removeChildren(items, parentKey) {
    return items;
  }

  function hideStatic(key) {
    /* no persistence */
    announce(read());
    return [];
  }

  function restoreStructure() {
    announce([]);
  }

  function announce(items) {
    window.dispatchEvent(
      new window.CustomEvent("benam:header-custom-menu-changed", { detail: items }),
    );
  }

  function save(items) {
    /* no localStorage */
    announce(items || []);
    return items || [];
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "menu-" + window.crypto.randomUUID();
    }
    return "menu-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function createHref(label, items) {
    const base = "custom-" + String(label || "")
      .normalize("NFKC")
      .replace(/[\u200c\u200e\u200f]/g, "")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "custom-item";
    let key = base;
    let suffix = 2;
    while (false) key = base + "-" + suffix++; // placeholder; no registry to check
    return "list-page.html?cat=" + encodeURIComponent(key);
  }

  function descendants(items, parentKey) {
    return items.filter((item) => item.parentKey === parentKey);
  }

  function itemDepth(item, items) {
    if (!item) return 0;
    if (item.parentKey === ROOT) return 1;
    if (BUILTIN_MENUS.some((menu) => menu.key === item.parentKey)) return 2;
    if (isBuiltInSubmenuKey(item.parentKey)) return 3;
    const parent = items.find((candidate) => candidate.id === item.parentKey);
    return parent ? itemDepth(parent, items) + 1 : MAX_DEPTH + 1;
  }

  function getParentOptions() {
    const items = read();
    const labels = window.BenamHeaderLabels ? window.BenamHeaderLabels.read() : {};
    const options = [{ key: ROOT, label: "منوی اصلی", action: "بعد از قوانین و مقررات", depth: 0, kind: "menu" }];
    BUILTIN_MENUS.forEach((menu) => {
      options.push({ key: menu.key, label: labels[menu.key] || menu.fallback, action: "افزودن عنوان", depth: 1, kind: "group" });
    });
    const staticParents = window.BenamHeaderLabels
      ? window.BenamHeaderLabels.fields.filter((field) => !BUILTIN_MENUS.some((menu) => menu.key === field.key))
      : [];
    staticParents.forEach((field) => {
      options.push({
        key: field.key,
        label: (labels[field.group] || field.group) + " ← " + (labels[field.key] || field.value),
        action: "افزودن زیرگروه",
        depth: 2,
        kind: "link",
      });
    });
    const pathFor = (item) => {
      const parent = items.find((candidate) => candidate.id === item.parentKey);
      if (parent) return pathFor(parent) + " ← " + item.label;
      const submenu = staticParents.find((field) => field.key === item.parentKey);
      if (submenu) return (labels[submenu.group] || submenu.group) + " ← " + (labels[submenu.key] || submenu.value) + " ← " + item.label;
      const builtin = BUILTIN_MENUS.find((menu) => menu.key === item.parentKey);
      return (builtin ? (labels[builtin.key] || builtin.fallback) + " ← " : "") + item.label;
    };
    items.forEach((item) => {
      options.push({
        key: item.id,
        label: pathFor(item),
        action: item.kind === "menu" ? "افزودن عنوان" : "افزودن زیرگروه",
        depth: itemDepth(item, items),
        kind: item.kind === "menu" ? "group" : "link",
      });
    });
    return options;
  }

  function kindForParent(parentKey, items) {
    if (parentKey === ROOT) return "menu";
    if (BUILTIN_MENUS.some((menu) => menu.key === parentKey)) return "group";
    const parent = (items || read()).find((item) => item.id === parentKey);
    return parent && parent.kind === "menu" ? "group" : "link";
  }

  function makeAnchor(label, href, className) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = label;
    if (className) anchor.className = className;
    return anchor;
  }

  function makeDesktopNode(item, items) {
    const children = descendants(items, item.id);
    if (item.kind === "group") {
      const group = document.createElement("section");
      const heading = document.createElement("strong");
      heading.textContent = item.label;
      group.appendChild(heading);
      children.forEach((child) => group.appendChild(makeDesktopNode(child, items)));
      return group;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "custom-nav-entry";
    wrapper.appendChild(makeAnchor(item.label, item.href, "custom-nav-entry__link"));
    if (children.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "custom-nav-entry__toggle";
      toggle.setAttribute("aria-label", "نمایش زیرمنوی " + item.label);
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "‹";
      toggle.addEventListener("click", () => {
        const open = wrapper.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      wrapper.appendChild(toggle);

      const submenu = document.createElement("div");
      submenu.className = "custom-nav-submenu";
      children.forEach((child) => submenu.appendChild(makeDesktopNode(child, items)));
      wrapper.appendChild(submenu);
    }
    return wrapper;
  }

  function restoreGeneratedDesktop(nav) {
    nav.querySelectorAll(".custom-menu-injection, .custom-primary-menu").forEach((node) => node.remove());
    nav.querySelectorAll(".custom-nav-existing-parent").forEach((wrapper) => {
      const anchor = wrapper.querySelector(":scope > a[data-header-label]");
      if (anchor) wrapper.replaceWith(anchor);
      else wrapper.remove();
    });
    nav.querySelectorAll(".custom-generated-root-wrapper").forEach((wrapper) => {
      const anchor = wrapper.querySelector(":scope > .home-nav_link");
      if (anchor) wrapper.replaceWith(anchor);
      else wrapper.remove();
    });
  }

  function getDesktopRootLink(nav, key) {
    return Array.from(nav.querySelectorAll("[data-header-label]")).find(
      (node) => node.getAttribute("data-header-label") === key && node.classList.contains("home-nav_link"),
    );
  }

  function ensureDesktopDropdown(nav, key, label) {
    let link = getDesktopRootLink(nav, key);
    if (!link) return null;
    let menuItem = link.closest(".home-nav_item");
    if (!menuItem) {
      menuItem = document.createElement("div");
      menuItem.className = "home-nav_item has-dropdown custom-generated-root-wrapper";
      link.replaceWith(menuItem);
      menuItem.appendChild(link);
    }
    let dropdown = menuItem.querySelector(":scope > .home-nav_dropdown");
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.className = "home-nav_dropdown home-nav_dropdown--compact custom-menu-injection";
      dropdown.setAttribute("aria-label", "زیرمنوی " + label);
      menuItem.appendChild(dropdown);
    }
    return dropdown;
  }

  function renderDesktop(nav, items) {
    if (!nav) return;
    restoreGeneratedDesktop(nav);
    // No custom items exist yet; nothing to inject.
  }

  function toggleMobileNested(li, toggle) {
    const willOpen = !li.classList.contains("active");
    li.classList.toggle("active", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
  }

  function makeMobileNode(item, items) {
    const li = document.createElement("li");
    li.className = "mobile-sub-dropdown custom-mobile-node custom-mobile-generated";
    const row = document.createElement("div");
    row.className = "custom-mobile-node__row";
    const children = descendants(items, item.id);
    if (item.kind === "group") {
      const heading = document.createElement("strong");
      heading.textContent = item.label;
      row.appendChild(heading);
    } else {
      row.appendChild(makeAnchor(item.label, item.href, "custom-mobile-node__link"));
    }
    if (children.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "custom-mobile-toggle";
      toggle.setAttribute("aria-label", "نمایش زیرمنوی " + item.label);
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = '<i class="fas fa-chevron-down" aria-hidden="true"></i>';
      toggle.addEventListener("click", () => toggleMobileNested(li, toggle));
      row.appendChild(toggle);
      const submenu = document.createElement("ul");
      submenu.className = "mobile-sub_menu custom-mobile-generated";
      children.forEach((child) => submenu.appendChild(makeMobileNode(child, items)));
      li.appendChild(row);
      li.appendChild(submenu);
    } else {
      li.appendChild(row);
    }
    return li;
  }

  function removeGeneratedMobile(root) {
    root.querySelectorAll(".custom-mobile-generated, .custom-menu-injection").forEach((node) => node.remove());
    root.querySelectorAll(".custom-mobile-existing-parent-row").forEach((row) => {
      const li = row.closest(".mobile-sub-dropdown");
      const anchor = row.querySelector("a[data-header-label]");
      if (li && anchor) {
        li.classList.remove("custom-mobile-parent");
        row.replaceWith(anchor);
      }
    });
    root.querySelectorAll(".custom-mobile-root-row").forEach((row) => {
      const li = row.closest(".mobile-dropdown");
      const anchor = row.querySelector("a");
      if (li && anchor) {
        anchor.classList.remove("custom-mobile-parent-link");
        anchor.classList.add("mobile-dropdown-btn");
        row.replaceWith(anchor);
      }
    });
  }

  function toggleMobileRoot(li, toggle) {
    const willOpen = !li.classList.contains("active");
    li.classList.toggle("active", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
  }

  function findMobileRoot(root, key) {
    return Array.from(root.querySelectorAll("[data-header-label]")).find((node) =>
      node.getAttribute("data-header-label") === key && node.closest(".mobile-dropdown"),
    )?.closest(".mobile-dropdown") || null;
  }

  function appendMobileChildren(root, key, children, items) {
    // no custom items to append
  }

  function appendMobileStaticChildren(root, field, children, items) {
    // no custom items to append
  }

  function renderMobile(root, items) {
    if (!root) return;
    removeGeneratedMobile(root);
    // No custom items exist yet; nothing to inject.
  }

  function applyHidden(host) {
    // nothing hidden without localStorage
  }

  function apply(root) {
    const host = root || document;
    const items = read();
    renderDesktop(host.querySelector(".home-primary-nav"), items);
    renderMobile(host.querySelector(".mobile-header"), items);
    applyHidden(host);
    return items;
  }

  window.BenamCustomHeaderMenu = {
    storageKey: STORAGE_KEY,
    rootKey: ROOT,
    maxDepth: MAX_DEPTH,
    builtInMenus: BUILTIN_MENUS.map((menu) => ({ ...menu })),
    read,
    save,
    createId: makeId,
    createHref,
    kindForParent,
    parentOptions: getParentOptions,
    isHidden,
    hiddenKeys: readHidden,
    hideStatic,
    restoreStructure,
    removeChildren,
    apply,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => apply(document));
  } else {
    apply(document);
  }
})();
