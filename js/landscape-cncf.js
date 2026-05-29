(function () {
  "use strict";

  var CNCF_LOGO_CDN = "https://landscape.cncf.io/";
  var popoverEl = null;
  var popoverTimer = null;

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
      .map(function (w) { return w.charAt(0); })
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

  function formatStars(n) {
    if (!n) return "";
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
    return String(n);
  }

  function maturityClass(m) {
    if (m === "graduated") return "landscape-maturity--graduated";
    if (m === "incubating") return "landscape-maturity--incubating";
    return "landscape-maturity--sandbox";
  }

  function logoSrc(item) {
    if (!item.logo) return "";
    return CNCF_LOGO_CDN + item.logo;
  }

  /* Sort items so projects sharing a redhatProduct are adjacent,
     with RH-supported items first, preserving original order within groups. */
  function presortItems(items) {
    var groups = {};
    var productOrder = [];
    var noProduct = [];

    items.forEach(function (item, idx) {
      item._origIdx = idx;
      if (item.redhatSupported && item.redhatProduct) {
        var prod = item.redhatProduct;
        if (!groups[prod]) { groups[prod] = []; productOrder.push(prod); }
        groups[prod].push(item);
      } else {
        noProduct.push(item);
      }
    });

    var sorted = [];
    productOrder.forEach(function (prod) {
      groups[prod].forEach(function (item) { sorted.push(item); });
    });
    noProduct.forEach(function (item) { sorted.push(item); });
    return sorted;
  }

  function renderTile(item) {
    var hue = hashHue(item.name);
    var inits = escapeHtml(initials(item.name));
    var searchText = (item.name + " " + (item.summary || "") + " " + (item.tags || []).join(" ") + " " + (item.redhatProduct || "")).toLowerCase();
    var src = logoSrc(item);
    var logoHtml;

    if (src) {
      logoHtml =
        '<span class="landscape-tile-logo landscape-tile-logo--img" style="--tile-hue:' +
        hue + '" data-initials="' + inits + '">' +
        '<img src="' + escapeHtml(src) + '" alt="" loading="lazy" class="landscape-tile-img" />' +
        "</span>";
    } else {
      logoHtml =
        '<span class="landscape-tile-logo" style="--tile-hue:' + hue + '">' +
        inits + "</span>";
    }

    var rhClass = (item.redhatSupported && item.redhatProduct) ? "" : " landscape-tile--no-rh";
    var rhAttr = item.redhatSupported ? ' data-rh-supported="true"' : '';

    return (
      '<a class="landscape-tile' + rhClass + '" href="' + escapeHtml(item.url) +
      '" target="_blank" rel="noopener noreferrer" title="' +
      escapeHtml(item.summary || item.name) +
      '" data-search="' + escapeHtml(searchText) + '"' +
      rhAttr +
      ' data-popover-name="' + escapeHtml(item.name) + '"' +
      ' data-popover-summary="' + escapeHtml(item.summary || "") + '"' +
      ' data-popover-logo="' + escapeHtml(src) + '"' +
      ' data-popover-stars="' + (item.stars || "") + '"' +
      ' data-popover-maturity="' + escapeHtml(item.maturity || "") + '"' +
      ' data-popover-homepage="' + escapeHtml(item.url || "") + '"' +
      ' data-popover-github="' + escapeHtml(item.github || "") + '"' +
      ' data-popover-rhproduct="' + escapeHtml(item.redhatProduct || "") + '"' +
      '>' +
      logoHtml +
      '<span class="landscape-tile-name">' + escapeHtml(item.name) + "</span>" +
      "</a>"
    );
  }

  /* Hybrid render: RH items grouped in product boxes, non-RH items as loose tiles.
     Used on the unified sovereignty-landscape page. */
  function renderHybridCategory(cat) {
    var sorted = presortItems(cat.items);
    var rhCount = 0;
    var totalCount = sorted.length;

    var groups = {};
    var productOrder = [];
    var looseTiles = [];

    sorted.forEach(function (item) {
      if (item.redhatSupported && item.redhatProduct) {
        rhCount++;
        var prod = item.redhatProduct;
        if (!groups[prod]) { groups[prod] = []; productOrder.push(prod); }
        groups[prod].push(item);
      } else {
        looseTiles.push(item);
      }
    });

    var groupsHtml = productOrder.map(function (prod) {
      var tiles = groups[prod].map(renderTile).join("");
      return (
        '<div class="rh-product-group">' +
        '<div class="rh-product-name">' + escapeHtml(prod) + '</div>' +
        '<div class="rh-product-tiles">' + tiles + '</div>' +
        '</div>'
      );
    }).join("");

    var looseHtml = looseTiles.map(renderTile).join("");

    return (
      '<section class="landscape-category" id="' + escapeHtml(cat.id) +
      '" data-category="' + escapeHtml(cat.id) + '">' +
      '<div class="landscape-category-label">' +
      '<span class="landscape-category-id">' + escapeHtml(cat.id) + "</span>" +
      "<h2>" + escapeHtml(cat.title) + "</h2>" +
      "</div>" +
      '<div class="landscape-tiles rh-hybrid-layout">' + groupsHtml + looseHtml + '</div>' +
      "</section>"
    );
  }

  function renderRhCategory(cat) {
    var rhItems = cat.items.filter(function (i) { return i.redhatSupported && i.redhatProduct; });
    if (rhItems.length === 0) return "";

    var groups = {};
    var order = [];
    rhItems.forEach(function (item) {
      var prod = item.redhatProduct;
      if (!groups[prod]) { groups[prod] = []; order.push(prod); }
      groups[prod].push(item);
    });

    var groupsHtml = order.map(function (prod) {
      var tiles = groups[prod].map(renderTile).join("");
      return (
        '<div class="rh-product-group">' +
        '<div class="rh-product-name">' + escapeHtml(prod) + '</div>' +
        '<div class="rh-product-tiles">' + tiles + '</div>' +
        '</div>'
      );
    }).join("");

    return (
      '<section class="landscape-category" id="' + escapeHtml(cat.id) +
      '" data-category="' + escapeHtml(cat.id) + '">' +
      '<div class="landscape-category-label">' +
      '<span class="landscape-category-id">' + escapeHtml(cat.id) + "</span>" +
      "<h2>" + escapeHtml(cat.title) + "</h2>" +
      "</div>" +
      '<div class="landscape-tiles rh-product-layout">' + groupsHtml + '</div>' +
      "</section>"
    );
  }

  function renderJumpNav(categories) {
    return categories
      .map(function (cat) {
        return (
          '<a class="landscape-jump-link" href="#' + escapeHtml(cat.id) + '">' +
          escapeHtml(cat.id) + "</a>"
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
      var productGroups = section.querySelectorAll(".rh-product-group");
      productGroups.forEach(function (group) {
        var anyVisible = group.querySelector(".landscape-tile:not(.hidden)");
        group.classList.toggle("hidden", !anyVisible);
      });
      section.classList.toggle("hidden", visible === 0);
    });
    var empty = document.getElementById("landscape-empty");
    if (empty) {
      var anyVisible = document.querySelector(".landscape-category:not(.hidden)");
      empty.classList.toggle("hidden", !q || anyVisible);
    }
  }

  /* ── Popover ─────────────────────────────────────────────── */

  function ensurePopover() {
    if (popoverEl) return popoverEl;
    popoverEl = document.createElement("div");
    popoverEl.className = "landscape-popover";
    popoverEl.setAttribute("role", "tooltip");
    document.body.appendChild(popoverEl);
    popoverEl.addEventListener("mouseenter", function () { clearTimeout(popoverTimer); });
    popoverEl.addEventListener("mouseleave", function () { hidePopover(); });
    return popoverEl;
  }

  function showPopover(tile) {
    clearTimeout(popoverTimer);
    var el = ensurePopover();

    var name = tile.getAttribute("data-popover-name") || "";
    var summary = tile.getAttribute("data-popover-summary") || "";
    var logo = tile.getAttribute("data-popover-logo") || "";
    var stars = tile.getAttribute("data-popover-stars") || "";
    var maturity = tile.getAttribute("data-popover-maturity") || "";
    var homepage = tile.getAttribute("data-popover-homepage") || "";
    var github = tile.getAttribute("data-popover-github") || "";
    var rhproduct = tile.getAttribute("data-popover-rhproduct") || "";

    var logoImg = logo
      ? '<img class="landscape-popover-logo" src="' + escapeHtml(logo) + '" alt="" />'
      : '';

    var linksHtml = "";
    if (homepage) {
      linksHtml += '<a class="landscape-popover-link" href="' + escapeHtml(homepage) +
        '" target="_blank" rel="noopener noreferrer" title="Homepage">&#x1f310;</a>';
    }
    if (github) {
      linksHtml += '<a class="landscape-popover-link" href="' + escapeHtml(github) +
        '" target="_blank" rel="noopener noreferrer" title="GitHub">&#x2731;</a>';
    }

    var starsHtml = stars
      ? '<span class="landscape-popover-stars">\u2605 ' + escapeHtml(formatStars(Number(stars))) + '</span>'
      : '';

    var maturityHtml = maturity
      ? '<span class="landscape-maturity ' + maturityClass(maturity) + '">' + escapeHtml(maturity) + '</span>'
      : '';

    el.innerHTML =
      '<div class="landscape-popover-header">' +
        logoImg +
        '<div>' +
          '<div class="landscape-popover-title">' + escapeHtml(name) + '</div>' +
          (linksHtml ? '<div class="landscape-popover-links">' + linksHtml + '</div>' : '') +
        '</div>' +
      '</div>' +
      (summary ? '<p class="landscape-popover-desc">' + escapeHtml(summary) + '</p>' : '') +
      '<div class="landscape-popover-meta">' + starsHtml + maturityHtml + '</div>' +
      (rhproduct ? '<div class="landscape-popover-rhproduct">\u{1F3E9} ' + escapeHtml(rhproduct) + '</div>' : '');

    var rect = tile.getBoundingClientRect();
    var popW = 352;
    var left = rect.left + rect.width / 2 - popW / 2;
    if (left < 8) left = 8;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;

    var top = rect.bottom + 8;
    if (top + 220 > window.innerHeight) {
      top = rect.top - 8;
      el.style.transform = "translateY(-100%)";
    } else {
      el.style.transform = "";
    }

    el.style.left = left + "px";
    el.style.top = top + "px";
    el.classList.add("visible");
  }

  function hidePopover() {
    popoverTimer = setTimeout(function () {
      if (popoverEl) popoverEl.classList.remove("visible");
    }, 120);
  }

  function setupPopoverListeners(root) {
    root.addEventListener("mouseenter", function (e) {
      var tile = e.target.closest(".landscape-tile");
      if (tile) showPopover(tile);
    }, true);

    root.addEventListener("mouseleave", function (e) {
      var tile = e.target.closest(".landscape-tile");
      if (tile) hidePopover();
    }, true);
  }

  /* ── Red Hat toggle ──────────────────────────────────────── */

  function setupRhToggle(root, data) {
    var toggle = document.getElementById("rh-filter-toggle");
    var legend = document.getElementById("rh-legend");
    if (!toggle) return;

    function setRhHighlight(active) {
      root.classList.toggle("rh-highlight", active);
      if (legend) legend.classList.toggle("hidden", !active);

      var url = new URL(window.location);
      if (active) {
        url.searchParams.set("rh", "1");
      } else {
        url.searchParams.delete("rh");
      }
      history.replaceState(null, "", url);
    }

    toggle.addEventListener("change", function () {
      setRhHighlight(toggle.checked);
    });

    if (new URLSearchParams(window.location.search).get("rh") === "1") {
      toggle.checked = true;
      setRhHighlight(true);
    }
  }

  /* ── Init ────────────────────────────────────────────────── */

  function init() {
    var root = document.getElementById("landscape-root");
    if (!root) return;

    var isRhOnly = root.dataset.rhOnly === "true";
    var isHybrid = root.dataset.rhHybrid === "true";

    var rhFromUrl = new URLSearchParams(window.location.search).get("rh") === "1";
    var toggle = document.getElementById("rh-filter-toggle");
    var legend = document.getElementById("rh-legend");
    if (rhFromUrl && toggle) {
      toggle.checked = true;
      root.classList.add("rh-highlight");
      if (legend) legend.classList.remove("hidden");
    }

    fetch("data/cncf-sovereignty-landscape.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load landscape data");
        return res.json();
      })
      .then(function (data) {
        var jump = document.getElementById("landscape-jump");
        if (jump) {
          jump.innerHTML = renderJumpNav(data.categories);
        }

        if (isRhOnly) {
          root.innerHTML = data.categories
            .map(renderRhCategory)
            .filter(function (html) { return html !== ""; })
            .join("");
        } else if (isHybrid) {
          root.innerHTML = data.categories.map(renderHybridCategory).join("");
        } else {
          root.innerHTML = data.categories.map(renderHybridCategory).join("");
        }

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
          frameworkLink.textContent = data.framework.name;
        }

        var search = document.getElementById("landscape-search");
        if (search) {
          search.addEventListener("input", function () {
            applyFilter(search.value);
          });
        }

        if (!isRhOnly) {
          setupRhToggle(root, data);
        }

        setupPopoverListeners(root);
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
