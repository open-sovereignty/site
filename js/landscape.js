(function () {
  "use strict";

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function initials(name) {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) {
        return w.charAt(0);
      })
      .join("")
      .toUpperCase();
  }

  function hashHue(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) {
      h = (h << 5) - h + name.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h) % 360;
  }

  function renderTile(item) {
    var hue = hashHue(item.name);
    var inits = escapeHtml(initials(item.name));
    var searchText = (item.name + " " + (item.summary || "") + " " + (item.tags || []).join(" ")).toLowerCase();
    var logoHtml;
    if (item.logo) {
      logoHtml =
        '<span class="landscape-tile-logo landscape-tile-logo--img" style="--tile-hue:' +
        hue +
        '" data-initials="' +
        inits +
        '">' +
        '<img src="assets/logos/' +
        escapeHtml(item.logo) +
        '" alt="" loading="lazy" class="landscape-tile-img" />' +
        "</span>";
    } else {
      logoHtml =
        '<span class="landscape-tile-logo" style="--tile-hue:' + hue + '">' +
        inits +
        "</span>";
    }
    return (
      '<a class="landscape-tile" href="' +
      escapeHtml(item.url) +
      '" target="_blank" rel="noopener noreferrer" title="' +
      escapeHtml(item.summary || item.name) +
      '" data-search="' +
      escapeHtml(searchText) +
      '">' +
      logoHtml +
      '<span class="landscape-tile-name">' +
      escapeHtml(item.name) +
      "</span>" +
      "</a>"
    );
  }

  function renderCategory(cat) {
    var tiles = cat.items.map(renderTile).join("");
    return (
      '<section class="landscape-category" id="' +
      escapeHtml(cat.id) +
      '" data-category="' +
      escapeHtml(cat.id) +
      '">' +
      '<div class="landscape-category-label">' +
      '<span class="landscape-category-id">' +
      escapeHtml(cat.id) +
      "</span>" +
      "<h2>" +
      escapeHtml(cat.title) +
      "</h2>" +
      "<p>" +
      escapeHtml(cat.description) +
      "</p>" +
      "</div>" +
      '<div class="landscape-tiles">' +
      tiles +
      "</div>" +
      "</section>"
    );
  }

  function renderJumpNav(categories) {
    return categories
      .map(function (cat) {
        return (
          '<a class="landscape-jump-link" href="#' +
          escapeHtml(cat.id) +
          '">' +
          escapeHtml(cat.id) +
          "</a>"
        );
      })
      .join("");
  }

  function applyFilter(query) {
    var q = query.trim().toLowerCase();
    var categories = document.querySelectorAll(".landscape-category");
    categories.forEach(function (section) {
      var visible = 0;
      section.querySelectorAll(".landscape-tile").forEach(function (tile) {
        var match = !q || (tile.getAttribute("data-search") || "").indexOf(q) !== -1;
        tile.classList.toggle("hidden", !match);
        if (match) visible++;
      });
      section.classList.toggle("hidden", visible === 0);
    });
    var empty = document.getElementById("landscape-empty");
    if (empty) {
      var anyVisible = document.querySelector(".landscape-category:not(.hidden)");
      empty.classList.toggle("hidden", !q || anyVisible);
    }
  }

  function init() {
    var root = document.getElementById("landscape-root");
    if (!root) return;

    fetch("data/sovereignty-landscape.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load landscape data");
        return res.json();
      })
      .then(function (data) {
        var jump = document.getElementById("landscape-jump");
        if (jump) {
          jump.innerHTML = renderJumpNav(data.categories);
        }

        root.innerHTML = data.categories.map(renderCategory).join("");

        // Swap broken images to their initials fallback (error doesn't bubble so use capture)
        root.addEventListener("error", function (e) {
          var img = e.target;
          if (img.tagName !== "IMG" || !img.classList.contains("landscape-tile-img")) return;
          var logo = img.parentElement;
          if (logo && logo.classList.contains("landscape-tile-logo")) {
            logo.classList.remove("landscape-tile-logo--img");
            logo.innerHTML = logo.getAttribute("data-initials") || "";
          }
        }, true);

        var frameworkLink = document.getElementById("landscape-framework-link");
        if (frameworkLink && data.framework) {
          frameworkLink.href = data.framework.sourceUrl;
          frameworkLink.textContent = data.framework.name + " v" + data.framework.version;
        }

        var search = document.getElementById("landscape-search");
        if (search) {
          search.addEventListener("input", function () {
            applyFilter(search.value);
          });
        }
      })
      .catch(function (err) {
        root.innerHTML =
          '<p class="landscape-error" role="alert">Unable to load the technology landscape. Please try again later.</p>';
        console.error(err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
