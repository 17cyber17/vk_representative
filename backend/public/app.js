const feed = document.getElementById("feed");
const loadMoreButton = document.getElementById("load-more");
const syncButton = document.getElementById("sync-button");
const clearButton = document.getElementById("clear-button");
const syncLimitInput = document.getElementById("sync-limit");
const syncOffsetInput = document.getElementById("sync-offset");
const syncKeyInput = document.getElementById("sync-key");
const syncStatus = document.getElementById("sync-status");

let offset = 0;
const limit = 10;
let loading = false;
let syncing = false;
let clearing = false;

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function setSyncStatus(message, isError = false) {
  if (!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.classList.toggle("is-error", isError);
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function renderPost(post) {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("h2");
  title.textContent = formatDate(post.date_iso);

  if (post.repost_source_name) {
    const repost = document.createElement("div");
    repost.className = "repost";

    const label = document.createElement("span");
    label.className = "repost-label";
    label.textContent = "Репост из";

    const source = document.createElement("span");
    source.className = "repost-source";
    source.textContent = post.repost_source_name;

    repost.appendChild(label);
    repost.appendChild(source);
    card.appendChild(repost);
  }

  const text = document.createElement("p");
  text.textContent = post.text || "";

  card.appendChild(title);
  card.appendChild(text);

  if (post.images && post.images.length) {
    const gallery = document.createElement("div");
    gallery.className = "gallery";

    post.images.forEach((image) => {
      const img = document.createElement("img");
      img.src = image.url;
      img.alt = "Изображение поста";
      gallery.appendChild(img);
    });

    card.appendChild(gallery);
  }

  feed.appendChild(card);
}

async function loadPosts() {
  if (loading) return;
  loading = true;
  loadMoreButton.disabled = true;

  const response = await fetch(`/api/posts?limit=${limit}&offset=${offset}`);
  const data = await response.json();

  data.posts.forEach(renderPost);
  offset += data.posts.length;

  if (data.posts.length < limit) {
    loadMoreButton.textContent = "Больше постов нет";
    loadMoreButton.disabled = true;
  } else {
    loadMoreButton.disabled = false;
  }

  loading = false;
}

async function runSync() {
  if (syncing) return;
  const apiKey = syncKeyInput ? syncKeyInput.value.trim() : "";
  if (!apiKey) {
    setSyncStatus("Нужен API ключ для синхронизации.", true);
    return;
  }

  const limitValue = normalizeNumber(syncLimitInput ? syncLimitInput.value : null);
  const offsetValue = normalizeNumber(syncOffsetInput ? syncOffsetInput.value : null);

  const payload = {};
  if (limitValue && limitValue > 0) payload.limit = Math.floor(limitValue);
  if (offsetValue !== null && offsetValue >= 0) payload.offset = Math.floor(offsetValue);

  syncing = true;
  syncButton.disabled = true;
  if (clearButton) clearButton.disabled = true;
  setSyncStatus("Синхронизация...", false);

  try {
    const response = await fetch("/admin/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data && data.error ? data.error : "Ошибка синхронизации");
    }

    const result = data.result || {};
    setSyncStatus(
      `Готово: создано ${result.created || 0}, обновлено ${result.updated || 0}, получено ${result.fetched || 0}.`,
      false
    );

    offset = 0;
    feed.innerHTML = "";
    loadMoreButton.textContent = "Загрузить ещё";
    loadMoreButton.disabled = false;
    await loadPosts();
  } catch (error) {
    setSyncStatus(error.message || "Ошибка синхронизации", true);
  } finally {
    syncing = false;
    syncButton.disabled = false;
    if (clearButton) clearButton.disabled = false;
  }
}

async function clearDatabase() {
  if (clearing) return;
  const apiKey = syncKeyInput ? syncKeyInput.value.trim() : "";
  if (!apiKey) {
    setSyncStatus("Нужен API ключ для очистки.", true);
    return;
  }

  const confirmed = window.confirm("Очистить базу данных постов?");
  if (!confirmed) return;

  clearing = true;
  clearButton.disabled = true;
  if (syncButton) syncButton.disabled = true;
  setSyncStatus("Очистка базы...", false);

  try {
    const response = await fetch("/admin/clear", {
      method: "POST",
      headers: {
        "x-api-key": apiKey
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data && data.error ? data.error : "Ошибка очистки");
    }

    offset = 0;
    feed.innerHTML = "";
    loadMoreButton.textContent = "Загрузить ещё";
    loadMoreButton.disabled = false;
    setSyncStatus("База очищена.", false);
  } catch (error) {
    setSyncStatus(error.message || "Ошибка очистки", true);
  } finally {
    clearing = false;
    clearButton.disabled = false;
    if (syncButton) syncButton.disabled = false;
  }
}

loadMoreButton.addEventListener("click", loadPosts);
if (syncButton) {
  syncButton.addEventListener("click", runSync);
}
if (clearButton) {
  clearButton.addEventListener("click", clearDatabase);
}

loadPosts();
