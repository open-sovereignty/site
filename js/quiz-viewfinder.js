(function () {
  "use strict";

  /* ── helpers ─────────────────────────────────────────────── */

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = String(str);
    return d.innerHTML;
  }

  /* ── build category array from JSON ─────────────────────── */

  function buildCategories(data) {
    return Object.keys(data).map(function (catId) {
      var cat = data[catId];
      return {
        catId: catId,
        title: cat.title,
        questions: Object.keys(cat.questions).map(function (qId) {
          var q = cat.questions[qId];
          return { qId: qId, s: q.s, a: q.a, h: q.h, e: q.e };
        })
      };
    });
  }

  /* ── scoring ─────────────────────────────────────────────── */

  var BANDS = [
    { min: 19, label: "Sovereignty Expert",  desc: "Excellent grasp of digital sovereignty principles. You're well-placed to lead sovereign cloud decisions." },
    { min: 15, label: "Well Informed",        desc: "Strong awareness across most areas. Review the categories where you dropped points to close any gaps." },
    { min: 10, label: "Getting There",        desc: "A solid foundation with clear gaps. Use the explanations to prioritise learning and policy work." },
    { min: 0,  label: "Room to Grow",         desc: "Sovereignty concepts are complex — this quiz is a great starting point. Review each explanation and revisit the landscape." }
  ];

  function scoreBand(correct) {
    for (var i = 0; i < BANDS.length; i++) {
      if (correct >= BANDS[i].min) return BANDS[i];
    }
    return BANDS[BANDS.length - 1];
  }

  /* ── state ───────────────────────────────────────────────── */

  var categories   = [];
  var answers      = {};   // { qId: { correct: bool, given: "true"|"false" } }
  var currentCatIdx = 0;
  var container;

  /* ── DOM helpers ─────────────────────────────────────────── */

  function q(sel)   { return container.querySelector(sel); }
  function show(sel){ var el = q(sel); if (el) el.classList.remove("hidden"); }
  function hide(sel){ var el = q(sel); if (el) el.classList.add("hidden"); }

  /* ── progress ────────────────────────────────────────────── */

  function updateProgress(catIdx) {
    var total = categories.length;
    var lbl  = q("[data-progress-label]");
    var fill = q("[data-progress-fill]");
    if (lbl)  lbl.textContent = "Category " + (catIdx + 1) + " of " + total;
    if (fill) fill.style.width = Math.round((catIdx / total) * 100) + "%";
  }

  /* ── render one category ─────────────────────────────────── */

  function renderCategory(catIdx) {
    var cat   = categories[catIdx];
    var total = categories.length;

    updateProgress(catIdx);

    /* build question cards */
    var cards = cat.questions.map(function (qq, i) {
      var ans      = answers[qq.qId];
      var answered = !!ans;

      var trueDisabled  = answered ? "disabled" : "";
      var falseDisabled = answered ? "disabled" : "";
      var trueCls       = "";
      var falseCls      = "";

      if (answered) {
        if (qq.a === "true")  trueCls  = "vf-btn-correct";
        else                  trueCls  = "vf-btn-incorrect";
        if (qq.a === "false") falseCls = "vf-btn-correct";
        else                  falseCls = "vf-btn-incorrect";
      }

      var feedbackHtml = "";
      if (answered) {
        var correct = ans.correct;
        feedbackHtml =
          '<div class="vf-feedback ' + (correct ? "vf-feedback-correct" : "vf-feedback-incorrect") + '">' +
            (correct
              ? '<span class="vf-verdict vf-verdict-correct">✓ Correct</span>'
              : '<span class="vf-verdict vf-verdict-incorrect">✗ Incorrect</span>') +
            " — " + escapeHtml(qq.e) +
          "</div>";
      }

      return (
        '<div class="vf-question-card" data-qid="' + escapeHtml(qq.qId) + '">' +
          '<p class="vf-q-number">Q' + (i + 1) + "</p>" +
          '<p class="vf-statement">' + escapeHtml(qq.s) + "</p>" +
          '<div class="vf-buttons">' +
            '<button type="button" class="btn vf-btn vf-btn-true ' + trueCls + '" data-answer="true" ' + trueDisabled + '>True</button>' +
            '<button type="button" class="btn vf-btn vf-btn-false ' + falseCls + '" data-answer="false" ' + falseDisabled + '>False</button>' +
          "</div>" +
          feedbackHtml +
        "</div>"
      );
    }).join("");

    var body = q("[data-vf-body]");
    body.innerHTML =
      '<h2 class="vf-cat-heading">' +
        '<span class="vf-category-tag">' + escapeHtml(cat.catId) + "</span>" +
        escapeHtml(cat.title) +
      "</h2>" +
      '<div class="vf-questions-list">' + cards + "</div>";

    /* bind answer buttons for unanswered questions */
    cat.questions.forEach(function (qq) {
      if (answers[qq.qId]) return;
      var card = body.querySelector('[data-qid="' + qq.qId + '"]');
      if (!card) return;
      card.querySelectorAll("[data-answer]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          handleAnswer(qq, btn.getAttribute("data-answer"), card);
        });
      });
    });

    /* update nav buttons */
    var prevBtn   = q("[data-btn-prev]");
    var nextBtn   = q("[data-btn-next]");
    var submitBtn = q("[data-btn-submit]");

    if (prevBtn)   prevBtn.disabled = (catIdx === 0);

    var isLast = (catIdx === total - 1);
    if (isLast) {
      hide("[data-btn-next]");
      show("[data-btn-submit]");
      if (submitBtn) submitBtn.disabled = !allCategoryAnswered(catIdx);
    } else {
      show("[data-btn-next]");
      hide("[data-btn-submit]");
      if (nextBtn) nextBtn.disabled = !allCategoryAnswered(catIdx);
    }
  }

  /* ── check all questions in a category answered ─────────── */

  function allCategoryAnswered(catIdx) {
    return categories[catIdx].questions.every(function (qq) {
      return !!answers[qq.qId];
    });
  }

  /* ── handle a True/False answer ──────────────────────────── */

  function handleAnswer(qq, userAnswer, card) {
    var correct = userAnswer === qq.a;
    answers[qq.qId] = { correct: correct, given: userAnswer };

    /* lock and colour buttons */
    card.querySelectorAll("[data-answer]").forEach(function (btn) {
      btn.disabled = true;
      btn.classList.remove("vf-btn-correct", "vf-btn-incorrect");
      if (btn.getAttribute("data-answer") === qq.a) {
        btn.classList.add("vf-btn-correct");
      } else {
        btn.classList.add("vf-btn-incorrect");
      }
    });

    /* show inline feedback */
    var existing = card.querySelector(".vf-feedback");
    if (existing) existing.remove();
    var fb = document.createElement("div");
    fb.className = "vf-feedback " + (correct ? "vf-feedback-correct" : "vf-feedback-incorrect");
    fb.innerHTML =
      (correct
        ? '<span class="vf-verdict vf-verdict-correct">✓ Correct</span>'
        : '<span class="vf-verdict vf-verdict-incorrect">✗ Incorrect</span>') +
      " — " + escapeHtml(qq.e);
    card.appendChild(fb);

    /* enable Next / Submit once all questions in this category answered */
    if (allCategoryAnswered(currentCatIdx)) {
      var isLast = currentCatIdx === categories.length - 1;
      if (isLast) {
        var sub = q("[data-btn-submit]");
        if (sub) sub.disabled = false;
        /* nudge progress to 100% on final category completion */
        var fill = q("[data-progress-fill]");
        if (fill) fill.style.width = "100%";
      } else {
        var nxt = q("[data-btn-next]");
        if (nxt) nxt.disabled = false;
      }
    }
  }

  /* ── navigation ──────────────────────────────────────────── */

  function goNext() {
    if (currentCatIdx < categories.length - 1) {
      currentCatIdx++;
      renderCategory(currentCatIdx);
      scrollToQuiz();
    }
  }

  function goPrev() {
    if (currentCatIdx > 0) {
      currentCatIdx--;
      renderCategory(currentCatIdx);
      scrollToQuiz();
    }
  }

  function scrollToQuiz() {
    if (container) container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ── results ─────────────────────────────────────────────── */

  function showResults() {
    hide("[data-quiz-form]");
    show("[data-quiz-results]");

    var allQs = [];
    categories.forEach(function (c) { allQs = allQs.concat(c.questions); });
    var totalCorrect = allQs.filter(function (qq) { return answers[qq.qId] && answers[qq.qId].correct; }).length;
    var band = scoreBand(totalCorrect);

    var scoreEl = q("[data-results-score]");
    if (scoreEl) {
      scoreEl.innerHTML =
        '<div class="vf-overall-score">' +
          '<span class="vf-score-number">' + totalCorrect + "</span>" +
          '<span class="vf-score-denom">/ ' + allQs.length + "</span>" +
        "</div>" +
        '<div class="vf-band-label">' + escapeHtml(band.label) + "</div>" +
        '<p class="vf-band-desc">'    + escapeHtml(band.desc)  + "</p>";
    }

    var tbody = q("[data-results-tbody]");
    if (!tbody) return;

    var rows = categories.map(function (cat) {
      var correct = cat.questions.filter(function (qq) { return answers[qq.qId] && answers[qq.qId].correct; }).length;
      var total   = cat.questions.length;
      var pct     = Math.round((correct / total) * 100);
      var cls     = pct === 100 ? "vf-cat-full" : pct >= 67 ? "vf-cat-good" : "vf-cat-low";
      return (
        "<tr>" +
          "<td>" + escapeHtml(cat.title) + "</td>" +
          '<td class="' + cls + '">' + correct + " / " + total + "</td>" +
          '<td><div class="vf-mini-bar"><div class="vf-mini-fill ' + cls + '" style="width:' + pct + '%"></div></div></td>' +
        "</tr>"
      );
    }).join("");
    tbody.innerHTML = rows;
  }

  /* ── restart ─────────────────────────────────────────────── */

  function restart() {
    answers = {};
    currentCatIdx = 0;
    hide("[data-quiz-results]");
    show("[data-quiz-intro]");
  }

  /* ── start ───────────────────────────────────────────────── */

  function startQuiz() {
    answers = {};
    currentCatIdx = 0;
    hide("[data-quiz-intro]");
    show("[data-quiz-form]");
    renderCategory(0);
  }

  /* ── bind persistent controls ────────────────────────────── */

  function bindControls() {
    var btnStart   = q("[data-btn-start]");
    var btnPrev    = q("[data-btn-prev]");
    var btnNext    = q("[data-btn-next]");
    var btnSubmit  = q("[data-btn-submit]");
    var btnRestart = q("[data-btn-restart]");

    if (btnStart)   btnStart.addEventListener("click",   startQuiz);
    if (btnPrev)    btnPrev.addEventListener("click",    goPrev);
    if (btnNext)    btnNext.addEventListener("click",    goNext);
    if (btnSubmit)  btnSubmit.addEventListener("click",  showResults);
    if (btnRestart) btnRestart.addEventListener("click", restart);
  }

  /* ── public init ─────────────────────────────────────────── */

  var ViewFinderQuiz = {
    init: function (containerId, dataPath) {
      container = document.getElementById(containerId);
      if (!container) return;

      fetch(dataPath)
        .then(function (r) {
          if (!r.ok) throw new Error("Failed to load " + dataPath);
          return r.json();
        })
        .then(function (data) {
          categories = buildCategories(data);
          bindControls();
        })
        .catch(function (err) {
          container.innerHTML =
            '<p class="quiz-error" role="alert">Unable to load the quiz. Please try again later.</p>';
          console.error(err);
        });
    }
  };

  window.ViewFinderQuiz = ViewFinderQuiz;
})();
