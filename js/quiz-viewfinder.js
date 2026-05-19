(function () {
  "use strict";

  /* ── helpers ─────────────────────────────────────────────── */

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = String(str);
    return d.innerHTML;
  }

  /* ── flatten JSON into ordered question array ─────────────── */

  function buildQuestions(data) {
    var flat = [];
    Object.keys(data).forEach(function (catId) {
      var cat = data[catId];
      Object.keys(cat.questions).forEach(function (qId) {
        var q = cat.questions[qId];
        flat.push({
          catId:    catId,
          catTitle: cat.title,
          qId:      qId,
          s:        q.s,
          a:        q.a,   // "true" | "false"
          h:        q.h,
          e:        q.e
        });
      });
    });
    return flat;
  }

  /* ── scoring helpers ─────────────────────────────────────── */

  var BANDS = [
    { min: 19, label: "Sovereignty Expert",  desc: "Excellent grasp of digital sovereignty principles. You're well-placed to lead sovereign cloud decisions." },
    { min: 15, label: "Well Informed",       desc: "Strong awareness across most areas. A few blind spots to investigate — focus on the categories where you dropped points." },
    { min: 10, label: "Getting There",       desc: "A solid foundation with clear gaps. Use the explanations above to prioritise learning and policy work." },
    { min: 0,  label: "Room to Grow",        desc: "Sovereignty concepts are complex — this quiz is a great starting point. Review each explanation and revisit the landscape." }
  ];

  function scoreBand(correct) {
    for (var i = 0; i < BANDS.length; i++) {
      if (correct >= BANDS[i].min) return BANDS[i];
    }
    return BANDS[BANDS.length - 1];
  }

  /* ── state ───────────────────────────────────────────────── */

  var questions  = [];
  var answers    = [];   // { qId, catId, correct }
  var currentIdx = 0;
  var container;

  /* ── section toggles ─────────────────────────────────────── */

  function show(selector) {
    var el = container.querySelector(selector);
    if (el) el.classList.remove("hidden");
  }

  function hide(selector) {
    var el = container.querySelector(selector);
    if (el) el.classList.add("hidden");
  }

  function q(selector) {
    return container.querySelector(selector);
  }

  /* ── intro ───────────────────────────────────────────────── */

  function bindIntro() {
    var btn = q("[data-btn-start]");
    if (btn) btn.addEventListener("click", startQuiz);
  }

  /* ── quiz flow ───────────────────────────────────────────── */

  function startQuiz() {
    answers    = [];
    currentIdx = 0;
    hide("[data-quiz-intro]");
    show("[data-quiz-form]");
    renderQuestion();
  }

  function renderQuestion() {
    var qq    = questions[currentIdx];
    var total = questions.length;

    /* progress bar */
    var labelEl = q("[data-progress-label]");
    var fillEl  = q("[data-progress-fill]");
    if (labelEl) labelEl.textContent = "Question " + (currentIdx + 1) + " of " + total;
    if (fillEl)  fillEl.style.width  = Math.round((currentIdx / total) * 100) + "%";

    /* question body */
    var body = q("[data-vf-body]");
    if (!body) return;

    body.innerHTML =
      '<p class="vf-category-tag">' + escapeHtml(qq.catTitle) + "</p>" +
      '<p class="vf-statement">'    + escapeHtml(qq.s)         + "</p>" +
      '<div class="vf-buttons">'    +
        '<button type="button" class="btn vf-btn vf-btn-true"  data-answer="true">True</button>'  +
        '<button type="button" class="btn vf-btn vf-btn-false" data-answer="false">False</button>' +
      "</div>" +
      '<div class="vf-feedback hidden" data-vf-feedback></div>';

    /* next / submit hidden until answered */
    hide("[data-btn-next]");
    hide("[data-btn-submit]");

    body.querySelectorAll("[data-answer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handleAnswer(btn.getAttribute("data-answer"), qq, body);
      });
    });
  }

  function handleAnswer(userAnswer, qq, body) {
    var correct = userAnswer === qq.a;
    answers.push({ catId: qq.catId, qId: qq.qId, correct: correct });

    /* lock buttons and highlight */
    body.querySelectorAll("[data-answer]").forEach(function (btn) {
      btn.disabled = true;
      if (btn.getAttribute("data-answer") === qq.a) {
        btn.classList.add("vf-btn-correct");
      } else {
        btn.classList.add("vf-btn-incorrect");
      }
    });

    /* feedback */
    var fb = body.querySelector("[data-vf-feedback]");
    fb.classList.remove("hidden");
    fb.className = "vf-feedback " + (correct ? "vf-feedback-correct" : "vf-feedback-incorrect");
    fb.innerHTML =
      (correct
        ? '<span class="vf-verdict vf-verdict-correct">✓ Correct</span>'
        : '<span class="vf-verdict vf-verdict-incorrect">✗ Incorrect</span>') +
      " — " +
      escapeHtml(qq.e);

    /* show appropriate next control */
    if (currentIdx + 1 < questions.length) {
      show("[data-btn-next]");
    } else {
      show("[data-btn-submit]");
      var fill = q("[data-progress-fill]");
      if (fill) fill.style.width = "100%";
      var lbl = q("[data-progress-label]");
      if (lbl) lbl.textContent = "Question " + questions.length + " of " + questions.length;
    }
  }

  function nextQuestion() {
    currentIdx++;
    renderQuestion();
  }

  /* ── results ─────────────────────────────────────────────── */

  function showResults() {
    hide("[data-quiz-form]");
    show("[data-quiz-results]");

    var totalCorrect = answers.filter(function (a) { return a.correct; }).length;
    var band = scoreBand(totalCorrect);

    /* overall score */
    var scoreEl = q("[data-results-score]");
    if (scoreEl) {
      scoreEl.innerHTML =
        '<div class="vf-overall-score">' +
          '<span class="vf-score-number">' + totalCorrect + "</span>" +
          '<span class="vf-score-denom">/ ' + questions.length + "</span>" +
        "</div>" +
        '<div class="vf-band-label">' + escapeHtml(band.label) + "</div>" +
        '<p class="vf-band-desc">'    + escapeHtml(band.desc)  + "</p>";
    }

    /* per-category breakdown */
    var tbody = q("[data-results-tbody]");
    if (!tbody) return;

    /* group by category */
    var cats = {};
    questions.forEach(function (qq) {
      if (!cats[qq.catId]) cats[qq.catId] = { title: qq.catTitle, total: 0, correct: 0 };
      cats[qq.catId].total++;
    });
    answers.forEach(function (a) {
      if (cats[a.catId] && a.correct) cats[a.catId].correct++;
    });

    var rows = "";
    Object.keys(cats).forEach(function (catId) {
      var c   = cats[catId];
      var pct = Math.round((c.correct / c.total) * 100);
      var cls = pct === 100 ? "vf-cat-full" : pct >= 67 ? "vf-cat-good" : "vf-cat-low";
      rows +=
        "<tr>" +
          "<td>" + escapeHtml(c.title) + "</td>" +
          '<td class="' + cls + '">' + c.correct + " / " + c.total + "</td>" +
          '<td><div class="vf-mini-bar"><div class="vf-mini-fill ' + cls + '" style="width:' + pct + '%"></div></div></td>' +
        "</tr>";
    });
    tbody.innerHTML = rows;
  }

  /* ── restart ─────────────────────────────────────────────── */

  function restart() {
    hide("[data-quiz-results]");
    show("[data-quiz-intro]");
  }

  /* ── bind persistent controls ────────────────────────────── */

  function bindControls() {
    var btnNext    = q("[data-btn-next]");
    var btnSubmit  = q("[data-btn-submit]");
    var btnRestart = q("[data-btn-restart]");
    if (btnNext)    btnNext.addEventListener("click",    nextQuestion);
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
          questions = buildQuestions(data);
          bindIntro();
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
