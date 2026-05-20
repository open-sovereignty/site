/* DS Readiness Assessment engine */
(function () {
  "use strict";

  var qData;            // loaded JSON data
  var selectedProfile;  // profile object
  var answers = {};     // { questionId: "yes" | "no" | "dk" }
  var currentDomainIdx = 0;

  /* ── bootstrap ──────────────────────────────────────────────── */
  function init(dataPath) {
    fetch(dataPath)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        qData = json;
        showSection("dsr-intro");
      })
      .catch(function (e) {
        console.error("DS Readiness: failed to load data", e);
      });

    document.getElementById("dsr-start-btn").addEventListener("click", function () {
      showSection("dsr-profile");
      renderProfileCards();
    });

    document.getElementById("dsr-begin-btn").addEventListener("click", function () {
      if (!selectedProfile) {
        document.getElementById("dsr-profile-error").hidden = false;
        return;
      }
      answers = {};
      currentDomainIdx = 0;
      buildQuizForm();

      var profileNameEl = document.getElementById("dsr-active-profile-name");
      if (profileNameEl) profileNameEl.textContent = selectedProfile.label;

      showSection("dsr-quiz");
      renderDomain(0);
    });

    document.getElementById("dsr-restart-btn").addEventListener("click", restart);
  }

  /* ── section visibility ──────────────────────────────────────── */
  function showSection(id) {
    ["dsr-intro", "dsr-profile", "dsr-quiz", "dsr-results"].forEach(function (s) {
      var el = document.getElementById(s);
      if (el) el.hidden = (s !== id);
    });
  }

  /* ── profile selector ────────────────────────────────────────── */
  function renderProfileCards() {
    var grid = document.getElementById("dsr-profile-grid");
    grid.innerHTML = "";
    qData.profiles.forEach(function (p) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "dsr-profile-card";
      card.dataset.id = p.id;
      card.innerHTML =
        '<span class="dsr-profile-label">' + esc(p.label) + "</span>" +
        '<span class="dsr-profile-desc">' + esc(p.description) + "</span>";
      card.addEventListener("click", function () {
        selectProfile(p, card);
      });
      grid.appendChild(card);
    });
  }

  function selectProfile(p, cardEl) {
    selectedProfile = p;
    document.getElementById("dsr-profile-error").hidden = true;

    document.querySelectorAll(".dsr-profile-card").forEach(function (c) {
      c.classList.toggle("selected", c === cardEl);
    });

    renderWeightSummary(p);
    document.getElementById("dsr-weight-summary").hidden = false;
  }

  function renderWeightSummary(p) {
    var tbody = document.querySelector("#dsr-weight-table tbody");
    tbody.innerHTML = "";
    qData.domains.forEach(function (d) {
      var w = p.weights[d.id] || 1;
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + esc(d.title) + "</td>" +
        '<td class="dsr-weight-val">' + w.toFixed(1) + "×</td>" +
        '<td><div class="dsr-weight-bar"><div class="dsr-weight-fill" style="width:' +
        (w / 2 * 100) + '%"></div></div></td>';
      tbody.appendChild(tr);
    });
  }

  /* ── quiz form shell ─────────────────────────────────────────── */
  function buildQuizForm() {
    var form = document.getElementById("dsr-form-body");
    form.innerHTML = "";

    qData.domains.forEach(function (d, idx) {
      var sec = document.createElement("section");
      sec.id = "dsr-domain-" + idx;
      sec.className = "dsr-domain-section";
      sec.hidden = true;

      var domQs = questionsForDomain(d.id);

      sec.innerHTML =
        '<header class="dsr-domain-header">' +
          '<span class="dsr-domain-num">' + (idx + 1) + " / " + qData.domains.length + "</span>" +
          '<h2 class="dsr-domain-title">' + esc(d.title) + "</h2>" +
          '<p class="dsr-domain-desc">' + esc(d.description) + "</p>" +
        "</header>" +
        '<ol class="dsr-questions-list">' +
          domQs.map(function (q, qi) { return renderQuestionCard(q, qi + 1); }).join("") +
        "</ol>";

      form.appendChild(sec);
    });

    updateProgress(0);
  }

  function renderQuestionCard(q, num) {
    return (
      '<li class="dsr-question-card" id="dsr-card-' + q.id + '">' +
        '<div class="dsr-q-meta">' +
          '<span class="dsr-q-num">Q' + num + "</span>" +
          '<span class="dsr-domain-tag">' + esc(domainTitle(q.domainId)) + "</span>" +
        "</div>" +
        '<p class="dsr-q-text">' + esc(q.text) + "</p>" +
        '<details class="dsr-guidance">' +
          "<summary>Guidance</summary>" +
          '<p class="dsr-guidance-text">' + esc(q.explanation) + "</p>" +
        "</details>" +
        '<div class="dsr-ynd-buttons" data-qid="' + q.id + '">' +
          '<button type="button" class="dsr-btn dsr-btn-yes"  data-answer="yes">Yes</button>' +
          '<button type="button" class="dsr-btn dsr-btn-no"   data-answer="no">No</button>' +
          '<button type="button" class="dsr-btn dsr-btn-dk"   data-answer="dk">Don\'t Know</button>' +
        "</div>" +
      "</li>"
    );
  }

  /* ── domain navigation ───────────────────────────────────────── */
  function renderDomain(idx) {
    qData.domains.forEach(function (_, i) {
      var sec = document.getElementById("dsr-domain-" + i);
      if (sec) sec.hidden = (i !== idx);
    });

    currentDomainIdx = idx;
    updateProgress(idx);
    updateNavButtons(idx);
    reApplyAnswers(idx);

    attachAnswerListeners(idx);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function attachAnswerListeners(idx) {
    var sec = document.getElementById("dsr-domain-" + idx);
    if (!sec) return;
    sec.querySelectorAll(".dsr-ynd-buttons").forEach(function (btnGroup) {
      btnGroup.querySelectorAll(".dsr-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var qid = btnGroup.dataset.qid;
          var answer = btn.dataset.answer;
          recordAnswer(qid, answer, btnGroup);
          checkDomainCompletion(idx);
        });
      });
    });
  }

  function recordAnswer(qid, answer, btnGroup) {
    answers[qid] = answer;

    btnGroup.querySelectorAll(".dsr-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.answer === answer);
    });

    var card = document.getElementById("dsr-card-" + qid);
    if (card) {
      card.classList.remove("answered-yes", "answered-no", "answered-dk");
      card.classList.add("answered-" + answer);
    }
  }

  function reApplyAnswers(idx) {
    var domQs = questionsForDomain(qData.domains[idx].id);
    domQs.forEach(function (q) {
      if (answers[q.id]) {
        var btnGroup = document.querySelector('.dsr-ynd-buttons[data-qid="' + q.id + '"]');
        if (btnGroup) recordAnswer(q.id, answers[q.id], btnGroup);
      }
    });
  }

  function checkDomainCompletion(idx) {
    var domQs = questionsForDomain(qData.domains[idx].id);
    var allAnswered = domQs.every(function (q) { return answers[q.id]; });
    var nextBtn = document.getElementById("dsr-next-btn");
    var submitBtn = document.getElementById("dsr-submit-btn");

    if (allAnswered) {
      var isLast = (idx === qData.domains.length - 1);
      if (nextBtn) nextBtn.disabled = isLast;
      if (submitBtn) {
        submitBtn.hidden = !isLast;
        submitBtn.disabled = false;
      }
    }
  }

  function updateNavButtons(idx) {
    var prevBtn = document.getElementById("dsr-prev-btn");
    var nextBtn = document.getElementById("dsr-next-btn");
    var submitBtn = document.getElementById("dsr-submit-btn");

    if (prevBtn) prevBtn.disabled = (idx === 0);
    if (nextBtn) {
      nextBtn.hidden = (idx === qData.domains.length - 1);
      nextBtn.disabled = !domainFullyAnswered(idx);
    }
    if (submitBtn) {
      submitBtn.hidden = (idx !== qData.domains.length - 1);
      submitBtn.disabled = !domainFullyAnswered(idx);
    }
  }

  function domainFullyAnswered(idx) {
    var domQs = questionsForDomain(qData.domains[idx].id);
    return domQs.every(function (q) { return answers[q.id]; });
  }

  function updateProgress(idx) {
    var total = qData.domains.length;
    var pct = Math.round((idx / total) * 100);
    var bar = document.getElementById("dsr-progress-fill");
    var label = document.getElementById("dsr-progress-label");
    if (bar) bar.style.width = pct + "%";
    if (label) label.textContent = "Domain " + (idx + 1) + " of " + total;
  }

  /* ── scoring ─────────────────────────────────────────────────── */
  function computeResults() {
    var domainScores = {};
    var weightedSum = 0;
    var maxWeightedSum = 0;

    qData.domains.forEach(function (d) {
      var qs = questionsForDomain(d.id);
      var yesCount = qs.filter(function (q) { return answers[q.id] === "yes"; }).length;
      var noCount  = qs.filter(function (q) { return answers[q.id] === "no"; }).length;
      var dkCount  = qs.filter(function (q) { return answers[q.id] === "dk"; }).length;
      var domainPct = (yesCount / qs.length) * 100;
      var weight = selectedProfile.weights[d.id] || 1;

      domainScores[d.id] = {
        title: d.title,
        yes: yesCount,
        no: noCount,
        dk: dkCount,
        total: qs.length,
        pct: domainPct,
        weight: weight
      };

      weightedSum    += (yesCount / qs.length) * weight;
      maxWeightedSum += weight;
    });

    var overallPct   = (weightedSum / maxWeightedSum) * 100;
    var normalPts    = (overallPct / 100) * (qData.questions.length);
    var maturityLevel = getMaturityLevel(overallPct);

    return { domainScores: domainScores, overallPct: overallPct, normalPts: normalPts, maturityLevel: maturityLevel };
  }

  function getMaturityLevel(pct) {
    var levels = qData.maturityLevels;
    for (var i = levels.length - 1; i >= 0; i--) {
      if (pct >= levels[i].min) return levels[i];
    }
    return levels[0];
  }

  /* ── results ─────────────────────────────────────────────────── */
  function showResults() {
    var results = computeResults();
    var el = document.getElementById("dsr-results");

    el.querySelector(".dsr-maturity-badge").className =
      "dsr-maturity-badge dsr-level-" + results.maturityLevel.level;
    el.querySelector(".dsr-maturity-name").textContent = results.maturityLevel.name;
    el.querySelector(".dsr-maturity-level-num").textContent = "Level " + results.maturityLevel.level;
    el.querySelector(".dsr-maturity-desc").textContent = results.maturityLevel.description;
    el.querySelector(".dsr-overall-pct").textContent = Math.round(results.overallPct) + "%";
    el.querySelector(".dsr-overall-pts").textContent =
      results.normalPts.toFixed(1) + " / " + qData.questions.length + " pts";
    el.querySelector(".dsr-profile-used").textContent = selectedProfile.label;

    var overallBar = el.querySelector(".dsr-overall-fill");
    if (overallBar) overallBar.style.width = Math.round(results.overallPct) + "%";

    renderDomainTable(results.domainScores);
    renderImprovementActions(results.maturityLevel);
    renderResearchItems();

    var dateEl = el.querySelector(".dsr-report-date");
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    showSection("dsr-results");
  }

  function renderDomainTable(domainScores) {
    var tbody = document.querySelector("#dsr-domain-table tbody");
    tbody.innerHTML = "";

    qData.domains.forEach(function (d) {
      var s = domainScores[d.id];
      var tr = document.createElement("tr");
      var barFill = Math.round(s.pct);
      var statusClass = s.pct >= 67 ? "dsr-status-good" : s.pct >= 34 ? "dsr-status-mid" : "dsr-status-low";

      tr.innerHTML =
        "<td><strong>" + esc(s.title) + "</strong></td>" +
        '<td class="dsr-score-cell">' +
          '<div class="dsr-mini-bar"><div class="dsr-mini-fill ' + statusClass + '" style="width:' + barFill + '%"></div></div>' +
          '<span class="dsr-score-label">' + s.yes + "/" + s.total + " Yes</span>" +
        "</td>" +
        '<td class="dsr-weight-cell">' + s.weight.toFixed(1) + "×</td>" +
        '<td class="dsr-dk-cell">' + (s.dk > 0 ? s.dk + " DK" : "—") + "</td>";
      tbody.appendChild(tr);
    });
  }

  function renderImprovementActions(level) {
    var container = document.getElementById("dsr-actions-body");
    container.innerHTML =
      '<p class="dsr-actions-intro">At the <strong>' + esc(level.name) + '</strong> maturity level, the following actions are recommended:</p>' +
      '<ul class="dsr-actions-list">' +
        level.actions.map(function (a) {
          return '<li><strong>' + esc(a.title) + ":</strong> " + esc(a.detail) + "</li>";
        }).join("") +
      "</ul>" +
      '<div class="dsr-focus-areas"><strong>Key Focus Areas:</strong>' +
        '<ul>' + level.focusAreas.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" +
      "</div>";
  }

  function renderResearchItems() {
    var container = document.getElementById("dsr-research-body");
    var dkItems = qData.questions.filter(function (q) { return answers[q.id] === "dk"; });

    if (dkItems.length === 0) {
      container.innerHTML = '<p class="dsr-no-dk">No \'Don\'t Know\' answers recorded — well done for full coverage!</p>';
      return;
    }

    container.innerHTML =
      '<p class="dsr-research-intro">You answered \'Don\'t Know\' to ' + dkItems.length + ' question' + (dkItems.length > 1 ? "s" : "") + '. These are the areas to research next:</p>' +
      '<ul class="dsr-research-list">' +
        dkItems.map(function (q) {
          return (
            '<li class="dsr-research-item">' +
              '<p class="dsr-research-q">' + esc(q.text) + "</p>" +
              '<p class="dsr-research-why">' + esc(q.explanation) + "</p>" +
            "</li>"
          );
        }).join("") +
      "</ul>";
  }

  /* ── restart ─────────────────────────────────────────────────── */
  function restart() {
    answers = {};
    selectedProfile = null;
    currentDomainIdx = 0;

    document.querySelectorAll(".dsr-profile-card").forEach(function (c) {
      c.classList.remove("selected");
    });
    document.getElementById("dsr-weight-summary").hidden = true;
    document.getElementById("dsr-profile-error").hidden = true;

    showSection("dsr-intro");
  }

  /* ── helpers ─────────────────────────────────────────────────── */
  function questionsForDomain(domainId) {
    return qData.questions.filter(function (q) { return q.domainId === domainId; });
  }

  function domainTitle(domainId) {
    var d = qData.domains.find(function (x) { return x.id === domainId; });
    return d ? d.title : domainId;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── public API ──────────────────────────────────────────────── */
  window.DSReadiness = { init: init };

  /* ── wire nav buttons after DOM ready ───────────────────────── */
  document.addEventListener("DOMContentLoaded", function () {
    var prevBtn = document.getElementById("dsr-prev-btn");
    var nextBtn = document.getElementById("dsr-next-btn");
    var submitBtn = document.getElementById("dsr-submit-btn");

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        if (currentDomainIdx > 0) renderDomain(currentDomainIdx - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        if (currentDomainIdx < qData.domains.length - 1) renderDomain(currentDomainIdx + 1);
      });
    }
    if (submitBtn) {
      submitBtn.addEventListener("click", showResults);
    }
  });
})();
