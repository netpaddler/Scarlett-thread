(function () {
  "use strict";

  var KIND_LABELS = {
    person: "Person",
    place: "Place",
    event: "Event",
    promise: "Promise",
    covenant: "Covenant",
    prophecy: "Prophecy",
    teaching: "Teaching"
  };

  var EDGE_LABELS = {
    prophecy_fulfillment: "A promise kept",
    promise_narrowing: "The promise gets clearer",
    family_line: "Family",
    event_sequence: "What happened next",
    place_link: "A place",
    type_to_christ: "A picture of Jesus"
  };

  var KIND_GLOSS = {
    promise: "A promise is something God says he will do.",
    covenant: "A covenant is a promise God makes and keeps.",
    prophecy: "A prophecy is God telling what he will do."
  };

  var PATH_LINE = {
    week1_seed: "God makes a promise, and each stop makes it clearer.",
    week2_king: "The promise becomes a king from David's family.",
    week3_sign: "God gives a sign. A son will be born, and God will be with us.",
    week4_town: "The king will come from a town most people would overlook.",
    christmas: "The promise arrives. Jesus is born."
  };

  var KIND_ORDER = ["promise", "covenant", "prophecy", "person", "place", "event", "teaching"];
  var EDGE_ORDER = [
    "prophecy_fulfillment",
    "promise_narrowing",
    "family_line",
    "event_sequence",
    "place_link",
    "type_to_christ"
  ];

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  var SITE_NAME = "Scarlet Thread";
  var THEME_COLORS = { light: "#f6f1e8", dark: "#15120f" };
  var GRAPH_FONT = '"Source Serif 4", "Iowan Old Style", Georgia, serif';
  var FOCAL = { jesus: true, jesus_birth: true };
  var NODE_SIZE = { w: 136, h: 58 };
  var FOCAL_SIZE = { w: 160, h: 88 };
  var READABLE_ZOOM = 0.74;
  var PHONE_QUERY = "(max-width: 959px)";

  var data = null;
  var sermons = {};
  var confessions = null;
  var deeper = null;
  var nodesById = new Map();
  var exploreCy = null;
  var graphPending = false;
  var fontsReady = Promise.resolve();
  var state = {
    mode: "walk",
    pathId: null,
    step: 0,
    selectedId: null,
    hideTypology: false
  };

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    var props = attrs || {};
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = String(value);
      else if (key === "hidden") node.hidden = true;
      else if (key.slice(0, 2) === "on" && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node.setAttribute(key, String(value));
    });
    (children || []).forEach(function (child) {
      if (child != null) node.append(child);
    });
    return node;
  }

  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isPhone() {
    return window.matchMedia(PHONE_QUERY).matches;
  }

  function topbarHeight() {
    var bar = document.querySelector(".topbar");
    return bar ? bar.getBoundingClientRect().height : 0;
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function kindLabel(type) {
    return KIND_LABELS[type] || String(type || "").replace(/_/g, " ");
  }

  function edgeLabel(type) {
    return EDGE_LABELS[type] || String(type || "").replace(/_/g, " ");
  }

  function confidenceCopy(flag) {
    if (flag === "explicit") {
      return "The New Testament itself makes this connection.";
    }
    if (flag === "typology") {
      return "This is a picture of Jesus. Typology is the old word for that kind of picture. Christians who trust the Bible do not all see it the same way.";
    }
    return flag || "";
  }

  function formatMonthDay(iso) {
    if (!iso) return "";
    var parts = iso.split("-").map(Number);
    if (parts.length !== 3 || parts.some(function (n) { return !Number.isFinite(n); })) return iso;
    return MONTHS[parts[1] - 1] + " " + parts[2];
  }

  function formatDate(iso) {
    if (!iso) return "";
    var parts = iso.split("-").map(Number);
    if (parts.length !== 3 || parts.some(function (n) { return !Number.isFinite(n); })) return iso;
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return WEEKDAYS[date.getUTCDay()] + ", " + MONTHS[date.getUTCMonth()] + " " + date.getUTCDate() + ", " + date.getUTCFullYear();
  }

  function currentPath() {
    return data.paths.find(function (path) { return path.id === state.pathId; }) || data.paths[0];
  }

  function pathIndex(id) {
    return data.paths.findIndex(function (path) { return path.id === id; });
  }

  function nodeById(id) {
    return nodesById.get(id) || null;
  }

  function edgesBetween(a, b) {
    return data.edges.filter(function (edge) {
      return (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a);
    });
  }

  function setTitle(prefix) {
    document.title = prefix ? prefix + " \u00b7 " + SITE_NAME : SITE_NAME + ": an Advent walk through the Bible";
  }

  /* Sermons */

  function sermonsFor(nodeId) {
    var list = sermons[nodeId];
    return Array.isArray(list) ? list : [];
  }

  function youtubeId(url) {
    try {
      return new URL(url).searchParams.get("v");
    } catch (err) {
      return null;
    }
  }

  function renderSermon(sermon) {
    var article = h("article", { class: "sermon" });
    var titleLink = h("a", {
      href: sermon.url,
      target: "_blank",
      rel: "noopener noreferrer",
      text: sermon.title || "Sermon"
    });
    var title = h("h5", { class: "sermon-title" });
    title.append(titleLink);
    article.append(title);
    var meta = [sermon.preacher, sermon.date ? formatDate(sermon.date) : ""].filter(Boolean).join(", ");
    if (meta) article.append(h("p", { class: "sermon-meta", text: meta }));
    if (sermon.text) article.append(h("p", { class: "sermon-text", text: "Scripture: " + sermon.text }));
    if (sermon.match === "thematic") {
      article.append(h("p", { class: "sermon-note", text: "This sermon is mainly about another passage, and it teaches this one too." }));
    }
    var actions = h("div", { class: "sermon-actions" });
    actions.append(h("a", {
      class: "sermon-watch",
      href: sermon.url,
      target: "_blank",
      rel: "noopener noreferrer",
      text: "Watch on YouTube"
    }));
    var player = h("div", { class: "sermon-player", hidden: true });
    var videoId = youtubeId(sermon.url);
    if (videoId) {
      var play = h("button", {
        type: "button",
        class: "sermon-play",
        text: "Play here",
        onClick: function () {
          if (player.childElementCount) return;
          var start = Number(sermon.start_seconds);
          var src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId) + "?rel=0";
          if (Number.isFinite(start) && start > 0) src += "&start=" + Math.floor(start);
          src += "&autoplay=1";
          var iframe = document.createElement("iframe");
          iframe.src = src;
          iframe.title = (sermon.title || "Sermon") + ", Faith Presbyterian";
          iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
          iframe.setAttribute("allowfullscreen", "");
          iframe.setAttribute("loading", "lazy");
          player.append(iframe);
          player.hidden = false;
          play.hidden = true;
        }
      });
      actions.append(play);
    }
    article.append(actions, player);
    return article;
  }

  function appendSermons(parent, nodeId) {
    var list = sermonsFor(nodeId);
    if (!list.length) return;
    var section = h("section", { class: "sermons" });
    section.setAttribute("aria-label", "Hear a sermon from Faith Presbyterian");
    section.append(h("h4", { class: "section-label", text: "Hear a sermon" }));
    section.append(h("p", { class: "hint", text: "From Faith Presbyterian Church in Tacoma." }));
    list.forEach(function (sermon) { section.append(renderSermon(sermon)); });
    parent.append(section);
  }

  /* Reading layers */

  function fold(summaryText, subText, fill) {
    var body = h("div", { class: "fold-body" });
    fill(body);
    if (!body.childNodes.length) return null;
    var details = h("details", { class: "fold" });
    var summary = h("summary");
    summary.append(h("span", { class: "fold-title", text: summaryText }));
    if (subText) summary.append(h("span", { class: "fold-sub", text: subText }));
    summary.append(h("span", { class: "fold-icon", "aria-hidden": "true" }));
    details.append(summary, body);
    return details;
  }

  function toggleFold(details) {
    var body = details.querySelector(":scope > .fold-body");
    if (!body || reducedMotion() || typeof body.animate !== "function") {
      details.open = !details.open;
      return;
    }
    if (details._anim) details._anim.cancel();
    var opening = !details.open;
    var from = opening ? 0 : body.offsetHeight;
    if (opening) details.open = true;
    var to = opening ? body.offsetHeight : 0;
    var anim = body.animate(
      [
        { height: from + "px", opacity: opening ? 0 : 1 },
        { height: to + "px", opacity: opening ? 1 : 0 }
      ],
      { duration: opening ? 320 : 240, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }
    );
    details._anim = anim;
    anim.onfinish = function () {
      details._anim = null;
      if (!opening) details.open = false;
    };
    anim.oncancel = function () {
      details._anim = null;
    };
  }

  function appendStart(parent, node) {
    if (KIND_GLOSS[node.type]) parent.append(h("p", { class: "gloss", text: KIND_GLOSS[node.type] }));
    if (node.summary) parent.append(h("p", { class: "summary", text: node.summary }));
    if (node.quote && node.quote.text) {
      var figure = h("figure", { class: "quote" });
      var quote = h("blockquote", { text: node.quote.text });
      quote.setAttribute("translate", "no");
      figure.append(quote);
      if (node.quote.ref) figure.append(h("figcaption", { text: node.quote.ref }));
      parent.append(figure);
    }
  }

  function confessionItems(group, id) {
    if (!confessions || !confessions[group] || !confessions[group][id]) return [];
    return confessions[group][id].filter(function (item) {
      return confessions.sections && confessions.sections[item.section];
    });
  }

  function appendStandards(parent, items) {
    items.forEach(function (item) {
      var section = confessions.sections[item.section];
      var work = confessions.meta && confessions.meta.works ? confessions.meta.works[section.work] : null;
      var block = h("article", { class: "confession" });
      var cite = h("p", { class: "confession-cite" });
      if (work && work.url) {
        cite.append(h("a", {
          href: work.url,
          target: "_blank",
          rel: "noopener noreferrer",
          text: section.cite
        }));
      } else {
        cite.textContent = section.cite;
      }
      block.append(cite);
      if (item.line) block.append(h("p", { class: "confession-line", text: item.line }));
      if (item.explain) block.append(h("p", { text: item.explain }));
      block.append(h("blockquote", { class: "confession-text", text: section.text }));
      var proofs = item.relevant_proofs || section.proofs;
      if (proofs) {
        block.append(h("p", {
          class: "hint",
          text: "Scripture proofs printed with this section: " + proofs
        }));
      }
      parent.append(block);
    });
  }

  function makeDeepest(group, id, label, sub) {
    var items = confessionItems(group, id);
    var theology = confessions && confessions.theology && confessions.theology[group]
      ? confessions.theology[group][id]
      : "";
    if (!items.length && !theology) return null;
    return fold(label, sub, function (body) {
      body.append(h("p", {
        class: "hint",
        text: "These words are from the Westminster Standards. Reformed churches use them to say, carefully, what the Bible teaches. The quotations are the modern spelling text from the Orthodox Presbyterian Church."
      }));
      if (theology) {
        body.append(h("h4", { class: "section-label", text: "In Reformed theology" }));
        body.append(h("p", { text: theology }));
      }
      appendStandards(body, items);
    });
  }

  function addParagraphs(parent, list) {
    (list || []).forEach(function (text) {
      if (text) parent.append(h("p", { text: text }));
    });
  }

  function appendRichDeeper(parent, entry) {
    if (!entry) return;
    if (entry.context && entry.context.length) {
      parent.append(h("h4", { class: "section-label", text: "The story" }));
      addParagraphs(parent, entry.context);
    }
    if (entry.passages && entry.passages.length) {
      parent.append(h("h4", { class: "section-label", text: "Key passages" }));
      entry.passages.forEach(function (passage) {
        var block = h("figure", { class: "deeper-passage" });
        var quote = h("blockquote", { text: passage.text });
        quote.setAttribute("translate", "no");
        block.append(quote);
        if (passage.ref) block.append(h("figcaption", { text: passage.ref }));
        parent.append(block);
      });
    }
    if (entry.cross_refs && entry.cross_refs.length) {
      parent.append(h("p", { class: "hint", text: "Also read: " + entry.cross_refs.join(", ") }));
    }
    if (entry.connections && entry.connections.length) {
      parent.append(h("h4", { class: "section-label", text: "How it connects" }));
      entry.connections.forEach(function (link) {
        var other = nodeById(link.other);
        var name = other ? other.label : link.other;
        var heading = link.direction === "from" ? "From " + name : "To " + name;
        var block = h("div", { class: "edge-block" });
        block.append(h("p", { class: "next-label", text: heading }));
        if (link.confidence) {
          block.append(h("p", { class: "badge " + link.confidence, text: confidenceCopy(link.confidence) }));
        }
        if (link.text) block.append(h("p", { text: link.text }));
        parent.append(block);
      });
    }
    if (entry.nt && entry.nt.length) {
      parent.append(h("h4", { class: "section-label", text: "How the New Testament reads it" }));
      addParagraphs(parent, entry.nt);
    }
    if (entry.word_study && entry.word_study.text) {
      var title = entry.word_study.term ? "A word: " + entry.word_study.term : "A word to know";
      parent.append(h("h4", { class: "section-label", text: title }));
      parent.append(h("p", { text: entry.word_study.text }));
    }
    if (entry.questions && entry.questions.length) {
      parent.append(h("h4", { class: "section-label", text: "Questions to think about" }));
      var list = h("ol", { class: "deeper-questions" });
      entry.questions.forEach(function (question) {
        list.append(h("li", { text: question }));
      });
      parent.append(list);
    }
  }

  function deeperEntry(group, id) {
    if (!deeper || !deeper[group]) return null;
    return deeper[group][id] || null;
  }

  function appendLayers(parent, node) {
    var deeperFold = fold("Go deeper", "The verses, the story, and how the lines connect", function (body) {
      appendRichDeeper(body, deeperEntry("nodes", node.id));
    });
    if (deeperFold) parent.append(deeperFold);
    var deepest = makeDeepest("nodes", node.id, "Go deepest", "What the Westminster Standards say");
    if (deepest) parent.append(deepest);
  }

  function announce(text) {
    var live = document.getElementById("live");
    live.textContent = "";
    window.setTimeout(function () { live.textContent = text; }, 30);
  }

  /* Routing and modes */

  function writeHash() {
    var next = state.mode === "explore"
      ? (state.selectedId ? "#explore/" + state.selectedId : "#explore")
      : "#walk/" + currentPath().id + "/" + state.step;
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  function readHash() {
    var raw = location.hash.replace(/^#/, "");
    if (!raw) return;
    var parts = raw.split("/");
    if (parts[0] === "explore") {
      state.mode = "explore";
      state.selectedId = parts[1] && nodesById.has(parts[1]) ? parts[1] : null;
      return;
    }
    if (parts[0] === "walk") {
      state.mode = "walk";
      if (parts[1] && data.paths.some(function (path) { return path.id === parts[1]; })) {
        state.pathId = parts[1];
      }
      var step = Number(parts[2]);
      var total = currentPath().nodes.length;
      state.step = Number.isInteger(step) && step >= 0 && step < total ? step : 0;
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var dark = theme === "dark";
    var button = document.getElementById("theme-toggle");
    var label = dark ? "Light mode" : "Dark mode";
    button.setAttribute("aria-pressed", dark ? "true" : "false");
    button.setAttribute("title", label);
    document.getElementById("theme-label").textContent = label;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
    if (exploreCy) {
      var zoom = exploreCy.zoom();
      var pan = exploreCy.pan();
      exploreCy.style(graphStylesheet());
      exploreCy.viewport({ zoom: zoom, pan: pan });
    }
  }

  function updateTitle() {
    if (state.mode === "explore") {
      var picked = state.selectedId ? nodeById(state.selectedId) : null;
      setTitle(picked ? picked.label : "The map");
      return;
    }
    var node = nodeById(currentPath().nodes[state.step]);
    setTitle(node ? node.label : "");
  }

  function showMode(options) {
    var opts = options || {};
    var explore = state.mode === "explore";
    document.body.setAttribute("data-mode", explore ? "explore" : "walk");
    document.getElementById("status").hidden = true;
    document.getElementById("walk-view").hidden = explore;
    document.getElementById("explore-view").hidden = !explore;
    var walkTab = document.getElementById("tab-walk");
    var exploreTab = document.getElementById("tab-explore");
    walkTab.setAttribute("aria-selected", explore ? "false" : "true");
    exploreTab.setAttribute("aria-selected", explore ? "true" : "false");
    walkTab.tabIndex = explore ? -1 : 0;
    exploreTab.tabIndex = explore ? 0 : -1;
    writeHash();
    updateTitle();
    if (explore) {
      window.requestAnimationFrame(function () {
        ensureGraph(function () {
          if (opts.frame && state.selectedId) frameNode(state.selectedId, false);
        });
      });
    }
  }

  function switchMode(mode, focusTab) {
    if (state.mode === mode) return;
    state.mode = mode;
    showMode();
    window.scrollTo(0, 0);
    if (focusTab) document.getElementById(mode === "explore" ? "tab-explore" : "tab-walk").focus();
  }

  /* Walk */

  function renderPicker() {
    var host = document.getElementById("path-picker");
    host.replaceChildren();
    data.paths.forEach(function (path) {
      var button = h("button", {
        type: "button",
        class: "week",
        "aria-pressed": path.id === currentPath().id ? "true" : "false",
        onClick: function () { choosePath(path.id); }
      });
      button.append(
        h("span", { class: "week-date", text: formatMonthDay(path.advent_sunday || path.date || "") }),
        h("span", { class: "week-title", text: path.title })
      );
      host.append(button);
    });
    var active = host.querySelector('[aria-pressed="true"]');
    if (active && host.scrollWidth > host.clientWidth) {
      var hostRect = host.getBoundingClientRect();
      var rect = active.getBoundingClientRect();
      if (rect.left < hostRect.left || rect.right > hostRect.right - 24) {
        host.scrollLeft += rect.left - hostRect.left;
      }
    }
  }

  function styleLine(el, fromId, toId) {
    var found = edgesBetween(fromId, toId);
    if (!found.length) {
      el.classList.add("is-none");
      return;
    }
    var edge = found[0];
    var color = "var(--edge-" + edge.type + ")";
    if (edge.confidence === "typology") {
      el.classList.add("is-typology");
      el.style.color = color;
    } else {
      el.classList.add("is-explicit");
      el.style.background = color;
    }
  }

  function renderThread() {
    var path = currentPath();
    var host = document.getElementById("thread");
    host.replaceChildren();
    path.nodes.forEach(function (id, index) {
      var node = nodeById(id);
      var label = node ? node.label : id;
      var kind = node ? kindLabel(node.type) : "";
      var itemClass = "thread-item";
      if (index === state.step) itemClass += " is-current";
      else if (index < state.step) itemClass += " is-done";
      var item = h("div", { class: itemClass, role: "listitem" });
      var button = h("button", {
        type: "button",
        class: "thread-stop",
        "aria-current": index === state.step ? "step" : null,
        "aria-label": label + (kind ? ", " + kind : "") + ", stop " + (index + 1) + " of " + path.nodes.length,
        onClick: function () { setStep(index, { scroll: true }); }
      });
      var track = h("span", { class: "thread-track", "aria-hidden": "true" });
      var before = h("span", { class: "thread-line" });
      var after = h("span", { class: "thread-line" });
      if (index === 0) before.classList.add("is-empty");
      else styleLine(before, path.nodes[index - 1], id);
      if (index === path.nodes.length - 1) after.classList.add("is-empty");
      else styleLine(after, id, path.nodes[index + 1]);
      track.append(before, h("span", { class: "bead", text: String(index + 1) }), after);
      button.append(track, h("span", { class: "thread-label", text: label }));
      if (kind) button.append(h("span", { class: "thread-kind", text: kind }));
      item.append(button);
      host.append(item);
    });
    var current = host.querySelector(".is-current");
    if (current && host.scrollWidth > host.clientWidth) {
      var left = current.offsetLeft - (host.clientWidth - current.offsetWidth) / 2;
      host.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }

  function renderStep() {
    var path = currentPath();
    var node = nodeById(path.nodes[state.step]);
    var card = document.getElementById("step-card");
    card.replaceChildren();
    var kicker = h("p", { class: "kicker" });
    kicker.append(
      h("span", { text: "Stop " + (state.step + 1) + " of " + path.nodes.length }),
      h("span", { class: "kicker-path", text: path.title })
    );
    card.append(kicker);
    if (!node) {
      card.append(h("p", { class: "summary", text: "This stop is missing from the map." }));
      return;
    }
    card.append(h("h3", { id: "step-title", class: "step-name", tabindex: "-1", text: node.label }));
    appendStart(card, node);
    appendLayers(card, node);
    appendSermons(card, node.id);
    card.append(h("button", {
      type: "button",
      class: "text-btn",
      text: "Find this on the map",
      onClick: function () { openOnMap(node.id); }
    }));
  }

  function nextPath() {
    var index = pathIndex(currentPath().id);
    return index >= 0 && index < data.paths.length - 1 ? data.paths[index + 1] : null;
  }

  function updateNav() {
    var path = currentPath();
    var total = path.nodes.length;
    var prev = document.getElementById("prev-step");
    var next = document.getElementById("next-step");
    var prevNode = state.step > 0 ? nodeById(path.nodes[state.step - 1]) : null;
    var nextNode = state.step < total - 1 ? nodeById(path.nodes[state.step + 1]) : null;
    prev.disabled = state.step <= 0;
    prev.style.visibility = prev.disabled ? "hidden" : "";
    document.getElementById("prev-name").textContent = prevNode ? prevNode.label : "";
    var after = nextPath();
    var dir = document.getElementById("next-dir");
    var name = document.getElementById("next-name");
    if (nextNode) {
      next.disabled = false;
      dir.textContent = "Next";
      name.textContent = nextNode.label;
    } else if (after) {
      next.disabled = false;
      dir.textContent = "Next week";
      name.textContent = after.title;
    } else {
      next.disabled = true;
      dir.textContent = "Next";
      name.textContent = "";
    }
    next.style.visibility = next.disabled ? "hidden" : "";
  }

  function renderPathFrame() {
    var path = currentPath();
    var line = document.getElementById("path-line");
    if (line) line.textContent = PATH_LINE[path.id] || "Each week follows one thread to Jesus.";
    var host = document.getElementById("path-deepest");
    if (!host) return;
    host.replaceChildren();
    var weekDeeper = fold("This week, go deeper", "The whole week in one story, with verses and questions", function (body) {
      appendRichDeeper(body, deeperEntry("paths", path.id));
    });
    var deepest = makeDeepest("paths", path.id, "This week, go deepest", "What the Westminster Standards say about this week");
    if (!weekDeeper && !deepest) return;
    host.append(h("h3", { class: "label", text: "About " + path.title }));
    if (weekDeeper) host.append(weekDeeper);
    if (deepest) host.append(deepest);
  }

  function renderWalk(options) {
    var opts = options || {};
    renderPathFrame();
    renderThread();
    renderStep();
    updateNav();
    if (opts.animate && !reducedMotion()) {
      var card = document.getElementById("step-card");
      card.classList.remove("is-entering");
      void card.offsetWidth;
      card.classList.add("is-entering");
    }
    if (state.mode === "walk") updateTitle();
    var node = nodeById(currentPath().nodes[state.step]);
    if (node) {
      announce("Stop " + (state.step + 1) + " of " + currentPath().nodes.length + ". " + node.label);
    }
  }

  function bringReadingIntoView() {
    var card = document.getElementById("step-card");
    var offset = topbarHeight() + 16;
    var top = card.getBoundingClientRect().top;
    if (top >= offset && top < window.innerHeight * 0.5) return;
    window.scrollTo({
      top: Math.max(0, window.scrollY + top - offset - 8),
      behavior: reducedMotion() ? "auto" : "smooth"
    });
  }

  function choosePath(id, options) {
    var opts = options || {};
    if (!data.paths.some(function (path) { return path.id === id; })) return;
    state.pathId = id;
    state.step = 0;
    renderPicker();
    renderWalk({ animate: true });
    writeHash();
    if (opts.scroll) bringReadingIntoView();
  }

  function setStep(step, options) {
    var opts = options || {};
    var total = currentPath().nodes.length;
    if (step < 0 || step >= total || step === state.step) return;
    state.step = step;
    renderWalk({ animate: true });
    writeHash();
    if (opts.scroll) bringReadingIntoView();
  }

  function goNext() {
    var total = currentPath().nodes.length;
    if (state.step < total - 1) {
      setStep(state.step + 1, { scroll: true });
      return;
    }
    var after = nextPath();
    if (after) choosePath(after.id, { scroll: true });
  }

  function openOnMap(id) {
    state.mode = "explore";
    state.selectedId = id;
    renderPanel();
    showMode({ frame: true });
    window.scrollTo(0, 0);
  }

  /* Map */

  function visibleEdges() {
    return data.edges.filter(function (edge) {
      return !(state.hideTypology && edge.confidence === "typology");
    });
  }

  function edgeKey(edge) {
    return edge.from + "__" + edge.to + "__" + edge.type;
  }

  function nodeSize(id) {
    return FOCAL[id] ? FOCAL_SIZE : NODE_SIZE;
  }

  function edgeElements() {
    return visibleEdges().map(function (edge) {
      return {
        data: {
          id: edgeKey(edge),
          source: edge.from,
          target: edge.to,
          etype: edge.type,
          confidence: edge.confidence
        },
        classes: edge.confidence === "typology" ? "typology" : "explicit"
      };
    });
  }

  function nodeElements() {
    return data.nodes.map(function (node) {
      var size = nodeSize(node.id);
      return {
        data: {
          id: node.id,
          label: node.label,
          ntype: node.type,
          w: size.w,
          h: size.h
        },
        classes: FOCAL[node.id] ? "focal" : ""
      };
    });
  }

  function dagreLayout() {
    if (typeof dagre === "undefined" || !dagre.graphlib) return null;
    try {
      var g = new dagre.graphlib.Graph({ multigraph: true });
      g.setGraph({ rankdir: "LR", nodesep: 22, ranksep: 64, edgesep: 16, marginx: 0, marginy: 0 });
      g.setDefaultEdgeLabel(function () { return {}; });
      data.nodes.forEach(function (node) {
        var size = nodeSize(node.id);
        g.setNode(node.id, { width: size.w, height: size.h });
      });
      visibleEdges().forEach(function (edge) {
        g.setEdge(edge.from, edge.to, {}, edgeKey(edge));
      });
      dagre.layout(g);
      var positions = {};
      data.nodes.forEach(function (node) {
        var spot = g.node(node.id);
        positions[node.id] = { x: spot.x, y: spot.y };
      });
      var points = {};
      g.edges().forEach(function (ref) {
        points[ref.name] = g.edge(ref).points || [];
      });
      return { positions: positions, points: points };
    } catch (err) {
      return null;
    }
  }

  function spread(count, span) {
    if (count <= 1) return [0];
    var gap = Math.min(14, span / (count - 1));
    var out = [];
    for (var i = 0; i < count; i += 1) out.push((i - (count - 1) / 2) * gap);
    return out;
  }

  /* Each edge leaves the right side of its source and enters the left side of its
     target, so the map reads left to right. Ports are spread along the side so
     arrows into Jesus do not pile on one point. */
  function routeEdges(layout) {
    var pos = layout.positions;
    var outgoing = {};
    var incoming = {};
    exploreCy.edges().forEach(function (edge) {
      var s = edge.data("source");
      var t = edge.data("target");
      (outgoing[s] = outgoing[s] || []).push(edge);
      (incoming[t] = incoming[t] || []).push(edge);
    });
    var sourceOffset = {};
    var targetOffset = {};
    Object.keys(outgoing).forEach(function (id) {
      var list = outgoing[id].slice().sort(function (a, b) {
        return pos[a.data("target")].y - pos[b.data("target")].y;
      });
      var offsets = spread(list.length, nodeSize(id).h - 24);
      list.forEach(function (edge, i) { sourceOffset[edge.id()] = offsets[i]; });
    });
    Object.keys(incoming).forEach(function (id) {
      var list = incoming[id].slice().sort(function (a, b) {
        return pos[a.data("source")].y - pos[b.data("source")].y;
      });
      var offsets = spread(list.length, nodeSize(id).h - 24);
      list.forEach(function (edge, i) { targetOffset[edge.id()] = offsets[i]; });
    });

    exploreCy.edges().forEach(function (edge) {
      var sId = edge.data("source");
      var tId = edge.data("target");
      var S = pos[sId];
      var T = pos[tId];
      var sw = nodeSize(sId).w / 2;
      var tw = nodeSize(tId).w / 2;
      var so = sourceOffset[edge.id()] || 0;
      var to = targetOffset[edge.id()] || 0;
      var start = { x: S.x + sw, y: S.y + so };
      var end = { x: T.x - tw, y: T.y + to };
      if (end.x <= start.x + 8) {
        edge.removeClass("routed");
        return;
      }
      var inner = (layout.points[edge.id()] || []).slice(1, -1).filter(function (p) {
        return p.x > start.x + 4 && p.x < end.x - 4;
      });
      var firstX = inner.length ? inner[0].x : end.x;
      var lastX = inner.length ? inner[inner.length - 1].x : start.x;
      var controls = [{ x: start.x + (firstX - start.x) / 2, y: start.y }]
        .concat(inner)
        .concat([{ x: end.x - (end.x - lastX) / 2, y: end.y }]);
      var vx = T.x - S.x;
      var vy = T.y - S.y;
      var len2 = vx * vx + vy * vy;
      var len = Math.sqrt(len2) || 1;
      var weights = [];
      var distances = [];
      controls.forEach(function (p) {
        var dx = p.x - S.x;
        var dy = p.y - S.y;
        weights.push((dx * vx + dy * vy) / (len2 || 1));
        distances.push((dy * vx - dx * vy) / len);
      });
      edge.data({
        cpw: weights,
        cpd: distances,
        sep: sw + "px " + so + "px",
        tep: (-tw) + "px " + to + "px"
      });
      edge.addClass("routed");
    });
  }

  function graphStylesheet() {
    var ink = token("--ink");
    var accent = token("--accent-fill");
    var paper = token("--paper");
    var duration = reducedMotion() ? 0 : 200;
    return [
      {
        selector: "node",
        style: {
          shape: "round-rectangle",
          "corner-radius": 10,
          width: "data(w)",
          height: "data(h)",
          label: "data(label)",
          "text-wrap": "wrap",
          "text-max-width": function (ele) { return (ele.data("w") - 18) + "px"; },
          "text-halign": "center",
          "text-valign": "center",
          "text-justification": "center",
          "line-height": 1.25,
          "font-family": GRAPH_FONT,
          "font-size": 15,
          "font-weight": 500,
          color: ink,
          "background-color": function (ele) { return token("--node-" + ele.data("ntype") + "-fill"); },
          "border-width": 1,
          "border-color": function (ele) { return token("--node-" + ele.data("ntype") + "-line"); },
          "overlay-opacity": 0,
          "underlay-color": accent,
          "underlay-opacity": 0,
          "underlay-padding": 6,
          "underlay-shape": "round-rectangle",
          "transition-property": "opacity, underlay-opacity, border-width",
          "transition-duration": duration
        }
      },
      {
        selector: "node.focal",
        style: {
          "font-size": 17,
          "font-weight": 600,
          "background-color": paper,
          "border-color": accent,
          "border-width": 1.5
        }
      },
      {
        selector: "node.hover",
        style: {
          "underlay-color": ink,
          "underlay-opacity": 0.07
        }
      },
      {
        selector: "node.picked",
        style: {
          "border-width": 2.5,
          "border-color": accent,
          "underlay-color": accent,
          "underlay-opacity": 0.14
        }
      },
      {
        selector: "edge",
        style: {
          width: 1.5,
          "curve-style": "bezier",
          "line-color": function (ele) { return token("--edge-" + ele.data("etype")); },
          "target-arrow-color": function (ele) { return token("--edge-" + ele.data("etype")); },
          "target-arrow-shape": "triangle",
          "arrow-scale": 0.7,
          opacity: 0.78,
          "line-cap": "round",
          "overlay-opacity": 0,
          "transition-property": "opacity, width",
          "transition-duration": duration
        }
      },
      {
        selector: "edge.routed",
        style: {
          "curve-style": "unbundled-bezier",
          "edge-distances": "node-position",
          "control-point-weights": function (ele) { return ele.data("cpw"); },
          "control-point-distances": function (ele) { return ele.data("cpd"); },
          "source-endpoint": function (ele) { return ele.data("sep"); },
          "target-endpoint": function (ele) { return ele.data("tep"); }
        }
      },
      {
        selector: "edge.typology",
        style: {
          "line-style": "dashed",
          "line-dash-pattern": [6, 5]
        }
      },
      {
        selector: "edge.hover, edge.lit",
        style: {
          width: 2.25,
          opacity: 1
        }
      },
      {
        selector: "node.faded",
        style: { opacity: 0.3 }
      },
      {
        selector: "edge.faded",
        style: { opacity: 0.12 }
      }
    ];
  }

  function refreshHighlight() {
    if (!exploreCy) return;
    var id = state.selectedId;
    exploreCy.batch(function () {
      exploreCy.elements().removeClass("faded picked lit");
      if (!id) return;
      var node = exploreCy.getElementById(id);
      if (!node || node.empty()) return;
      exploreCy.elements().addClass("faded");
      node.removeClass("faded").addClass("picked");
      node.connectedEdges().removeClass("faded").addClass("lit");
      node.connectedEdges().connectedNodes().removeClass("faded");
    });
  }

  /* Space covered by the controls that float over the map. */
  function mapInsets() {
    var phone = isPhone();
    return { top: 64, bottom: phone ? 76 : 60, side: 28 };
  }

  function moveViewport(viewport, animate) {
    if (!exploreCy) return;
    exploreCy.stop();
    if (animate && !reducedMotion()) {
      exploreCy.animate(viewport, { duration: 420, easing: "ease-in-out-cubic" });
    } else {
      exploreCy.viewport(viewport);
    }
  }

  function fitView(animate, whole) {
    if (!exploreCy) return;
    var bb = exploreCy.elements().boundingBox();
    if (!bb.w || !bb.h) return;
    var inset = mapInsets();
    var w = exploreCy.width();
    var h = exploreCy.height();
    var availW = Math.max(80, w - 2 * inset.side);
    var availH = Math.max(80, h - inset.top - inset.bottom);
    var zoom = Math.min(availW / bb.w, availH / bb.h, 1.05);
    var pan;
    if (zoom >= READABLE_ZOOM || whole) {
      pan = {
        x: w / 2 - zoom * (bb.x1 + bb.w / 2),
        y: inset.top + availH / 2 - zoom * (bb.y1 + bb.h / 2)
      };
    } else {
      zoom = Math.max(0.8, Math.min(availH / bb.h, 1));
      pan = {
        x: inset.side - zoom * bb.x1,
        y: inset.top + availH / 2 - zoom * (bb.y1 + bb.h / 2)
      };
    }
    moveViewport({ zoom: zoom, pan: pan }, animate);
  }

  function frameNode(id, animate) {
    if (!exploreCy || !id) return;
    var node = exploreCy.getElementById(id);
    if (!node || node.empty()) return;
    var inset = mapInsets();
    var zoom = Math.min(Math.max(exploreCy.zoom(), 0.9), 1.3);
    var p = node.position();
    var h = exploreCy.height();
    var centerY = inset.top + (h - inset.top - inset.bottom) / 2;
    moveViewport({
      zoom: zoom,
      pan: { x: exploreCy.width() / 2 - zoom * p.x, y: centerY - zoom * p.y }
    }, animate !== false);
  }

  function applyLayout() {
    var layout = dagreLayout();
    if (layout) {
      exploreCy.batch(function () {
        exploreCy.nodes().forEach(function (node) {
          node.position(layout.positions[node.id()]);
        });
        routeEdges(layout);
      });
      return;
    }
    exploreCy.edges().removeClass("routed");
    exploreCy.layout({
      name: "breadthfirst",
      directed: true,
      spacingFactor: 1.2,
      animate: false,
      fit: false
    }).run();
  }

  function createGraph() {
    var container = document.getElementById("graph");
    try {
      exploreCy = cytoscape({
        container: container,
        elements: nodeElements().concat(edgeElements()),
        layout: { name: "preset" },
        style: graphStylesheet(),
        minZoom: 0.25,
        maxZoom: 2.5,
        wheelSensitivity: 0.2,
        boxSelectionEnabled: false,
        autoungrabify: true
      });
    } catch (err) {
      document.getElementById("graph-error").hidden = false;
      document.getElementById("graph-loading").classList.add("is-done");
      exploreCy = null;
      return;
    }
    applyLayout();
    exploreCy.resize();
    fitView(false);
    if (state.selectedId) frameNode(state.selectedId, false);
    refreshHighlight();
    document.getElementById("graph-loading").classList.add("is-done");

    exploreCy.on("tap", function (evt) {
      if (evt.target === exploreCy) {
        if (state.selectedId) clearSelection();
        return;
      }
      if (evt.target.isNode && evt.target.isNode()) {
        selectNode(evt.target.id(), { frame: true, fromMap: true });
        return;
      }
      if (evt.target.isEdge && evt.target.isEdge()) {
        selectNode(evt.target.data("target"), { frame: true, fromMap: true });
      }
    });
    exploreCy.on("mouseover", "node", function (evt) {
      evt.target.addClass("hover");
      evt.target.connectedEdges().addClass("hover");
      container.style.cursor = "pointer";
    });
    exploreCy.on("mouseout", "node", function (evt) {
      evt.target.removeClass("hover");
      evt.target.connectedEdges().removeClass("hover");
      container.style.cursor = "";
    });
    exploreCy.on("mouseover", "edge", function (evt) {
      evt.target.addClass("hover");
      container.style.cursor = "pointer";
    });
    exploreCy.on("mouseout", "edge", function (evt) {
      evt.target.removeClass("hover");
      container.style.cursor = "";
    });
  }

  function ensureGraph(done) {
    if (typeof cytoscape !== "function") {
      document.getElementById("graph-error").hidden = false;
      document.getElementById("graph-loading").classList.add("is-done");
      return;
    }
    if (exploreCy) {
      exploreCy.resize();
      refreshHighlight();
      if (done) done();
      return;
    }
    if (graphPending) return;
    graphPending = true;
    fontsReady.then(function () {
      graphPending = false;
      if (!exploreCy) createGraph();
    });
  }

  function relayout() {
    if (!exploreCy) return;
    exploreCy.batch(function () {
      exploreCy.edges().remove();
      exploreCy.add(edgeElements());
    });
    applyLayout();
    refreshHighlight();
    if (state.selectedId) frameNode(state.selectedId, true);
    else fitView(true);
  }

  /* Map: the reading sheet */

  function renderNameList(host) {
    var seen = {};
    KIND_ORDER.forEach(function (kind) { seen[kind] = true; });
    var kinds = KIND_ORDER.slice();
    data.nodes.forEach(function (node) {
      if (!seen[node.type]) {
        seen[node.type] = true;
        kinds.push(node.type);
      }
    });
    var list = h("nav", { class: "names", "aria-label": "Every name on the map" });
    kinds.forEach(function (kind) {
      var group = data.nodes.filter(function (node) { return node.type === kind; })
        .slice()
        .sort(function (a, b) { return a.label.localeCompare(b.label); });
      if (!group.length) return;
      var heading = h("h4", { class: "name-kind" });
      heading.append(h("span", { class: "kind-dot", "data-kind": kind, "aria-hidden": "true" }), document.createTextNode(kindLabel(kind)));
      list.append(heading);
      group.forEach(function (node) {
        list.append(h("button", {
          type: "button",
          class: "name-btn",
          text: node.label,
          onClick: function () { selectNode(node.id, { frame: true, focusPanel: true }); }
        }));
      });
    });
    host.append(list);
  }

  function renderPanel() {
    var panel = document.getElementById("panel");
    panel.replaceChildren();
    if (!state.selectedId) {
      panel.append(
        h("p", { class: "eyebrow", text: "The map" }),
        h("h3", { id: "panel-title", class: "step-name", tabindex: "-1", text: "Choose a name" }),
        h("p", {
          class: "lead",
          text: "Tap a name. You will see the short story first. Go deeper for the verses and the lines. Go deepest for the Westminster Standards."
        })
      );
      renderNameList(panel);
      return;
    }
    var node = nodeById(state.selectedId);
    if (!node) {
      panel.append(h("p", { class: "summary", text: "This stop is missing from the map." }));
      return;
    }
    panel.append(h("button", {
      type: "button",
      class: "back-btn",
      text: "All names",
      onClick: function () { clearSelection({ focusPanel: true }); }
    }));
    panel.append(
      h("p", { class: "kicker", text: kindLabel(node.type) }),
      h("h3", { id: "panel-title", class: "step-name", tabindex: "-1", text: node.label })
    );
    appendStart(panel, node);
    appendLayers(panel, node);
    appendSermons(panel, node.id);
  }

  function revealSheet() {
    var panel = document.getElementById("panel");
    if (!isPhone()) {
      panel.scrollTop = 0;
      return;
    }
    var layout = document.querySelector(".explore-layout");
    var top = layout.getBoundingClientRect().top + window.scrollY - topbarHeight();
    if (Math.abs(window.scrollY - top) < 4) return;
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function focusPanelTitle() {
    var title = document.getElementById("panel-title");
    if (title) title.focus({ preventScroll: true });
  }

  function selectNode(id, options) {
    var opts = options || {};
    state.selectedId = id;
    state.mode = "explore";
    renderPanel();
    refreshHighlight();
    if (opts.frame) frameNode(id, true);
    writeHash();
    updateTitle();
    revealSheet();
    if (opts.focusPanel) focusPanelTitle();
    var node = nodeById(id);
    if (node) announce(node.label);
  }

  function clearSelection(options) {
    var opts = options || {};
    state.selectedId = null;
    renderPanel();
    refreshHighlight();
    writeHash();
    updateTitle();
    revealSheet();
    if (opts.focusPanel) focusPanelTitle();
  }

  function renderLegend() {
    var edges = document.getElementById("edge-legend");
    var nodes = document.getElementById("node-legend");
    edges.replaceChildren();
    nodes.replaceChildren();
    EDGE_ORDER.forEach(function (key) {
      var item = h("li");
      item.append(h("span", { class: "swatch", "data-edge": key, "aria-hidden": "true" }), document.createTextNode(edgeLabel(key)));
      edges.append(item);
    });
    KIND_ORDER.forEach(function (key) {
      var item = h("li");
      item.append(h("span", { class: "kind-dot", "data-kind": key, "aria-hidden": "true" }), document.createTextNode(kindLabel(key)));
      nodes.append(item);
    });
  }

  function typologyHint() {
    document.getElementById("typology-hint").textContent = state.hideTypology
      ? "Picture lines are hidden on the map. Open a name and go deeper to read about them."
      : "A dashed line is a picture of Jesus. Hiding those leaves only connections the New Testament states.";
  }

  function zoomBy(factor) {
    if (!exploreCy) return;
    var next = exploreCy.zoom() * factor;
    next = Math.max(exploreCy.minZoom(), Math.min(exploreCy.maxZoom(), next));
    var center = { x: exploreCy.width() / 2, y: exploreCy.height() / 2 };
    exploreCy.stop();
    if (reducedMotion()) {
      exploreCy.zoom({ level: next, renderedPosition: center });
      return;
    }
    var pan = exploreCy.pan();
    var ratio = next / exploreCy.zoom();
    exploreCy.animate({
      zoom: next,
      pan: { x: center.x - (center.x - pan.x) * ratio, y: center.y - (center.y - pan.y) * ratio }
    }, { duration: 200, easing: "ease-out-cubic" });
  }

  /* Events */

  function bind() {
    var tabs = [document.getElementById("tab-walk"), document.getElementById("tab-explore")];
    tabs[0].addEventListener("click", function () { switchMode("walk"); });
    tabs[1].addEventListener("click", function () { switchMode("explore"); });
    document.querySelector(".mode-switch").addEventListener("keydown", function (event) {
      var keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (keys.indexOf(event.key) < 0) return;
      event.preventDefault();
      event.stopPropagation();
      var mode = event.key === "ArrowLeft" || event.key === "Home" ? "walk" : "explore";
      switchMode(mode, true);
      document.getElementById(mode === "explore" ? "tab-explore" : "tab-walk").focus();
    });
    document.getElementById("theme-toggle").addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      try { localStorage.setItem("scarlet-thread-theme", next); } catch (err) { /* private mode */ }
      applyTheme(next);
    });
    var prevButton = document.getElementById("prev-step");
    var nextButton = document.getElementById("next-step");
    prevButton.addEventListener("click", function () {
      setStep(state.step - 1, { scroll: true });
      if (prevButton.disabled) nextButton.focus({ preventScroll: true });
    });
    nextButton.addEventListener("click", function () {
      goNext();
      if (nextButton.disabled) prevButton.focus({ preventScroll: true });
    });
    document.addEventListener("click", function (event) {
      var summary = event.target.closest(".fold > summary");
      if (!summary) return;
      event.preventDefault();
      toggleFold(summary.parentElement);
    });
    document.getElementById("hide-typology").addEventListener("change", function (event) {
      state.hideTypology = event.target.checked;
      typologyHint();
      relayout();
    });
    document.getElementById("zoom-in").addEventListener("click", function () { zoomBy(1.25); });
    document.getElementById("zoom-out").addEventListener("click", function () { zoomBy(0.8); });
    document.getElementById("zoom-fit").addEventListener("click", function () { fitView(true, true); });
    document.addEventListener("keydown", function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (state.mode !== "walk") {
        if (event.key === "Escape") {
          var key = document.getElementById("legend-details");
          if (key.open) {
            key.open = false;
            key.querySelector("summary").focus();
          } else if (state.selectedId) {
            clearSelection({ focusPanel: true });
          }
        }
        return;
      }
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setStep(state.step + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStep(state.step - 1);
      }
    });
    window.addEventListener("hashchange", function () {
      readHash();
      renderPicker();
      renderWalk();
      renderPanel();
      refreshHighlight();
      showMode({ frame: true });
    });
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (!exploreCy || document.getElementById("explore-view").hidden) return;
      exploreCy.resize();
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (state.selectedId) frameNode(state.selectedId, false);
        else fitView(false);
      }, 150);
    });
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    if (media.addEventListener) {
      media.addEventListener("change", function () {
        var stored = null;
        try { stored = localStorage.getItem("scarlet-thread-theme"); } catch (err) { stored = "set"; }
        if (!stored) applyTheme(media.matches ? "dark" : "light");
      });
    }
  }

  function fail(message) {
    var status = document.getElementById("status");
    status.hidden = false;
    status.classList.add("is-error");
    document.getElementById("status-text").textContent = message;
  }

  function start() {
    nodesById = new Map(data.nodes.map(function (node) { return [node.id, node]; }));
    state.pathId = data.paths[0].id;
    readHash();
    if (data.meta && data.meta.version) {
      document.getElementById("map-version").textContent = "Map version " + data.meta.version + ".";
    }
    bind();
    applyTheme(currentTheme());
    renderLegend();
    renderPicker();
    renderWalk();
    renderPanel();
    typologyHint();
    showMode({ frame: true });
  }

  function loadJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("status " + response.status);
      return response.json();
    });
  }

  if (document.fonts && document.fonts.load) {
    fontsReady = Promise.race([
      Promise.all([
        document.fonts.load('500 15px "Source Serif 4"'),
        document.fonts.load('600 17px "Source Serif 4"')
      ]),
      new Promise(function (resolve) { window.setTimeout(resolve, 1500); })
    ]).catch(function () { return null; });
  }

  Promise.all([
    loadJson("data/advent-graph.json"),
    loadJson("data/sermons.json").catch(function () { return {}; }),
    loadJson("data/confessions.json").catch(function () { return null; }),
    loadJson("data/deeper.json").catch(function () { return null; })
  ])
    .then(function (files) {
      var json = files[0];
      if (!json || !Array.isArray(json.nodes) || !Array.isArray(json.edges) || !Array.isArray(json.paths)) {
        throw new Error("The map file is missing nodes, edges, or paths.");
      }
      data = json;
      sermons = files[1] && typeof files[1] === "object" ? files[1] : {};
      confessions = files[2] && files[2].sections ? files[2] : null;
      deeper = files[3] && files[3].nodes ? files[3] : null;
      start();
    })
    .catch(function () {
      fail("The map could not be loaded. Start a local web server in the project folder, then open this site from that server. Opening the HTML file directly blocks the map.");
    });
})();
