(function () {
  const FAVORITES_STORAGE_KEY = "quiz-favorites:v1";
  const THEME_STORAGE_KEY = "theme-preference:v1";
  const LAST_STUDY_KEY = "quiz-last-study:v1";
  const VIEW_MODE_KEY = "quiz-view-mode:v1";

  const rootElement = document.documentElement;
  const favoritesPageRoot = document.getElementById("favorites-page-root");
  const systemThemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const reducedMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function prefersReducedMotion() {
    return Boolean(reducedMotionQuery && reducedMotionQuery.matches);
  }

  function loadStoredJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function saveStoredJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function compareNaturalText(left, right) {
    return String(left).localeCompare(String(right), "zh-Hans-CN", { numeric: true });
  }

  /* ==========================================================================
     1. KaTeX Formula Renderer
     ========================================================================== */
  function renderMathInRoot(container) {
    const scope = container || document;
    if (typeof window.katex === "undefined") {
      return;
    }
    const nodes = scope.querySelectorAll(".math-tex[data-tex]");
    nodes.forEach((node) => {
      if (node.dataset.katexRendered === "1") {
        return;
      }
      const tex = node.getAttribute("data-tex") || "";
      const displayMode = node.getAttribute("data-display") === "true";
      try {
        window.katex.render(tex, node, {
          displayMode: displayMode,
          throwOnError: false,
          strict: "ignore",
        });
        node.dataset.katexRendered = "1";
      } catch (error) {
        node.dataset.katexRendered = "1";
      }
    });
  }

  /* ==========================================================================
     2. Apple Segmented Controls & Sliding Nav Pill Physics
     ========================================================================== */
  function syncSegmentedThumb(groupEl) {
    if (!groupEl) {
      return;
    }
    const thumb = groupEl.querySelector("[data-segmented-thumb]");
    const activeBtn = groupEl.querySelector(".segmented-btn.is-active");
    if (!thumb || !activeBtn) {
      if (thumb) {
        thumb.style.opacity = "0";
      }
      return;
    }
    thumb.style.width = `${activeBtn.offsetWidth}px`;
    thumb.style.transform = `translate3d(${activeBtn.offsetLeft}px, 0, 0)`;
    thumb.style.opacity = "1";
  }

  function initAllSegmentedThumbs() {
    const groups = document.querySelectorAll(".segmented-control");
    groups.forEach((group) => syncSegmentedThumb(group));
    window.addEventListener("resize", () => {
      groups.forEach((group) => syncSegmentedThumb(group));
    });
  }

  function initSlidingTopNav() {
    const navTrack = document.querySelector("[data-sliding-nav]");
    if (!navTrack) {
      return;
    }
    const indicator = navTrack.querySelector("[data-nav-indicator]");
    const items = Array.from(navTrack.querySelectorAll("[data-nav-item]"));
    if (!indicator || items.length === 0) {
      return;
    }

    function moveIndicatorTo(targetEl) {
      if (!targetEl) {
        indicator.style.opacity = "0";
        return;
      }
      indicator.style.width = `${targetEl.offsetWidth}px`;
      indicator.style.transform = `translate3d(${targetEl.offsetLeft}px, 0, 0)`;
      indicator.style.opacity = "1";
    }

    moveIndicatorTo(navTrack.querySelector(".nav-pill-item.is-active"));

    if (!navTrack.dataset.boundHover) {
      navTrack.dataset.boundHover = "1";
      items.forEach((item) => {
        item.addEventListener("mouseenter", () => moveIndicatorTo(item));
      });
      navTrack.addEventListener("mouseleave", () => {
        moveIndicatorTo(navTrack.querySelector(".nav-pill-item.is-active"));
      });
      window.addEventListener("resize", () => {
        moveIndicatorTo(navTrack.querySelector(".nav-pill-item.is-active"));
      });
    }
  }

  /* ==========================================================================
     3. Theme Switcher (Light / System / Dark) with Sliding Thumb
     ========================================================================== */
  function loadThemePreference() {
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") {
        return raw;
      }
    } catch (error) {}
    return "system";
  }

  function resolveTheme(preference) {
    if (preference === "light" || preference === "dark") {
      return preference;
    }
    return systemThemeQuery && systemThemeQuery.matches ? "dark" : "light";
  }

  function applyThemePreference(preference, persist) {
    rootElement.dataset.themeMode = preference;
    rootElement.dataset.theme = resolveTheme(preference);

    const order = ["light", "system", "dark"];
    const idx = Math.max(0, order.indexOf(preference));
    document.querySelectorAll("[data-theme-segmented]").forEach((seg) => {
      const thumb = seg.querySelector("[data-theme-thumb]");
      if (thumb) {
        thumb.style.transform = `translate3d(${idx * 30}px, 0, 0)`;
      }
      seg.querySelectorAll("[data-theme-option]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.themeOption === preference);
      });
    });

    if (persist) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference);
      } catch (error) {}
    }
  }

  function initThemeControls() {
    applyThemePreference(loadThemePreference(), false);

    document.querySelectorAll("[data-theme-option]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyThemePreference(btn.dataset.themeOption, true);
      });
    });

    if (systemThemeQuery) {
      const handleSystemChange = () => {
        if ((rootElement.dataset.themeMode || "system") === "system") {
          applyThemePreference("system", false);
        }
      };
      if (typeof systemThemeQuery.addEventListener === "function") {
        systemThemeQuery.addEventListener("change", handleSystemChange);
      } else if (typeof systemThemeQuery.addListener === "function") {
        systemThemeQuery.addListener(handleSystemChange);
      }
    }
  }

  /* ==========================================================================
     4. Scroll Reveal & Count-Up
     ========================================================================== */
  function initScrollRevealAndCounters() {
    const revealNodes = Array.from(document.querySelectorAll("[data-reveal]"));
    const countNodes = Array.from(document.querySelectorAll("[data-countup]"));

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      revealNodes.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -20px 0px" },
    );
    revealNodes.forEach((el) => revealObserver.observe(el));

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          const el = entry.target;
          counterObserver.unobserve(el);
          const targetVal = parseInt(el.getAttribute("data-countup") || "0", 10);
          if (!Number.isFinite(targetVal) || targetVal <= 0) {
            return;
          }
          const startTime = performance.now();
          const duration = 620;
          const step = (now) => {
            const p = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - p, 4);
            el.textContent = String(Math.round(targetVal * eased));
            if (p < 1) {
              requestAnimationFrame(step);
            } else {
              el.textContent = String(targetVal);
            }
          };
          requestAnimationFrame(step);
        });
      },
      { threshold: 0.25 },
    );
    countNodes.forEach((el) => counterObserver.observe(el));
  }

  /* ==========================================================================
     5. Local Progress Inspection & Favorites Store
     ========================================================================== */
  function loadChapterAnswers(subjectId, chapterId) {
    const parsed = loadStoredJson(`quiz-progress:${subjectId}:${chapterId}`, { answers: {} });
    return parsed && typeof parsed.answers === "object" ? parsed.answers : {};
  }

  function getSubjectProgressStats(subjectId) {
    let answered = 0;
    let correct = 0;
    const prefix = `quiz-progress:${subjectId}:`;
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const parsed = loadStoredJson(key, null);
          if (parsed && parsed.answers && typeof parsed.answers === "object") {
            const values = Object.values(parsed.answers);
            answered += values.length;
            correct += values.filter((v) => v && v.correct).length;
          }
        }
      }
    } catch (error) {}
    return { answered, correct };
  }

  function loadFavoritesStore() {
    const parsed = loadStoredJson(FAVORITES_STORAGE_KEY, { items: {} });
    return {
      items: parsed && typeof parsed.items === "object" ? parsed.items : {},
    };
  }

  function saveFavoritesStore(store) {
    saveStoredJson(FAVORITES_STORAGE_KEY, store);
    updateFavoritesCountIndicators();
  }

  function makeFavoriteKey(subjectId, chapterId, questionId) {
    return `${subjectId}:${chapterId}:${questionId}`;
  }

  function buildFavoriteRecord(quizContext, question) {
    return {
      key: makeFavoriteKey(quizContext.subjectId, quizContext.chapterId, question.id),
      subjectId: quizContext.subjectId,
      subjectName: quizContext.subjectName,
      chapterId: quizContext.chapterId,
      chapterName: quizContext.chapterName,
      questionId: question.id,
      number: question.number,
      header: question.header || `第 ${question.number} 题`,
      difficulty: question.difficulty || "",
      prompt_html: question.prompt_html,
      options: question.options,
      answer: question.answer,
      analysis_html: question.analysis_html,
      questionUrl: `/subjects/${quizContext.subjectId}/chapters/${quizContext.chapterId}#question-card-${question.id}`,
      addedAt: Date.now(),
    };
  }

  function getFavoritesCount() {
    return Object.keys(loadFavoritesStore().items).length;
  }

  function updateFavoritesCountIndicators() {
    const count = getFavoritesCount();
    document.querySelectorAll("[data-favorites-count]").forEach((el) => {
      el.textContent = `${count} 道收藏`;
    });
    document.querySelectorAll("[data-favorites-badge]").forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
    initSlidingTopNav();
  }

  function isQuestionFavorited(quizContext, question) {
    const key = makeFavoriteKey(quizContext.subjectId, quizContext.chapterId, question.id);
    return Boolean(loadFavoritesStore().items[key]);
  }

  function toggleFavorite(quizContext, question) {
    const store = loadFavoritesStore();
    const key = makeFavoriteKey(quizContext.subjectId, quizContext.chapterId, question.id);
    if (store.items[key]) {
      delete store.items[key];
      saveFavoritesStore(store);
      return false;
    }
    store.items[key] = buildFavoriteRecord(quizContext, question);
    saveFavoritesStore(store);
    return true;
  }

  function removeFavoriteByKey(key) {
    const store = loadFavoritesStore();
    delete store.items[key];
    saveFavoritesStore(store);
  }

  function getSortedFavorites() {
    return Object.values(loadFavoritesStore().items).sort((a, b) => b.addedAt - a.addedAt);
  }

  /* ==========================================================================
     6. Home Page Progress Hydration & Resume Banner
     ========================================================================== */
  function initHomePage() {
    const continueSlot = document.getElementById("continue-study-slot");
    const subjectCards = document.querySelectorAll("[data-subject-card]");
    if (subjectCards.length === 0 && !continueSlot) {
      return;
    }

    subjectCards.forEach((card) => {
      const subjectId = card.dataset.subjectCard;
      const total = parseInt(card.dataset.totalQuestions || "0", 10);
      const { answered, correct } = getSubjectProgressStats(subjectId);
      const pill = card.querySelector(`[data-subject-progress-text="${subjectId}"]`);
      const bar = card.querySelector(`[data-subject-progress-bar="${subjectId}"]`);

      if (answered > 0 && total > 0) {
        const pct = Math.min(100, Math.round((answered / total) * 100));
        const acc = Math.round((correct / answered) * 100);
        if (pill) {
          pill.textContent = `已刷 ${answered}/${total} · 正确率 ${acc}%`;
          pill.classList.add("has-progress");
        }
        if (bar) {
          bar.style.width = `${pct}%`;
        }
      }
    });

    if (continueSlot) {
      const last = loadStoredJson(LAST_STUDY_KEY, null);
      if (last && last.url && last.chapterName && last.subjectName) {
        continueSlot.classList.remove("hidden");
        continueSlot.innerHTML = `
          <div class="continue-banner">
            <div class="continue-banner-info">
              <span class="continue-banner-eyebrow">继续上次练习</span>
              <span class="continue-banner-title">${escapeHtml(last.subjectName)} · ${escapeHtml(last.chapterName)}</span>
              <span class="continue-banner-sub">${escapeHtml(last.progressText || "点击回到上次刷题位置")}</span>
            </div>
            <a class="btn btn-primary" href="${escapeHtml(last.url)}">
              <span>继续刷题</span>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.5 8h9M8.5 4l4 4-4 4"></path>
              </svg>
            </a>
          </div>
        `;
      }
    }
  }

  /* ==========================================================================
     7. Subject Chapter Directory Controller (Search + Filter + Live Progress)
     ========================================================================== */
  function initSubjectPage() {
    const ctx = window.SUBJECT_PAGE_CONTEXT;
    if (!ctx) {
      return;
    }

    const rows = Array.from(document.querySelectorAll("[data-chapter-row]"));
    const searchInput = document.getElementById("chapter-search-input");
    const filterGroup = document.querySelector("[data-chapter-filter-group]");
    const emptyNotice = document.getElementById("chapter-filter-empty");
    const answeredEl = document.querySelector("[data-subject-answered]");
    const accuracyEl = document.querySelector("[data-subject-accuracy]");
    const barEl = document.querySelector("[data-subject-bar]");

    let currentFilter = "all";
    let searchQuery = "";
    let totalAnswered = 0;
    let totalCorrect = 0;

    rows.forEach((row) => {
      const chapterId = row.dataset.chapterId;
      const qCount = parseInt(row.dataset.questionCount || "0", 10);
      if (qCount <= 0) {
        row.dataset.status = "disabled";
        return;
      }

      const answers = loadChapterAnswers(ctx.subjectId, chapterId);
      const values = Object.values(answers);
      const ansCount = values.length;
      const corCount = values.filter((v) => v && v.correct).length;
      totalAnswered += ansCount;
      totalCorrect += corCount;

      const pct = Math.min(100, Math.round((ansCount / qCount) * 100));
      const meter = row.querySelector("[data-chapter-meter]");
      const statusText = row.querySelector("[data-chapter-status-text]");

      if (meter) {
        meter.style.width = `${pct}%`;
      }

      if (ansCount === 0) {
        row.dataset.status = "unstarted";
        if (statusText) {
          statusText.textContent = `未开始 · 共 ${qCount} 题`;
        }
      } else if (ansCount >= qCount) {
        row.dataset.status = "completed";
        row.classList.add("is-completed");
        const acc = Math.round((corCount / ansCount) * 100);
        if (statusText) {
          statusText.textContent = `已完成 ${ansCount}/${qCount} · 正确率 ${acc}%`;
        }
      } else {
        row.dataset.status = "in_progress";
        row.classList.add("is-in-progress");
        const acc = Math.round((corCount / ansCount) * 100);
        if (statusText) {
          statusText.textContent = `已刷 ${ansCount}/${qCount} · 正确率 ${acc}%`;
        }
      }
    });

    if (answeredEl) {
      answeredEl.textContent = `${totalAnswered} / ${ctx.totalQuestions}`;
    }
    if (accuracyEl) {
      accuracyEl.textContent = totalAnswered > 0 ? `${Math.round((totalCorrect / totalAnswered) * 100)}%` : "—";
    }
    if (barEl && ctx.totalQuestions > 0) {
      barEl.style.width = `${Math.min(100, Math.round((totalAnswered / ctx.totalQuestions) * 100))}%`;
    }

    function applyFilter() {
      const q = searchQuery.trim().toLowerCase();
      let visibleCount = 0;

      rows.forEach((row) => {
        const name = row.dataset.chapterName || "";
        const status = row.dataset.status || "unstarted";
        const matchesSearch = !q || name.includes(q);
        const matchesTab =
          currentFilter === "all" ||
          (currentFilter === "in_progress" && status === "in_progress") ||
          (currentFilter === "unstarted" && status === "unstarted") ||
          (currentFilter === "completed" && status === "completed");

        const show = matchesSearch && matchesTab;
        row.classList.toggle("hidden", !show);
        if (show) {
          visibleCount += 1;
        }
      });

      if (emptyNotice) {
        emptyNotice.classList.toggle("hidden", visibleCount > 0);
      }
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchQuery = searchInput.value || "";
        applyFilter();
      });
    }

    if (filterGroup) {
      filterGroup.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-chapter-filter]");
        if (!btn) {
          return;
        }
        currentFilter = btn.dataset.chapterFilter;
        filterGroup.querySelectorAll(".segmented-btn").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
        });
        syncSegmentedThumb(filterGroup);
        applyFilter();
      });
    }
  }

  /* ==========================================================================
     8. SVG Icons for Question Cards
     ========================================================================== */
  const ICON_CHECK = `<svg class="q-option-state-icon" viewBox="0 0 20 20" fill="none" stroke="var(--success)" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="7.5" stroke-opacity="0.3"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.6 10.3l2.3 2.3 4.6-5"/></svg>`;
  const ICON_CROSS = `<svg class="q-option-state-icon" viewBox="0 0 20 20" fill="none" stroke="var(--danger)" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="7.5" stroke-opacity="0.3"/><path stroke-linecap="round" d="M7.3 7.3l5.4 5.4M12.7 7.3l-5.4 5.4"/></svg>`;
  const ICON_CHEVRON_DOWN = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6l4 4 4-4"/></svg>`;

  /* ==========================================================================
     9. Chapter Study Workspace Controller
     ========================================================================== */
  function initChapterPage(chapterData, quizContext) {
    const workspace = document.getElementById("study-workspace");
    const sidebarToggleButton = document.getElementById("sidebar-toggle-button");
    const sidebarCloseMobile = document.getElementById("sidebar-close-mobile");
    const drawerBackdrop = document.getElementById("drawer-backdrop");
    const sidebarFilterInput = document.getElementById("sidebar-chapter-filter");
    const sidebarScroll = document.getElementById("sidebar-chapter-scroll");

    const progressSummary = document.getElementById("progress-summary");
    const progressMeterFill = document.getElementById("progress-meter-fill");
    const pageQuestionSummary = document.getElementById("page-question-summary");
    const navPageIndicator = document.getElementById("nav-page-indicator");
    const bottomPageIndicator = document.getElementById("bottom-page-indicator");
    const pagePrevButtons = Array.from(document.querySelectorAll('[data-page-nav="prev"]'));
    const pageNextButtons = Array.from(document.querySelectorAll('[data-page-nav="next"]'));
    const questionList = document.getElementById("question-list");
    const resetChapterBtn = document.getElementById("reset-chapter-btn");

    const viewModeGroup = document.querySelector("[data-view-mode-group]");
    const filterGroup = document.querySelector("[data-question-filter-group]");

    const allQuestions = chapterData.questions || [];
    if (allQuestions.length === 0 || !questionList) {
      return;
    }

    const stateKey = `quiz-progress:${quizContext.subjectId}:${quizContext.chapterId}`;
    const sidebarStateKey = "quiz-sidebar-collapsed:v2";
    const progress = loadProgress();
    const analysisOpen = new Set();

    let viewMode = loadViewMode(); // "page" | "focus"
    let questionFilter = "all"; // "all" | "unanswered" | "wrong" | "favorited"
    let currentPage = 0;
    let activeQuestionId = allQuestions[0].id;

    function loadProgress() {
      const parsed = loadStoredJson(stateKey, { answers: {} });
      return {
        answers: parsed && typeof parsed.answers === "object" ? parsed.answers : {},
      };
    }

    function saveProgress() {
      saveStoredJson(stateKey, progress);
      recordLastStudy();
    }

    function loadViewMode() {
      try {
        const raw = window.localStorage.getItem(VIEW_MODE_KEY);
        if (raw === "focus" || raw === "page") {
          return raw;
        }
      } catch (error) {}
      return "page";
    }

    function saveViewMode(mode) {
      try {
        window.localStorage.setItem(VIEW_MODE_KEY, mode);
      } catch (error) {}
    }

    function recordLastStudy() {
      const answeredCount = Object.keys(progress.answers).length;
      saveStoredJson(LAST_STUDY_KEY, {
        subjectId: quizContext.subjectId,
        subjectName: quizContext.subjectName,
        chapterId: quizContext.chapterId,
        chapterName: quizContext.chapterName,
        url: `/subjects/${quizContext.subjectId}/chapters/${quizContext.chapterId}#question-card-${activeQuestionId}`,
        progressText: `已作答 ${answeredCount} / ${allQuestions.length} 题`,
        updatedAt: Date.now(),
      });
    }

    function getQuestionState(question) {
      return progress.answers[question.id] || null;
    }

    function getFilteredQuestions() {
      return allQuestions.filter((q) => {
        if (questionFilter === "all") {
          return true;
        }
        const st = getQuestionState(q);
        if (questionFilter === "unanswered") {
          return !st;
        }
        if (questionFilter === "wrong") {
          return Boolean(st && !st.correct);
        }
        if (questionFilter === "favorited") {
          return isQuestionFavorited(quizContext, q);
        }
        return true;
      });
    }

    function getPageSize() {
      return viewMode === "focus" ? 1 : 10;
    }

    function clampCurrentPage(filteredList) {
      const pageSize = getPageSize();
      const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
      if (currentPage >= totalPages) {
        currentPage = totalPages - 1;
      }
      if (currentPage < 0) {
        currentPage = 0;
      }
      return totalPages;
    }

    function updateHudMetrics() {
      const answeredCount = Object.keys(progress.answers).length;
      const correctCount = Object.values(progress.answers).filter((v) => v && v.correct).length;
      if (progressSummary) {
        const accPart = answeredCount > 0 ? ` · 正确率 ${Math.round((correctCount / answeredCount) * 100)}%` : "";
        progressSummary.textContent = `已答 ${answeredCount}/${allQuestions.length} · 答对 ${correctCount}${accPart}`;
      }
      if (progressMeterFill) {
        const pct = Math.min(100, Math.round((answeredCount / Math.max(1, allQuestions.length)) * 100));
        progressMeterFill.style.width = `${pct}%`;
      }
    }

    function renderSummaryChips(filteredList) {
      if (!pageQuestionSummary) {
        return;
      }
      pageQuestionSummary.innerHTML = "";

      if (filteredList.length === 0) {
        return;
      }

      const pageSize = getPageSize();
      let chipItems;
      if (viewMode === "focus") {
        const windowSize = 12;
        const half = Math.floor(windowSize / 2);
        let start = Math.max(0, currentPage - half);
        let end = Math.min(filteredList.length, start + windowSize);
        if (end - start < windowSize) {
          start = Math.max(0, end - windowSize);
        }
        chipItems = filteredList.slice(start, end).map((q, idx) => ({
          question: q,
          pageIndex: start + idx,
        }));
      } else {
        const start = currentPage * pageSize;
        chipItems = filteredList.slice(start, start + pageSize).map((q) => ({
          question: q,
          pageIndex: currentPage,
        }));
      }

      chipItems.forEach(({ question, pageIndex }) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "q-chip";
        chip.dataset.chipQuestionId = question.id;
        chip.textContent = String(question.number);
        chip.title = `第 ${question.number} 题`;

        const st = getQuestionState(question);
        if (st) {
          chip.classList.add(st.correct ? "correct" : "incorrect");
        }
        if (isQuestionFavorited(quizContext, question)) {
          chip.classList.add("favorited");
        }
        if (question.id === activeQuestionId) {
          chip.classList.add("is-current");
        }

        chip.addEventListener("click", () => {
          activeQuestionId = question.id;
          if (viewMode === "focus") {
            currentPage = pageIndex;
            renderPage(true);
          } else {
            highlightActiveCard();
            const cardEl = document.getElementById(`question-card-${question.id}`);
            if (cardEl) {
              cardEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
        });

        pageQuestionSummary.appendChild(chip);
      });
    }

    function buildQuestionCardHtml(question) {
      const state = getQuestionState(question);
      const isFav = isQuestionFavorited(quizContext, question);
      const isOpen = analysisOpen.has(question.id);
      const isCurrent = question.id === activeQuestionId;

      const diffHtml = question.difficulty
        ? `<span class="q-difficulty-badge">${escapeHtml(question.difficulty)}</span>`
        : "";

      const optionsHtml = question.options
        .map((opt) => {
          const classes = ["q-option"];
          let stateIcon = "";
          if (state) {
            if (opt.label === question.answer) {
              classes.push("is-correct");
              stateIcon = ICON_CHECK;
            } else if (state.selected === opt.label) {
              classes.push("is-incorrect");
              stateIcon = ICON_CROSS;
            }
          }
          return `
            <button
              type="button"
              class="${classes.join(" ")}"
              data-question-id="${question.id}"
              data-option-label="${opt.label}"
            >
              <span class="q-option-key">${escapeHtml(opt.label)}</span>
              <div class="q-option-body rendered-fragment">${opt.html}</div>
              ${stateIcon}
            </button>
          `;
        })
        .join("");

      let feedbackClass = "q-feedback";
      let feedbackHtml = "点选选项即刻判题";
      if (state?.correct) {
        feedbackClass = "q-feedback is-correct";
        feedbackHtml = `回答正确 · 答案 ${escapeHtml(question.answer)}`;
      } else if (state && !state.correct) {
        feedbackClass = "q-feedback is-incorrect";
        feedbackHtml = `回答错误 · 你选 ${escapeHtml(state.selected)}，正确答案 ${escapeHtml(question.answer)}`;
      }

      return `
        <article
          class="q-card ${isCurrent ? "is-active-card" : ""}"
          id="question-card-${question.id}"
          data-question-id="${question.id}"
        >
          <div class="q-card-header">
            <div class="q-meta-left">
              <span class="q-index-badge">第 ${question.number} 题</span>
              ${diffHtml}
            </div>
            <div class="q-meta-actions">
              <button
                type="button"
                class="q-icon-action favorite-toggle ${isFav ? "is-favorited" : ""}"
                data-question-id="${question.id}"
                title="收藏本题 (快捷键 S)"
              >
                <span>${isFav ? "★ 已收藏" : "☆ 收藏"}</span>
              </button>
            </div>
          </div>

          <div class="q-prompt rendered-fragment">${question.prompt_html}</div>

          <div class="q-options">${optionsHtml}</div>

          <div class="q-footer">
            <div class="${feedbackClass}" data-feedback-for="${question.id}">${feedbackHtml}</div>
            <button
              type="button"
              class="q-analysis-btn analysis-toggle ${isOpen ? "is-open" : ""}"
              data-question-id="${question.id}"
              aria-expanded="${isOpen}"
            >
              <span>${isOpen ? "收起解析" : "查看解析"}</span>
              ${ICON_CHEVRON_DOWN}
            </button>
          </div>

          <div class="q-analysis-collapse ${isOpen ? "is-open" : ""}" data-analysis-for="${question.id}">
            <div class="q-analysis-inner">
              <div class="q-analysis-card">
                <div class="q-analysis-title">推导与解析</div>
                <div class="rendered-fragment">${question.analysis_html}</div>
              </div>
            </div>
          </div>
        </article>
      `;
    }

    function highlightActiveCard() {
      questionList.querySelectorAll(".q-card").forEach((card) => {
        card.classList.toggle("is-active-card", card.dataset.questionId === activeQuestionId);
      });
      if (pageQuestionSummary) {
        pageQuestionSummary.querySelectorAll(".q-chip").forEach((chip) => {
          chip.classList.toggle("is-current", chip.dataset.chipQuestionId === activeQuestionId);
        });
      }
    }

    function updateCardStateInPlace(question, selectedLabel) {
      progress.answers[question.id] = {
        selected: selectedLabel,
        correct: selectedLabel === question.answer,
      };
      activeQuestionId = question.id;
      saveProgress();

      const card = document.getElementById(`question-card-${question.id}`);
      if (card) {
        highlightActiveCard();
        const isCorrect = selectedLabel === question.answer;

        card.querySelectorAll("[data-option-label]").forEach((btn) => {
          const label = btn.dataset.optionLabel;
          btn.classList.remove("is-correct", "is-incorrect");
          const oldIcon = btn.querySelector(".q-option-state-icon");
          if (oldIcon) {
            oldIcon.remove();
          }
          if (label === question.answer) {
            btn.classList.add("is-correct");
            btn.insertAdjacentHTML("beforeend", ICON_CHECK);
          } else if (label === selectedLabel) {
            btn.classList.add("is-incorrect");
            btn.insertAdjacentHTML("beforeend", ICON_CROSS);
          }
        });

        const feedbackEl = card.querySelector(`[data-feedback-for="${question.id}"]`);
        if (feedbackEl) {
          feedbackEl.className = isCorrect ? "q-feedback is-correct" : "q-feedback is-incorrect";
          feedbackEl.textContent = isCorrect
            ? `回答正确 · 答案 ${question.answer}`
            : `回答错误 · 你选 ${selectedLabel}，正确答案 ${question.answer}`;
        }

        if (!isCorrect) {
          if (!prefersReducedMotion()) {
            card.classList.remove("shake-gentle");
            void card.offsetWidth;
            card.classList.add("shake-gentle");
          }
          if (!analysisOpen.has(question.id)) {
            toggleAnalysisInPlace(question.id, true);
          }
        }
      }

      updateHudMetrics();
      renderSummaryChips(getFilteredQuestions());
    }

    function toggleAnalysisInPlace(questionId, forceOpen) {
      const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !analysisOpen.has(questionId);
      if (shouldOpen) {
        analysisOpen.add(questionId);
      } else {
        analysisOpen.delete(questionId);
      }

      const collapseEl = questionList.querySelector(`[data-analysis-for="${questionId}"]`);
      const toggleBtn = questionList.querySelector(`.analysis-toggle[data-question-id="${questionId}"]`);
      if (collapseEl) {
        collapseEl.classList.toggle("is-open", shouldOpen);
      }
      if (toggleBtn) {
        toggleBtn.classList.toggle("is-open", shouldOpen);
        toggleBtn.setAttribute("aria-expanded", String(shouldOpen));
        const span = toggleBtn.querySelector("span");
        if (span) {
          span.textContent = shouldOpen ? "收起解析" : "查看解析";
        }
      }
    }

    function toggleFavoriteInPlace(question) {
      const nowFav = toggleFavorite(quizContext, question);
      const btn = questionList.querySelector(`.favorite-toggle[data-question-id="${question.id}"]`);
      if (btn) {
        btn.classList.toggle("is-favorited", nowFav);
        const span = btn.querySelector("span");
        if (span) {
          span.textContent = nowFav ? "★ 已收藏" : "☆ 收藏";
        }
        if (!prefersReducedMotion()) {
          btn.classList.remove("pop-star");
          void btn.offsetWidth;
          btn.classList.add("pop-star");
        }
      }
      if (questionFilter === "favorited" && !nowFav) {
        renderPage(true);
      } else {
        renderSummaryChips(getFilteredQuestions());
      }
    }

    function renderPage(animateSwitch) {
      const filtered = getFilteredQuestions();
      const totalPages = clampCurrentPage(filtered);
      const pageSize = getPageSize();

      if (filtered.length === 0) {
        const filterNames = {
          unanswered: "没有未作答的题目",
          wrong: "太棒了，当前没有错题",
          favorited: "本章还没有收藏题目",
          all: "暂无题目",
        };
        questionList.innerHTML = `
          <div class="empty-card">
            <p>${filterNames[questionFilter] || "没有匹配的题目"}</p>
            <button type="button" class="btn btn-secondary" data-reset-filter>返回全部题目</button>
          </div>
        `;
      } else {
        const start = currentPage * pageSize;
        const slice = filtered.slice(start, start + pageSize);
        if (!slice.some((q) => q.id === activeQuestionId)) {
          activeQuestionId = slice[0].id;
        }
        questionList.innerHTML = slice.map(buildQuestionCardHtml).join("");
        renderMathInRoot(questionList);

        if (animateSwitch && !prefersReducedMotion()) {
          questionList.classList.remove("is-switching");
          void questionList.offsetWidth;
          questionList.classList.add("is-switching");
        }
      }

      updateHudMetrics();
      renderSummaryChips(filtered);

      const labelShort = filtered.length === 0 ? "0 / 0" : `${currentPage + 1} / ${totalPages}`;
      const labelLong =
        filtered.length === 0
          ? "0 / 0"
          : viewMode === "focus"
            ? `第 ${currentPage + 1} / ${totalPages} 题`
            : `第 ${currentPage + 1} / ${totalPages} 页`;

      if (navPageIndicator) {
        navPageIndicator.textContent = labelShort;
      }
      if (bottomPageIndicator) {
        bottomPageIndicator.textContent = labelLong;
      }

      pagePrevButtons.forEach((btn) => {
        btn.disabled = filtered.length === 0 || currentPage <= 0;
        const span = btn.querySelector("span");
        if (span) {
          span.textContent = viewMode === "focus" ? "上一题" : "上一页";
        }
      });

      pageNextButtons.forEach((btn) => {
        btn.disabled = filtered.length === 0 || currentPage >= totalPages - 1;
        const span = btn.querySelector("span");
        if (span) {
          span.textContent = viewMode === "focus" ? "下一题" : "下一页";
        }
      });

      recordLastStudy();
    }

    function syncFromHash() {
      const match = window.location.hash.match(/^#question-card-(.+)$/);
      if (!match) {
        return null;
      }
      const qId = match[1];
      const filtered = getFilteredQuestions();
      const idx = filtered.findIndex((item) => item.id === qId);
      if (idx >= 0) {
        activeQuestionId = qId;
        currentPage = Math.floor(idx / getPageSize());
        return qId;
      }
      return null;
    }

    function isMobileViewport() {
      return window.matchMedia("(max-width: 980px)").matches;
    }

    function applyDesktopSidebar(collapsed) {
      if (!workspace) {
        return;
      }
      workspace.classList.toggle("sidebar-collapsed", collapsed);
      saveStoredJson(sidebarStateKey, { collapsed });
    }

    if (workspace) {
      const savedSidebar = loadStoredJson(sidebarStateKey, { collapsed: false });
      applyDesktopSidebar(Boolean(savedSidebar?.collapsed));
    }

    if (sidebarToggleButton && workspace) {
      sidebarToggleButton.addEventListener("click", () => {
        if (isMobileViewport()) {
          workspace.classList.toggle("mobile-drawer-open");
        } else {
          applyDesktopSidebar(!workspace.classList.contains("sidebar-collapsed"));
        }
      });
    }

    if (sidebarCloseMobile && workspace) {
      sidebarCloseMobile.addEventListener("click", () => {
        workspace.classList.remove("mobile-drawer-open");
      });
    }

    if (drawerBackdrop && workspace) {
      drawerBackdrop.addEventListener("click", () => {
        workspace.classList.remove("mobile-drawer-open");
      });
    }

    if (sidebarFilterInput && sidebarScroll) {
      sidebarFilterInput.addEventListener("input", () => {
        const q = (sidebarFilterInput.value || "").trim().toLowerCase();
        sidebarScroll.querySelectorAll(".sidebar-chapter-link").forEach((el) => {
          const title = el.dataset.chapterTitle || "";
          el.classList.toggle("hidden", Boolean(q && !title.includes(q)));
        });
      });
    }

    if (sidebarScroll) {
      const activeSidebarLink = sidebarScroll.querySelector(".sidebar-chapter-link.is-current");
      if (activeSidebarLink) {
        activeSidebarLink.scrollIntoView({ block: "nearest" });
      }
    }

    function syncViewModeUI() {
      if (!viewModeGroup) {
        return;
      }
      viewModeGroup.querySelectorAll("[data-view-mode]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.viewMode === viewMode);
      });
      syncSegmentedThumb(viewModeGroup);
    }

    if (viewModeGroup) {
      syncViewModeUI();
      viewModeGroup.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-view-mode]");
        if (!btn || btn.dataset.viewMode === viewMode) {
          return;
        }
        const filtered = getFilteredQuestions();
        const activeIdx = Math.max(
          0,
          filtered.findIndex((q) => q.id === activeQuestionId),
        );
        viewMode = btn.dataset.viewMode;
        saveViewMode(viewMode);
        currentPage = Math.floor(activeIdx / getPageSize());
        syncViewModeUI();
        renderPage(true);
      });
    }

    if (filterGroup) {
      filterGroup.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-question-filter]");
        if (!btn || btn.dataset.questionFilter === questionFilter) {
          return;
        }
        questionFilter = btn.dataset.questionFilter;
        currentPage = 0;
        filterGroup.querySelectorAll("[data-question-filter]").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
        });
        syncSegmentedThumb(filterGroup);
        renderPage(true);
      });
    }

    if (resetChapterBtn) {
      resetChapterBtn.addEventListener("click", () => {
        if (Object.keys(progress.answers).length === 0) {
          return;
        }
        if (window.confirm("确定要清空本章的作答记录吗？（收藏的题目不会受影响）")) {
          progress.answers = {};
          analysisOpen.clear();
          saveProgress();
          renderPage(true);
        }
      });
    }

    questionList.addEventListener("click", (event) => {
      const resetFilterBtn = event.target.closest("[data-reset-filter]");
      if (resetFilterBtn && filterGroup) {
        const allBtn = filterGroup.querySelector('[data-question-filter="all"]');
        if (allBtn) {
          allBtn.click();
        }
        return;
      }

      const cardEl = event.target.closest(".q-card");
      if (cardEl && cardEl.dataset.questionId) {
        activeQuestionId = cardEl.dataset.questionId;
        highlightActiveCard();
      }

      const optionBtn = event.target.closest("[data-option-label]");
      if (optionBtn) {
        const q = allQuestions.find((item) => item.id === optionBtn.dataset.questionId);
        if (q) {
          updateCardStateInPlace(q, optionBtn.dataset.optionLabel);
        }
        return;
      }

      const favBtn = event.target.closest(".favorite-toggle");
      if (favBtn) {
        const q = allQuestions.find((item) => item.id === favBtn.dataset.questionId);
        if (q) {
          toggleFavoriteInPlace(q);
        }
        return;
      }

      const analysisBtn = event.target.closest(".analysis-toggle");
      if (analysisBtn) {
        toggleAnalysisInPlace(analysisBtn.dataset.questionId);
      }
    });

    function goPrevPage() {
      if (currentPage > 0) {
        currentPage -= 1;
        renderPage(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }

    function goNextPage() {
      const filtered = getFilteredQuestions();
      const totalPages = Math.max(1, Math.ceil(filtered.length / getPageSize()));
      if (currentPage < totalPages - 1) {
        currentPage += 1;
        renderPage(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }

    pagePrevButtons.forEach((btn) => btn.addEventListener("click", goPrevPage));
    pageNextButtons.forEach((btn) => btn.addEventListener("click", goNextPage));

    document.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return;
      }

      const key = event.key;
      if (key === "ArrowLeft") {
        event.preventDefault();
        goPrevPage();
        return;
      }
      if (key === "ArrowRight") {
        event.preventDefault();
        goNextPage();
        return;
      }
      if (key === "[") {
        event.preventDefault();
        if (sidebarToggleButton) {
          sidebarToggleButton.click();
        }
        return;
      }

      const activeQuestion = allQuestions.find((item) => item.id === activeQuestionId);
      if (!activeQuestion) {
        return;
      }

      const upper = key.toUpperCase();
      if (["A", "B", "C", "D"].includes(upper)) {
        const hasOpt = activeQuestion.options.some((o) => o.label.toUpperCase() === upper);
        if (hasOpt) {
          event.preventDefault();
          updateCardStateInPlace(activeQuestion, upper);
        }
        return;
      }

      if (upper === "E" || key === " ") {
        if (tag !== "BUTTON") {
          event.preventDefault();
          toggleAnalysisInPlace(activeQuestion.id);
        }
        return;
      }

      if (upper === "S") {
        event.preventDefault();
        toggleFavoriteInPlace(activeQuestion);
      }
    });

    window.addEventListener("hashchange", () => {
      const qId = syncFromHash();
      renderPage(false);
      if (qId) {
        window.setTimeout(() => {
          const el = document.getElementById(`question-card-${qId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 60);
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === FAVORITES_STORAGE_KEY) {
        updateFavoritesCountIndicators();
        renderPage(false);
      }
    });

    const hashQId = syncFromHash();
    renderPage(false);
    if (hashQId && viewMode === "page") {
      window.setTimeout(() => {
        const el = document.getElementById(`question-card-${hashQId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 90);
    }
  }

  /* ==========================================================================
     10. Favorites Page Controller (Practice Self-Test Mode + Review Mode)
     ========================================================================== */
  function initFavoritesPage() {
    if (!favoritesPageRoot) {
      return;
    }

    const modeGroup = document.querySelector("[data-fav-mode-group]");
    const analysisOpen = new Set();
    const practiceAttempts = {};
    let favMode = "practice";
    let activeGroupKey = null;

    if (modeGroup) {
      modeGroup.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-fav-mode]");
        if (!btn || btn.dataset.favMode === favMode) {
          return;
        }
        favMode = btn.dataset.favMode;
        modeGroup.querySelectorAll("[data-fav-mode]").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
        });
        syncSegmentedThumb(modeGroup);
        renderFavoritesPage();
      });
    }

    function makeGroupKey(subjectId, chapterId) {
      return `${subjectId}:${chapterId}`;
    }

    function makeGroupHash(groupKey) {
      return `#favorites-${encodeURIComponent(groupKey)}`;
    }

    function getGroupKeyFromHash() {
      const match = window.location.hash.match(/^#favorites-(.+)$/);
      return match ? decodeURIComponent(match[1]) : null;
    }

    function groupFavorites(favorites) {
      const subjectsMap = new Map();
      favorites.forEach((item) => {
        if (!subjectsMap.has(item.subjectId)) {
          subjectsMap.set(item.subjectId, {
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            chaptersMap: new Map(),
          });
        }
        const subj = subjectsMap.get(item.subjectId);
        const gKey = makeGroupKey(item.subjectId, item.chapterId);
        if (!subj.chaptersMap.has(gKey)) {
          subj.chaptersMap.set(gKey, {
            key: gKey,
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            chapterId: item.chapterId,
            chapterName: item.chapterName,
            items: [],
          });
        }
        subj.chaptersMap.get(gKey).items.push(item);
      });

      return Array.from(subjectsMap.values())
        .map((s) => ({
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          chapters: Array.from(s.chaptersMap.values()).sort((a, b) =>
            compareNaturalText(a.chapterName, b.chapterName),
          ),
        }))
        .sort((a, b) => compareNaturalText(a.subjectName, b.subjectName));
    }

    function pickActiveGroup(groups) {
      if (groups.length === 0) {
        activeGroupKey = null;
        return null;
      }
      const available = new Set(groups.map((g) => g.key));
      const hashKey = getGroupKeyFromHash();
      if (hashKey && available.has(hashKey)) {
        activeGroupKey = hashKey;
        return groups.find((g) => g.key === hashKey) || null;
      }
      if (activeGroupKey && available.has(activeGroupKey)) {
        return groups.find((g) => g.key === activeGroupKey) || null;
      }
      activeGroupKey = groups[0].key;
      window.history.replaceState(null, "", makeGroupHash(activeGroupKey));
      return groups[0];
    }

    function renderDirectory(groupedSubjects, currentGroup) {
      return groupedSubjects
        .map((subj) => {
          const isOpen = currentGroup && currentGroup.subjectId === subj.subjectId ? " open" : "";
          const totalInSubj = subj.chapters.reduce((sum, ch) => sum + ch.items.length, 0);
          const chaptersHtml = subj.chapters
            .map((ch) => {
              const activeCls = currentGroup && ch.key === currentGroup.key ? "is-active" : "";
              return `
                <button type="button" class="fav-chapter-btn ${activeCls}" data-group-key="${escapeHtml(ch.key)}">
                  <span>${escapeHtml(ch.chapterName)}</span>
                  <strong>${ch.items.length}</strong>
                </button>
              `;
            })
            .join("");

          return `
            <details class="fav-subject-group"${isOpen}>
              <summary class="fav-subject-summary">
                <span>${escapeHtml(subj.subjectName)}</span>
                <span>${totalInSubj} 题</span>
              </summary>
              <div class="fav-chapter-list">${chaptersHtml}</div>
            </details>
          `;
        })
        .join("");
    }

    function renderFavoriteCard(item) {
      const isReview = favMode === "review";
      const selected = practiceAttempts[item.key] || null;
      const showAnswer = isReview || Boolean(selected);
      const isOpen = isReview || analysisOpen.has(item.key);

      const diffHtml = item.difficulty
        ? `<span class="q-difficulty-badge">${escapeHtml(item.difficulty)}</span>`
        : "";

      const optionsHtml = item.options
        .map((opt) => {
          const classes = ["q-option"];
          let iconHtml = "";
          if (showAnswer) {
            if (opt.label === item.answer) {
              classes.push("is-correct");
              iconHtml = ICON_CHECK;
            } else if (selected === opt.label) {
              classes.push("is-incorrect");
              iconHtml = ICON_CROSS;
            }
          }
          return `
            <button
              type="button"
              class="${classes.join(" ")}"
              data-fav-option="${escapeHtml(opt.label)}"
              data-favorite-key="${escapeHtml(item.key)}"
            >
              <span class="q-option-key">${escapeHtml(opt.label)}</span>
              <div class="q-option-body rendered-fragment">${opt.html}</div>
              ${iconHtml}
            </button>
          `;
        })
        .join("");

      let feedbackClass = "q-feedback";
      let feedbackText = "自测模式：点选选项检验掌握情况";
      if (isReview) {
        feedbackClass = "q-feedback is-correct";
        feedbackText = `正确答案：${item.answer}`;
      } else if (selected) {
        if (selected === item.answer) {
          feedbackClass = "q-feedback is-correct";
          feedbackText = `自测正确 · 答案 ${item.answer}`;
        } else {
          feedbackClass = "q-feedback is-incorrect";
          feedbackText = `自测错误 · 你选 ${selected}，正确答案 ${item.answer}`;
        }
      }

      return `
        <article class="q-card" data-fav-card="${escapeHtml(item.key)}">
          <div class="q-card-header">
            <div class="q-meta-left">
              <span class="q-index-badge">第 ${item.number} 题</span>
              ${diffHtml}
              <span class="fav-source-crumb">${escapeHtml(item.chapterName)}</span>
            </div>
            <div class="q-meta-actions">
              <a class="q-icon-action" href="${escapeHtml(item.questionUrl)}">原题位置 ↗</a>
              <button type="button" class="q-icon-action favorite-remove" data-favorite-key="${escapeHtml(item.key)}">
                移除收藏
              </button>
            </div>
          </div>

          <div class="q-prompt rendered-fragment">${item.prompt_html}</div>
          <div class="q-options">${optionsHtml}</div>

          <div class="q-footer">
            <div class="${feedbackClass}">${escapeHtml(feedbackText)}</div>
            <button
              type="button"
              class="q-analysis-btn analysis-toggle ${isOpen ? "is-open" : ""}"
              data-favorite-key="${escapeHtml(item.key)}"
            >
              <span>${isOpen ? "收起解析" : "查看解析"}</span>
              ${ICON_CHEVRON_DOWN}
            </button>
          </div>

          <div class="q-analysis-collapse ${isOpen ? "is-open" : ""}" data-fav-analysis="${escapeHtml(item.key)}">
            <div class="q-analysis-inner">
              <div class="q-analysis-card">
                <div class="q-analysis-title">推导与解析</div>
                <div class="rendered-fragment">${item.analysis_html}</div>
              </div>
            </div>
          </div>
        </article>
      `;
    }

    function renderFavoritesPage() {
      const favorites = getSortedFavorites();
      updateFavoritesCountIndicators();

      if (favorites.length === 0) {
        favoritesPageRoot.innerHTML = `
          <div class="empty-card">
            <p>当前还没有收藏任何题目。</p>
            <p>在章节刷题页点击「☆ 收藏」或按键盘 <kbd>S</kbd>，重点题与易错题会自动归档到这里。</p>
          </div>
        `;
        return;
      }

      const grouped = groupFavorites(favorites);
      const flatGroups = grouped.flatMap((s) => s.chapters);
      const currentGroup = pickActiveGroup(flatGroups);
      if (!currentGroup) {
        return;
      }

      favoritesPageRoot.innerHTML = `
        <div class="favorites-layout">
          <aside class="favorites-sidebar" aria-label="收藏目录">
            ${renderDirectory(grouped, currentGroup)}
          </aside>
          <div class="favorites-stream-col">
            <div class="favorites-group-banner">
              <h2>${escapeHtml(currentGroup.subjectName)} · ${escapeHtml(currentGroup.chapterName)}</h2>
              <span>本章收藏 ${currentGroup.items.length} 题</span>
            </div>
            <div class="question-stream">
              ${currentGroup.items.map(renderFavoriteCard).join("")}
            </div>
          </div>
        </div>
      `;
      renderMathInRoot(favoritesPageRoot);
    }

    favoritesPageRoot.addEventListener("click", (event) => {
      const groupBtn = event.target.closest("[data-group-key]");
      if (groupBtn) {
        activeGroupKey = groupBtn.dataset.groupKey;
        window.history.replaceState(null, "", makeGroupHash(activeGroupKey));
        renderFavoritesPage();
        return;
      }

      const optBtn = event.target.closest("[data-fav-option]");
      if (optBtn && favMode === "practice") {
        const fKey = optBtn.dataset.favoriteKey;
        practiceAttempts[fKey] = optBtn.dataset.favOption;
        renderFavoritesPage();
        return;
      }

      const removeBtn = event.target.closest(".favorite-remove");
      if (removeBtn) {
        const fKey = removeBtn.dataset.favoriteKey;
        analysisOpen.delete(fKey);
        delete practiceAttempts[fKey];
        removeFavoriteByKey(fKey);
        renderFavoritesPage();
        return;
      }

      const analysisBtn = event.target.closest(".analysis-toggle");
      if (analysisBtn) {
        const fKey = analysisBtn.dataset.favoriteKey;
        const collapseEl = favoritesPageRoot.querySelector(`[data-fav-analysis="${CSS.escape(fKey)}"]`);
        if (analysisOpen.has(fKey)) {
          analysisOpen.delete(fKey);
        } else {
          analysisOpen.add(fKey);
        }
        const nowOpen = analysisOpen.has(fKey);
        if (collapseEl) {
          collapseEl.classList.toggle("is-open", nowOpen);
          analysisBtn.classList.toggle("is-open", nowOpen);
          const sp = analysisBtn.querySelector("span");
          if (sp) {
            sp.textContent = nowOpen ? "收起解析" : "查看解析";
          }
        } else {
          renderFavoritesPage();
        }
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === FAVORITES_STORAGE_KEY) {
        renderFavoritesPage();
      }
    });

    window.addEventListener("hashchange", () => {
      if (window.location.hash.startsWith("#favorites-")) {
        renderFavoritesPage();
      }
    });

    renderFavoritesPage();
  }

  /* ==========================================================================
     11. Bootstrap
     ========================================================================== */
  initThemeControls();
  initAllSegmentedThumbs();
  initSlidingTopNav();
  initScrollRevealAndCounters();
  renderMathInRoot(document);
  updateFavoritesCountIndicators();

  initHomePage();
  initSubjectPage();

  if (window.CHAPTER_DATA && window.QUIZ_CONTEXT && Array.isArray(window.CHAPTER_DATA.questions)) {
    initChapterPage(window.CHAPTER_DATA, window.QUIZ_CONTEXT);
  }

  initFavoritesPage();
})();
