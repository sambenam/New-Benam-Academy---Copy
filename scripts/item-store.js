/**
 * Item content store.
 *
 * All overrides / added / deleted / ordering data previously lived in
 * localStorage. That was a client-side simulation of the content API. The
 * store now returns empty defaults so the public site renders the static
 * siteData unchanged until the backend (content items endpoints) is live.
 */

const ITEM_CONTENT_STORAGE_KEY = "benamacademyItemContent";
const ADDED_ITEMS_KEY = "benamacademyAddedItems";
const DELETED_ITEMS_KEY = "benamacademyDeletedItems";
const CONTENT_ITEM_ORDER_KEY = "benamacademyContentItemOrder";

function loadContentItemOrder() {
  return {};
}

function moveContentItemToFront(categoryKey, itemId, existingItems) {
  /* no persistence until the backend endpoint exists */
}

function loadContentOverrides() {
  return {};
}

function saveContentOverride(itemId, payload) {
  /* no localStorage - content edits go through appApi.content.update */
}

function removeContentOverride(itemId) {
  /* no localStorage */
}

function getContentOverride(itemId) {
  return null;
}

function loadAddedItems() {
  return [];
}

function saveAddedItem(item) {
  /* no localStorage */
}

function removeAddedItem(itemId) {
  /* no localStorage */
}

function loadDeletedItemIds() {
  return [];
}

function addDeletedItemId(itemId) {
  /* no localStorage */
}

function applyContentOverrides(data) {
  // No overrides exist: return the static data unchanged.
  return data;
}

function findSiteItem(itemId) {
  if (typeof siteData === "undefined") {
    return null;
  }

  for (const catKey in siteData) {
    const category = siteData[catKey];
    if (!category || !Array.isArray(category.items)) {
      continue;
    }

    const item = category.items.find(function (entry) {
      return entry.id === itemId;
    });

    if (item) {
      return {
        item: item,
        categoryKey: catKey,
        categoryTitle: category.title,
      };
    }
  }

  return null;
}

function getAllSiteItems() {
  if (typeof siteData === "undefined") {
    return [];
  }

  const rows = [];

  Object.keys(siteData).forEach(function (catKey) {
    const category = siteData[catKey];
    if (!category || !Array.isArray(category.items)) {
      return;
    }

    category.items.forEach(function (item) {
      rows.push({
        id: item.id,
        title: item.title,
        excerpt: item.excerpt || "",
        categoryKey: catKey,
        categoryTitle: category.title,
        hasOverride: false,
        hasBlocks: Boolean(item.content),
      });
    });
  });

  return rows;
}

if (typeof module !== "undefined") {
  module.exports = {
    ITEM_CONTENT_STORAGE_KEY,
    loadContentOverrides,
    saveContentOverride,
    removeContentOverride,
    getContentOverride,
    applyContentOverrides,
    findSiteItem,
    getAllSiteItems,
  };
}
