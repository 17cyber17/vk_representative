const feed = document.getElementById("feed");
const loadMoreButton = document.getElementById("load-more");

let offset = 0;
const limit = 10;
let loading = false;

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
  text.textContent = post.text || "(нет текста)";

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

loadMoreButton.addEventListener("click", loadPosts);

loadPosts();
