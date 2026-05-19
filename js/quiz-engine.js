/**
 * Shared quiz engine for sovereignty self-assessments.
 */
(function (global) {
  "use strict";

  function sealToPercent(level) {
    return (level / 4) * 100;
  }

  function getObjectiveMap(data) {
    const map = {};
    data.objectives.forEach(function (obj) {
      map[obj.id] = obj;
    });
    return map;
  }

  function groupQuestionsBySov(data) {
    const groups = [];
    data.objectives.forEach(function (obj) {
      const questions = data.questions.filter(function (q) {
        return q.sovId === obj.id;
      });
      groups.push({ objective: obj, questions: questions });
    });
    return groups;
  }

  function computeResults(data, answers) {
    const objectiveMap = getObjectiveMap(data);
    const byObjective = {};

    data.objectives.forEach(function (obj) {
      byObjective[obj.id] = { objective: obj, seal: 4, answers: [] };
    });

    data.questions.forEach(function (q) {
      const raw = answers[q.id];
      if (raw === undefined || raw === null || raw === "") return;
      const level = parseInt(raw, 10);
      const entry = byObjective[q.sovId];
      entry.answers.push({ questionId: q.id, level: level });
      if (level < entry.seal) entry.seal = level;
    });

    const results = [];
    let weightedSum = 0;
    let totalWeight = 0;

    data.objectives.forEach(function (obj) {
      const entry = byObjective[obj.id];
      const answered = entry.answers.length;
      const total = data.questions.filter(function (q) {
        return q.sovId === obj.id;
      }).length;

      if (answered === 0) {
        results.push({
          sovId: obj.id,
          title: obj.title,
          weight: obj.weight,
          seal: null,
          sealInfo: null,
          answered: 0,
          total: total,
          complete: false,
        });
        return;
      }

      const sealInfo = data.sealLevels.find(function (s) {
        return s.level === entry.seal;
      });

      const percent = sealToPercent(entry.seal);
      weightedSum += percent * (obj.weight / 100);
      totalWeight += obj.weight;

      results.push({
        sovId: obj.id,
        title: obj.title,
        weight: obj.weight,
        seal: entry.seal,
        sealInfo: sealInfo,
        answered: answered,
        total: total,
        complete: answered === total,
      });
    });

    const allComplete = results.every(function (r) {
      return r.complete;
    });
    const compositeScore = allComplete ? Math.round(weightedSum) : null;

    return { results: results, compositeScore: compositeScore, allComplete: allComplete };
  }

  function renderSealOptions(sealLevels) {
    return sealLevels
      .map(function (seal) {
        return (
          '<label class="quiz-option">' +
          '<input type="radio" name="PLACEHOLDER" value="' +
          seal.level +
          '" required />' +
          '<span><span class="quiz-option-label">' +
          seal.label +
          " — " +
          seal.name +
          '</span><span class="quiz-option-desc">' +
          escapeHtml(seal.description) +
          "</span></span></label>"
        );
      })
      .join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function initQuiz(options) {
    const container = document.getElementById(options.containerId);
    if (!container) return;

    const dataPath = options.dataPath;
    let data = null;
    let currentSection = 0;
    let answers = {};
    const groups = [];

    const introEl = container.querySelector("[data-quiz-intro]");
    const formEl = container.querySelector("[data-quiz-form]");
    const resultsEl = container.querySelector("[data-quiz-results]");
    const progressLabel = container.querySelector("[data-progress-label]");
    const progressFill = container.querySelector("[data-progress-fill]");
    const sectionHost = container.querySelector("[data-quiz-sections]");
    const prevBtn = container.querySelector("[data-btn-prev]");
    const nextBtn = container.querySelector("[data-btn-next]");
    const submitBtn = container.querySelector("[data-btn-submit]");

    function show(el) {
      el.classList.remove("hidden");
    }
    function hide(el) {
      el.classList.add("hidden");
    }

    function updateProgress() {
      const total = groups.length;
      const current = currentSection + 1;
      if (progressLabel) {
        progressLabel.textContent = "Section " + current + " of " + total;
      }
      if (progressFill) {
        progressFill.style.width = ((current / total) * 100).toFixed(1) + "%";
      }
    }

    function renderSection(index) {
      if (!sectionHost || !data) return;
      const group = groups[index];
      const obj = group.objective;

      let html =
        '<div class="quiz-section" data-section="' +
        index +
        '">' +
        '<h2 class="quiz-section-title">' +
        escapeHtml(obj.id + ": " + obj.title) +
        "</h2>" +
        '<p class="quiz-section-desc">' +
        escapeHtml(obj.description) +
        "</p>";

      group.questions.forEach(function (q, qi) {
        const name = "q-" + q.id;
        const optionsHtml = renderSealOptions(data.sealLevels).replace(/name="PLACEHOLDER"/g, 'name="' + name + '"');
        const checked = answers[q.id] !== undefined ? ' value="' + answers[q.id] + '"' : "";

        html +=
          '<fieldset class="quiz-question" id="' +
          q.id +
          '">' +
          "<legend>" +
          (qi + 1) +
          ". " +
          escapeHtml(q.text) +
          "</legend>" +
          '<div class="quiz-options">' +
          optionsHtml +
          "</div></fieldset>";
      });

      html += "</div>";
      sectionHost.innerHTML = html;

      group.questions.forEach(function (q) {
        if (answers[q.id] !== undefined) {
          const input = sectionHost.querySelector('input[name="q-' + q.id + '"][value="' + answers[q.id] + '"]');
          if (input) input.checked = true;
        }
      });

      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.classList.toggle("hidden", index === groups.length - 1);
      if (submitBtn) submitBtn.classList.toggle("hidden", index !== groups.length - 1);
      updateProgress();
    }

    function collectCurrentSection() {
      const group = groups[currentSection];
      group.questions.forEach(function (q) {
        const selected = sectionHost.querySelector('input[name="q-' + q.id + '"]:checked');
        if (selected) answers[q.id] = selected.value;
      });
    }

    function validateCurrentSection() {
      const group = groups[currentSection];
      for (let i = 0; i < group.questions.length; i++) {
        const q = group.questions[i];
        const selected = sectionHost.querySelector('input[name="q-' + q.id + '"]:checked');
        if (!selected) {
          const field = document.getElementById(q.id);
          if (field) field.scrollIntoView({ behavior: "smooth", block: "center" });
          return false;
        }
      }
      return true;
    }

    function renderResults() {
      const computed = computeResults(data, answers);
      const scoreEl = container.querySelector("[data-results-score]");
      const tableBody = container.querySelector("[data-results-tbody]");

      if (scoreEl) {
        if (computed.compositeScore !== null) {
          scoreEl.innerHTML =
            '<div class="results-score-value">' +
            computed.compositeScore +
            '%</div><p class="results-score-label">Indicative weighted sovereignty score</p>';
        } else {
          scoreEl.innerHTML =
            '<p class="results-score-label">Complete all sections to calculate the composite score.</p>';
        }
      }

      if (tableBody) {
        tableBody.innerHTML = computed.results
          .map(function (r) {
            if (!r.complete) {
              return (
                "<tr><td>" +
                escapeHtml(r.sovId + " " + r.title) +
                '</td><td colspan="2"><em>Incomplete (' +
                r.answered +
                "/" +
                r.total +
                ")</em></td></tr>"
              );
            }
            return (
              "<tr><td>" +
              escapeHtml(r.sovId + " " + r.title) +
              '</td><td><span class="seal-badge" data-seal="' +
              r.seal +
              '">' +
              escapeHtml(r.sealInfo.label) +
              "</span></td><td>" +
              escapeHtml(r.sealInfo.name) +
              " (" +
              r.weight +
              "% weight)</td></tr>"
            );
          })
          .join("");
      }

      hide(formEl);
      show(resultsEl);
      resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function bindEvents() {
      const startBtn = container.querySelector("[data-btn-start]");
      if (startBtn) {
        startBtn.addEventListener("click", function () {
          hide(introEl);
          show(formEl);
          renderSection(0);
        });
      }

      if (prevBtn) {
        prevBtn.addEventListener("click", function () {
          collectCurrentSection();
          if (currentSection > 0) {
            currentSection--;
            renderSection(currentSection);
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", function () {
          if (!validateCurrentSection()) return;
          collectCurrentSection();
          if (currentSection < groups.length - 1) {
            currentSection++;
            renderSection(currentSection);
            sectionHost.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }

      if (submitBtn) {
        submitBtn.addEventListener("click", function () {
          if (!validateCurrentSection()) return;
          collectCurrentSection();
          renderResults();
        });
      }

      const restartBtn = container.querySelector("[data-btn-restart]");
      if (restartBtn) {
        restartBtn.addEventListener("click", function () {
          answers = {};
          currentSection = 0;
          hide(resultsEl);
          show(introEl);
          hide(formEl);
          if (sectionHost) sectionHost.innerHTML = "";
        });
      }
    }

    fetch(dataPath)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load assessment data");
        return res.json();
      })
      .then(function (json) {
        data = json;
        groups.push.apply(groups, groupQuestionsBySov(data));
        bindEvents();
      })
      .catch(function (err) {
        container.innerHTML =
          '<p class="quiz-disclaimer" role="alert">Unable to load the assessment. Please try again later.</p>';
        console.error(err);
      });
  }

  global.QuizEngine = {
    init: initQuiz,
    computeResults: computeResults,
  };
})(window);
