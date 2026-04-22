(function () {
  const FAVORITES_STORAGE_KEY = "quiz-favorites:v1";
  const favoritesPageRoot = document.getElementById("favorites-page-root");

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
    window.localStorage.setItem(key, JSON.stringify(value));
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
      header: question.header || `#${question.number}`,
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
    const countElements = document.querySelectorAll("[data-favorites-count]");
    if (countElements.length === 0) {
      return;
    }

    countElements.forEach((element) => {
      element.textContent = `${count} 道收藏题`;
    });
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
    return Object.values(loadFavoritesStore().items).sort((left, right) => right.addedAt - left.addedAt);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function initChapterPage(chapterData, quizContext) {
    const pageQuestionSummary = document.getElementById("page-question-summary");
    const progressSummary = document.getElementById("progress-summary");
    const navPageIndicator = document.getElementById("nav-page-indicator");
    const pagePrevButtons = Array.from(document.querySelectorAll('[data-page-nav="prev"]'));
    const pageNextButtons = Array.from(document.querySelectorAll('[data-page-nav="next"]'));
    const questionList = document.getElementById("question-list");
    const chapterLayout = document.querySelector(".chapter-layout");
    const sidebarToggleButton = document.getElementById("sidebar-toggle-button");

    const pageSize = 10;
    const questions = chapterData.questions;
    if (questions.length === 0) {
      return;
    }

    const totalPages = Math.ceil(questions.length / pageSize);
    const stateKey = `quiz-progress:${quizContext.subjectId}:${quizContext.chapterId}`;
    const sidebarStateKey = `quiz-sidebar:${quizContext.subjectId}`;
    let currentPage = 0;
    const progress = loadProgress();
    const analysisOpen = new Set();

    function loadProgress() {
      const parsed = loadStoredJson(stateKey, { answers: {} });
      return {
        answers: parsed && typeof parsed.answers === "object" ? parsed.answers : {},
      };
    }

    function saveProgress() {
      saveStoredJson(stateKey, progress);
    }

    function getQuestionState(question) {
      return progress.answers[question.id] || null;
    }

    function setQuestionState(question, selectedLabel) {
      progress.answers[question.id] = {
        selected: selectedLabel,
        correct: selectedLabel === question.answer,
      };
      saveProgress();
    }

    function getPageQuestions() {
      const start = currentPage * pageSize;
      return questions.slice(start, start + pageSize);
    }

    function getHashQuestionId() {
      const match = window.location.hash.match(/^#question-card-(.+)$/);
      return match ? match[1] : null;
    }

    function syncPageFromHash() {
      const questionId = getHashQuestionId();
      if (!questionId) {
        return null;
      }
      const questionIndex = questions.findIndex((item) => item.id === questionId);
      if (questionIndex >= 0) {
        currentPage = Math.floor(questionIndex / pageSize);
      }
      return questionId;
    }

    function scrollToQuestionCard(questionId) {
      if (!questionId) {
        return;
      }
      const target = document.getElementById(`question-card-${questionId}`);
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderSummaryChips(pageQuestions) {
      if (!pageQuestionSummary) {
        return;
      }
      pageQuestionSummary.innerHTML = "";

      pageQuestions.forEach((question) => {
        const chip = document.createElement("div");
        chip.className = "question-nav-item";
        chip.textContent = String(question.number);

        const state = getQuestionState(question);
        if (state) {
          chip.classList.add(state.correct ? "correct" : "incorrect");
        }

        if (isQuestionFavorited(quizContext, question)) {
          chip.classList.add("favorited");
        }

        pageQuestionSummary.appendChild(chip);
      });
    }

    function renderQuestionCard(question) {
      const state = getQuestionState(question);
      const difficulty = question.difficulty ? ` · ${escapeHtml(question.difficulty)}` : "";
      const analysisVisible = analysisOpen.has(question.id);
      const favoriteActive = isQuestionFavorited(quizContext, question);
      const judgeClass = state ? (state.correct ? "judge-result correct" : "judge-result incorrect") : "judge-result";
      let judgeText = "请选择一个选项，系统会立即判题。";
      if (state?.correct) {
        judgeText = `回答正确。正确答案：${question.answer}`;
      } else if (state && !state.correct) {
        judgeText = `回答错误。你选了 ${state.selected}，正确答案是 ${question.answer}`;
      }

      const optionsHtml = question.options
        .map((option) => {
          const classes = ["option-card"];
          if (state) {
            if (option.label === question.answer) {
              classes.push("correct");
            }
            if (state.selected === option.label && state.selected !== question.answer) {
              classes.push("incorrect");
            }
          }
          return `
            <button
              type="button"
              class="${classes.join(" ")}"
              data-question-id="${question.id}"
              data-option-label="${option.label}"
            >
              <span class="option-label">${option.label}</span>
              <div class="rendered-fragment">${option.html}</div>
            </button>
          `;
        })
        .join("");

      return `
        <article class="batch-question-card" id="question-card-${question.id}" data-question-id="${question.id}">
          <div class="batch-question-head">
            <div>
              <p class="batch-question-index">第 ${question.number} 题${difficulty}</p>
              <h3>${escapeHtml(question.header || `#${question.number}`)}</h3>
            </div>
          </div>

          <div class="question-block">
            <h4>题干</h4>
            <div class="rendered-fragment">${question.prompt_html}</div>
          </div>

          <div class="question-block">
            <h4>选项</h4>
            <div class="options-list">${optionsHtml}</div>
          </div>

          <div class="${judgeClass}">${judgeText}</div>

          <div class="question-card-toolbar">
            <button
              type="button"
              class="ghost-button favorite-toggle ${favoriteActive ? "active" : ""}"
              data-question-id="${question.id}"
            >
              ${favoriteActive ? "已收藏本题" : "收藏本题"}
            </button>
            <button type="button" class="ghost-button analysis-toggle" data-question-id="${question.id}">
              ${analysisVisible ? "收起解析" : "显示解析"}
            </button>
          </div>

          <div class="inline-analysis ${analysisVisible ? "" : "hidden"}" data-question-id="${question.id}">
            <div class="inline-analysis-head">解析</div>
            <div class="rendered-fragment">${question.analysis_html}</div>
          </div>
        </article>
      `;
    }

    function renderPage() {
      const pageQuestions = getPageQuestions();
      questionList.innerHTML = pageQuestions.map(renderQuestionCard).join("");
      renderSummaryChips(pageQuestions);

      const answeredCount = Object.keys(progress.answers).length;
      const correctCount = Object.values(progress.answers).filter((item) => item.correct).length;
      progressSummary.textContent = `已作答 ${answeredCount}/${questions.length}，答对 ${correctCount} 题`;
      navPageIndicator.textContent = `${currentPage + 1} / ${totalPages} 页`;

      pagePrevButtons.forEach((button) => {
        button.disabled = currentPage === 0;
      });
      pageNextButtons.forEach((button) => {
        button.disabled = currentPage >= totalPages - 1;
      });
    }

    function applySidebarState(collapsed) {
      if (!chapterLayout || !sidebarToggleButton) {
        return;
      }
      chapterLayout.classList.toggle("sidebar-collapsed", collapsed);
      sidebarToggleButton.textContent = collapsed ? "展开章节栏" : "收起章节栏";
      sidebarToggleButton.setAttribute("aria-expanded", String(!collapsed));
      saveStoredJson(sidebarStateKey, { collapsed });
    }

    function loadSidebarState() {
      if (!chapterLayout || !sidebarToggleButton) {
        return;
      }
      const parsed = loadStoredJson(sidebarStateKey, null);
      const collapsed = Boolean(parsed?.collapsed);
      applySidebarState(collapsed);
    }

    questionList.addEventListener("click", (event) => {
      const optionButton = event.target.closest("[data-option-label]");
      if (optionButton) {
        const question = questions.find((item) => item.id === optionButton.dataset.questionId);
        if (!question) {
          return;
        }
        setQuestionState(question, optionButton.dataset.optionLabel);
        renderPage();
        return;
      }

      const favoriteButton = event.target.closest(".favorite-toggle");
      if (favoriteButton) {
        const question = questions.find((item) => item.id === favoriteButton.dataset.questionId);
        if (!question) {
          return;
        }
        toggleFavorite(quizContext, question);
        renderPage();
        return;
      }

      const analysisButton = event.target.closest(".analysis-toggle");
      if (analysisButton) {
        const questionId = analysisButton.dataset.questionId;
        if (analysisOpen.has(questionId)) {
          analysisOpen.delete(questionId);
        } else {
          analysisOpen.add(questionId);
        }
        renderPage();
      }
    });

    pagePrevButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (currentPage > 0) {
          currentPage -= 1;
          renderPage();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    pageNextButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (currentPage < totalPages - 1) {
          currentPage += 1;
          renderPage();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    if (sidebarToggleButton && chapterLayout) {
      sidebarToggleButton.addEventListener("click", () => {
        const collapsed = !chapterLayout.classList.contains("sidebar-collapsed");
        applySidebarState(collapsed);
      });
    }

    window.addEventListener("hashchange", () => {
      const questionId = syncPageFromHash();
      renderPage();
      if (questionId) {
        window.setTimeout(() => scrollToQuestionCard(questionId), 80);
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === FAVORITES_STORAGE_KEY) {
        renderPage();
        updateFavoritesCountIndicators();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" && currentPage > 0) {
        currentPage -= 1;
        renderPage();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (event.key === "ArrowRight" && currentPage < totalPages - 1) {
        currentPage += 1;
        renderPage();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    const initialHashQuestionId = syncPageFromHash();
    loadSidebarState();
    renderPage();
    if (initialHashQuestionId) {
      window.setTimeout(() => scrollToQuestionCard(initialHashQuestionId), 120);
    }
  }

  function initFavoritesPage() {
    if (!favoritesPageRoot) {
      return;
    }

    const analysisOpen = new Set();
    let activeGroupKey = null;

    function makeFavoritesGroupKey(subjectId, chapterId) {
      return `${subjectId}:${chapterId}`;
    }

    function makeFavoritesGroupHash(groupKey) {
      return `#favorites-${encodeURIComponent(groupKey)}`;
    }

    function getActiveGroupKeyFromHash() {
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

        const subject = subjectsMap.get(item.subjectId);
        const groupKey = makeFavoritesGroupKey(item.subjectId, item.chapterId);
        if (!subject.chaptersMap.has(groupKey)) {
          subject.chaptersMap.set(groupKey, {
            key: groupKey,
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            chapterId: item.chapterId,
            chapterName: item.chapterName,
            items: [],
          });
        }

        subject.chaptersMap.get(groupKey).items.push(item);
      });

      return Array.from(subjectsMap.values())
        .map((subject) => ({
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          chapters: Array.from(subject.chaptersMap.values()).sort((left, right) =>
            left.chapterName.localeCompare(right.chapterName, "zh-Hans-CN"),
          ),
        }))
        .sort((left, right) => left.subjectName.localeCompare(right.subjectName, "zh-Hans-CN"));
    }

    function flattenGroups(groupedSubjects) {
      return groupedSubjects.flatMap((subject) => subject.chapters);
    }

    function pickActiveGroup(groups) {
      if (groups.length === 0) {
        activeGroupKey = null;
        return null;
      }

      const hashGroupKey = getActiveGroupKeyFromHash();
      const availableKeys = new Set(groups.map((group) => group.key));

      if (hashGroupKey && availableKeys.has(hashGroupKey)) {
        activeGroupKey = hashGroupKey;
        return groups.find((group) => group.key === hashGroupKey) || null;
      }

      if (activeGroupKey && availableKeys.has(activeGroupKey)) {
        return groups.find((group) => group.key === activeGroupKey) || null;
      }

      activeGroupKey = groups[0].key;
      if (window.location.hash !== makeFavoritesGroupHash(activeGroupKey)) {
        window.history.replaceState(null, "", makeFavoritesGroupHash(activeGroupKey));
      }
      return groups[0];
    }

    function renderDirectory(groupedSubjects, currentGroup) {
      return groupedSubjects
        .map((subject) => {
          const openAttr = currentGroup && currentGroup.subjectId === subject.subjectId ? " open" : "";
          const chaptersHtml = subject.chapters
            .map((chapter) => {
              const activeClass = currentGroup && chapter.key === currentGroup.key ? "active" : "";
              return `
                <button
                  type="button"
                  class="favorites-directory-link ${activeClass}"
                  data-group-key="${chapter.key}"
                >
                  <span>${escapeHtml(chapter.chapterName)}</span>
                  <strong>${chapter.items.length} 题</strong>
                </button>
              `;
            })
            .join("");

          const subjectCount = subject.chapters.reduce((sum, chapter) => sum + chapter.items.length, 0);
          return `
            <details class="favorites-directory-subject"${openAttr}>
              <summary class="favorites-directory-summary">
                <span>${escapeHtml(subject.subjectName)}</span>
                <strong>${subjectCount} 题</strong>
              </summary>
              <div class="favorites-directory-chapters">
                ${chaptersHtml}
              </div>
            </details>
          `;
        })
        .join("");
    }

    function renderFavoriteCard(item) {
      const difficulty = item.difficulty ? ` · ${escapeHtml(item.difficulty)}` : "";
      const analysisVisible = analysisOpen.has(item.key);
      const optionsHtml = item.options
        .map(
          (option) => `
            <div class="option-card option-static">
              <span class="option-label">${option.label}</span>
              <div class="rendered-fragment">${option.html}</div>
            </div>
          `,
        )
        .join("");

      return `
        <article class="batch-question-card favorite-question-card">
          <div class="favorite-origin">
            <span>${escapeHtml(item.subjectName)}</span>
            <span>/</span>
            <span>${escapeHtml(item.chapterName)}</span>
          </div>

          <div class="batch-question-head">
            <div>
              <p class="batch-question-index">第 ${item.number} 题${difficulty}</p>
              <h3>${escapeHtml(item.header)}</h3>
            </div>
            <div class="batch-question-actions">
              <a class="ghost-link favorite-source-link" href="${item.questionUrl}">查看原题</a>
              <button type="button" class="ghost-button favorite-remove" data-favorite-key="${item.key}">取消收藏</button>
              <button type="button" class="ghost-button analysis-toggle" data-favorite-key="${item.key}">
                ${analysisVisible ? "收起解析" : "显示解析"}
              </button>
            </div>
          </div>

          <div class="question-block">
            <h4>题干</h4>
            <div class="rendered-fragment">${item.prompt_html}</div>
          </div>

          <div class="question-block">
            <h4>选项</h4>
            <div class="options-list">${optionsHtml}</div>
          </div>

          <div class="judge-result correct">正确答案：${item.answer}</div>

          <div class="inline-analysis ${analysisVisible ? "" : "hidden"}">
            <div class="inline-analysis-head">解析</div>
            <div class="rendered-fragment">${item.analysis_html}</div>
          </div>
        </article>
      `;
    }

    function setActiveGroup(groupKey) {
      activeGroupKey = groupKey;
      const nextHash = makeFavoritesGroupHash(groupKey);
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash);
      }
      renderFavoritesPage();
    }

    function renderFavoritesPage() {
      const favorites = getSortedFavorites();
      updateFavoritesCountIndicators();

      if (favorites.length === 0) {
        favoritesPageRoot.innerHTML = `
          <section class="empty-state">
            当前还没有收藏题目。去章节页点击“收藏”，这里会自动汇总显示。
          </section>
        `;
        return;
      }

      const groupedSubjects = groupFavorites(favorites);
      const groups = flattenGroups(groupedSubjects);
      const currentGroup = pickActiveGroup(groups);
      if (!currentGroup) {
        favoritesPageRoot.innerHTML = `
          <section class="empty-state">
            当前还没有收藏题目。去章节页点击“收藏”，这里会自动汇总显示。
          </section>
        `;
        return;
      }

      favoritesPageRoot.innerHTML = `
        <div class="favorites-toolbar">
          <p class="favorites-toolbar-copy">共 ${favorites.length} 道收藏题，已按科目和章节分组。点击左侧目录切换章节，右侧显示该章节的收藏题。</p>
        </div>
        <section class="favorites-layout">
          <aside class="favorites-directory">
            <div class="favorites-directory-head">
              <h2>收藏目录</h2>
              <p>按科目展开，再点章节进入。</p>
            </div>
            <div class="favorites-directory-list">
              ${renderDirectory(groupedSubjects, currentGroup)}
            </div>
          </aside>

          <section class="favorites-content">
            <div class="favorites-current-group">
              <div>
                <p class="eyebrow">当前章节</p>
                <h2>${escapeHtml(currentGroup.subjectName)} / ${escapeHtml(currentGroup.chapterName)}</h2>
              </div>
              <span class="home-meta-pill">${currentGroup.items.length} 道收藏题</span>
            </div>
            <section class="favorites-list">
              ${currentGroup.items.map(renderFavoriteCard).join("")}
            </section>
          </section>
        </section>
      `;
    }

    favoritesPageRoot.addEventListener("click", (event) => {
      const groupButton = event.target.closest(".favorites-directory-link");
      if (groupButton) {
        setActiveGroup(groupButton.dataset.groupKey);
        return;
      }

      const removeButton = event.target.closest(".favorite-remove");
      if (removeButton) {
        const favoriteKey = removeButton.dataset.favoriteKey;
        analysisOpen.delete(favoriteKey);
        removeFavoriteByKey(favoriteKey);
        renderFavoritesPage();
        return;
      }

      const analysisButton = event.target.closest(".analysis-toggle");
      if (analysisButton) {
        const favoriteKey = analysisButton.dataset.favoriteKey;
        if (analysisOpen.has(favoriteKey)) {
          analysisOpen.delete(favoriteKey);
        } else {
          analysisOpen.add(favoriteKey);
        }
        renderFavoritesPage();
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

    updateFavoritesCountIndicators();
    renderFavoritesPage();
  }

  const chapterData = window.CHAPTER_DATA;
  const quizContext = window.QUIZ_CONTEXT;
  if (chapterData && quizContext && Array.isArray(chapterData.questions)) {
    initChapterPage(chapterData, quizContext);
  }

  initFavoritesPage();
  updateFavoritesCountIndicators();
})();
