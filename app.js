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
    prophecy_fulfillment: "Prophecy connection",
    quoted_by: "Quoted in the New Testament",
    promise_narrowing: "Promises read together",
    family_line: "Family",
    book_sequence: "Next in Moses' sermon",
    event_sequence: "What happened next",
    place_link: "A place",
    prophet_voice: "Who spoke it",
    type_to_christ: "Interpretive picture"
  };

  var KIND_GLOSS = {
    promise: "A promise is something God says he will do.",
    covenant: "A covenant is a binding relationship God establishes, with promises and obligations.",
    prophecy: "A prophecy is a message God gives through a prophet. It can announce what God will do."
  };

  var PATH_LINE = {
    week1_seed: "This walk reads the garden and Abraham together as promises fulfilled in Christ.",
    week2_king: "Follow the promised ruler through David's family.",
    week3_sign: "God gives a sign. A son will be born, and God will be with us.",
    week4_town: "The promised ruler comes from Bethlehem.",
    christmas: "The promise arrives. Jesus is born.",
    deut_book: "Read Moses' last sermon straight through, from the plains of Moab to his grave.",
    deut_nt: "Follow the verses that Jesus and the apostles took out of Deuteronomy."
  };

  var KIND_ORDER = ["promise", "covenant", "prophecy", "person", "place", "event", "teaching"];
  var EDGE_ORDER = [
    "prophecy_fulfillment",
    "quoted_by",
    "promise_narrowing",
    "family_line",
    "book_sequence",
    "event_sequence",
    "place_link",
    "prophet_voice",
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
  var MODES = ["walk", "explore", "requests"];

  /* Each book is one graph file. The first one is the default and keeps the
     plain "#explore" hash, so Advent links made before this change still work. */
  var BOOKS = [
    { key: "advent", file: "data/advent-graph.json", label: "Advent" },
    { key: "deuteronomy", file: "data/deuteronomy-graph.json", label: "Deuteronomy (pilot)" }
  ];

  /* Advent's graph file carries none of these keys, so Advent falls back to the
     wording the page shipped with and reads exactly as it did before. */
  var META_DEFAULTS = {
    eyebrow: "Advent 2026",
    intro_title: "A Reformed Advent reading: the Bible's story points to Jesus.",
    intro_text: "Pick a week and move one stop at a time. Or open the map and follow the lines.",
    path_word: "week",
    subtitle: "an Advent walk through the Bible",
    picker_label: "Advent weeks",
    graph_label: "Advent map of people, places, events, and promises",
    path_line_default: "Each week follows one thread to Jesus.",
    key_note: "A stop's line usually runs to Jesus, not to the stop beside it. That is why so much of this week is dotted. Open a stop to see the lines it does have.",
    tab_walk_long: "Walk a week",
    tab_walk_short: "Walk"
  };

  var books = {};
  /* Null prototype, so a hash like "#explore/constructor" is a miss and not a hit
     on an inherited property. Nodes and paths are kept apart because only a node
     id can be selected on the map, and only a path id can be walked. */
  var nodeBook = Object.create(null);
  var pathBook = Object.create(null);
  var bookKey = BOOKS[0].key;
  var data = null;
  var sermonsByBook = {};
  var confessions = null;
  var deeper = null;
  var nodesById = new Map();
  var exploreCy = null;
  var graphPending = false;
  var graphLibsPromise = null;
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

  function bookMeta(key) {
    var m = data && data.meta ? data.meta : {};
    if (key === "tab_walk_long" || key === "tab_walk_short") {
      var tabs = m.tabs || {};
      var which = key === "tab_walk_long" ? "walk_long" : "walk_short";
      return tabs[which] != null ? tabs[which] : META_DEFAULTS[key];
    }
    return m[key] != null ? m[key] : META_DEFAULTS[key];
  }

  function pathWord() {
    return bookMeta("path_word");
  }

  function bookByKey(key) {
    for (var i = 0; i < BOOKS.length; i += 1) {
      if (BOOKS[i].key === key) return BOOKS[i];
    }
    return null;
  }

  function kindLabel(type) {
    return KIND_LABELS[type] || String(type || "").replace(/_/g, " ");
  }

  function edgeLabel(type) {
    return EDGE_LABELS[type] || String(type || "").replace(/_/g, " ");
  }

  function confidenceCopy(flag) {
    if (flag === "explicit") {
      return "This is a direct textual or narrative connection. The exact claim is below.";
    }
    if (flag === "typology") {
      return "This is an interpretive connection. Christians who trust the Bible do not all see it the same way.";
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
    document.title = prefix ? prefix + " \u00b7 " + SITE_NAME : SITE_NAME + ": " + bookMeta("subtitle");
  }

  /* Sermons */

  function sermonsFor(nodeId) {
    var bookSermons = sermonsByBook[bookKey] || {};
    var list = bookSermons[nodeId];
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
    var videoId = youtubeId(sermon.url);
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
    } else if (sermon.match === "overlap") {
      article.append(h("p", {
        class: "sermon-note",
        text: sermon.notes || "This sermon covers part of this stop's passage."
      }));
    }
    var actions = h("div", { class: "sermon-actions" });
    actions.append(h("a", {
      class: "sermon-watch",
      href: sermon.url,
      target: "_blank",
      rel: "noopener noreferrer",
      text: videoId ? "Watch on YouTube" : "Open sermon page"
    }));
    var player = h("div", { class: "sermon-player", hidden: true });
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
    if (bookKey === "deuteronomy" && list.length > 4) {
      var details = h("details", { class: "sermon-list" });
      details.append(h("summary", { text: "Show " + list.length + " sermons" }));
      var body = h("div", { class: "sermon-list-body" });
      list.forEach(function (sermon) { body.append(renderSermon(sermon)); });
      details.append(body);
      section.append(details);
    } else {
      list.forEach(function (sermon) { section.append(renderSermon(sermon)); });
    }
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
    var linked = data.edges.some(function (edge) {
      return edge.from === node.id || edge.to === node.id;
    });
    if (!linked) {
      parent.append(h("p", {
        class: "hint",
        text: "No line on the map reaches this stop. It stands on its own."
      }));
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

  function makeDeepest(group, id, label, sub, subAlt) {
    var items = confessionItems(group, id);
    var theology = confessions && confessions.theology && confessions.theology[group]
      ? confessions.theology[group][id]
      : "";
    if (!items.length && !theology) return null;
    return fold(label, items.length ? sub : subAlt, function (body) {
      if (items.length) {
        body.append(h("p", {
          class: "hint",
          text: "These words are from the Westminster Standards. Reformed churches use them to say, carefully, what the Bible teaches. The quotations are the modern spelling text from the Orthodox Presbyterian Church."
        }));
      }
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
      parent.append(h("h4", { class: "section-label", text: "New Testament connections" }));
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

  /* Most stops do not link to the stop beside them in the week. They link to
     Jesus or to the birth. The rail cannot show that, so the card names the
     lines this stop really has. These are the edges already in the map file. */
  function jumpToStop(id) {
    if (state.mode === "explore") {
      selectNode(id, { frame: true, focusPanel: true });
      return;
    }
    openOnMap(id);
  }

  function appendConnections(parent, node) {
    var links = data.edges.filter(function (edge) {
      return edge.from === node.id || edge.to === node.id;
    });
    if (!links.length) return;
    parent.append(h("h4", { class: "section-label", text: "Lines on the map" }));
    var list = h("ul", { class: "links" });
    links.forEach(function (edge) {
      var outgoing = edge.from === node.id;
      var otherId = outgoing ? edge.to : edge.from;
      var other = nodeById(otherId);
      var name = other ? other.label : otherId;
      var dir = outgoing ? "To" : "From";
      var button = h("button", {
        type: "button",
        class: "link-chip" + (edge.confidence === "typology" ? " is-typology" : ""),
        "aria-label": dir + " " + name + ". " + edgeLabel(edge.type) + ". Open on the map.",
        onClick: function () { jumpToStop(otherId); }
      });
      button.append(
        h("span", { class: "swatch", "data-edge": edge.type, "aria-hidden": "true" }),
        h("span", { class: "link-dir", "aria-hidden": "true", text: dir }),
        h("span", { class: "link-name", text: name })
      );
      list.append(h("li", {}, [button]));
    });
    parent.append(list);
  }

  function appendLayers(parent, node) {
    var deeperFold = fold("Go deeper", "The verses, the story, and how the lines connect", function (body) {
      appendRichDeeper(body, deeperEntry("nodes", node.id));
    });
    if (deeperFold) parent.append(deeperFold);
    var deepest = makeDeepest("nodes", node.id, "Go deepest", "What the Westminster Standards say", "How Reformed theology reads this stop");
    if (deepest) parent.append(deepest);
  }

  function announce(text) {
    var live = document.getElementById("live");
    live.textContent = "";
    window.setTimeout(function () { live.textContent = text; }, 30);
  }

  /* Routing and modes */

  function writeHash(push) {
    var next;
    if (state.mode === "requests") next = "#requests";
    else if (state.mode === "explore") {
      if (state.selectedId) next = "#explore/" + state.selectedId;
      else next = bookKey === BOOKS[0].key ? "#explore" : "#explore/" + bookKey;
    }
    else next = "#walk/" + currentPath().id + "/" + state.step;
    if (location.hash === next) return;
    /* A move the reader made gets its own history entry, so Back goes to the
       stop before it instead of leaving the site. */
    if (push) history.pushState(null, "", next);
    else history.replaceState(null, "", next);
  }

  function readHash() {
    var raw = location.hash.replace(/^#/, "");
    if (!raw) return;
    var parts = raw.split("/");
    if (parts[0] === "requests") {
      state.mode = "requests";
      return;
    }
    if (parts[0] === "explore") {
      state.mode = "explore";
      var target = parts[1] || "";
      /* A bare "#explore" is the first book's map with nothing selected. That is the
         hash Advent has always used, so it has to switch back from another book. */
      if (!target) {
        setBook(BOOKS[0].key);
        state.selectedId = null;
        return;
      }
      /* "#explore/deuteronomy" names a book, again with nothing selected. */
      if (bookByKey(target)) {
        setBook(target);
        state.selectedId = null;
        return;
      }
      /* Otherwise it is a stop, and the id says which book it belongs to. Only a
         node id counts, so an old or mistyped hash falls back to the list of names. */
      if (nodeBook[target]) {
        setBook(nodeBook[target]);
        state.selectedId = nodesById.has(target) ? target : null;
        return;
      }
      state.selectedId = null;
      return;
    }
    if (parts[0] === "walk") {
      state.mode = "walk";
      if (parts[1] && pathBook[parts[1]]) {
        setBook(pathBook[parts[1]]);
        if (data.paths.some(function (path) { return path.id === parts[1]; })) {
          state.pathId = parts[1];
        }
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
    if (state.mode === "requests") {
      setTitle("Comments and requests");
      return;
    }
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
    var mode = MODES.indexOf(state.mode) >= 0 ? state.mode : "walk";
    document.body.setAttribute("data-mode", mode);
    document.getElementById("status").hidden = true;
    MODES.forEach(function (name) {
      document.getElementById(name + "-view").hidden = name !== mode;
      var tab = document.getElementById("tab-" + name);
      tab.setAttribute("aria-selected", name === mode ? "true" : "false");
      tab.tabIndex = name === mode ? 0 : -1;
    });
    writeHash(opts.push);
    updateTitle();
    if (mode === "requests") renderRequests();
    if (mode === "explore") {
      nextFrame(function () {
        ensureGraph(function () {
          if (opts.frame && state.selectedId) frameNode(state.selectedId, false);
        });
      });
    }
  }

  /* Let the view lay out before cytoscape measures it. A window that is covered
     or minimised is served no frames, so fall back to a timer rather than leave
     the reader on "Drawing the map." */
  function nextFrame(callback) {
    var ran = false;
    var run = function () {
      if (ran) return;
      ran = true;
      callback();
    };
    window.requestAnimationFrame(run);
    window.setTimeout(run, 150);
  }

  function switchMode(mode, focusTab) {
    if (state.mode === mode) return;
    state.mode = mode;
    showMode({ push: true });
    window.scrollTo(0, 0);
    if (focusTab) document.getElementById("tab-" + mode).focus();
  }

  /* Books */

  function destroyGraph() {
    if (exploreCy) {
      exploreCy.destroy();
      exploreCy = null;
    }
    graphPending = false;
    var loading = document.getElementById("graph-loading");
    if (loading) loading.classList.remove("is-done");
    var failed = document.getElementById("graph-error");
    if (failed) failed.hidden = true;
  }

  /* Switching books swaps the whole graph, so the walk, the legend, the picker
     and the drawing are all rebuilt. The libraries stay loaded. */
  function setBook(key) {
    if (!books[key] || key === bookKey) return false;
    bookKey = key;
    data = books[key];
    nodesById = new Map(data.nodes.map(function (node) { return [node.id, node]; }));
    state.pathId = data.paths[0].id;
    state.step = 0;
    state.selectedId = null;
    destroyGraph();
    return true;
  }

  function applyBookChrome() {
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("intro-eyebrow", bookMeta("eyebrow"));
    set("intro-title", bookMeta("intro_title"));
    set("intro-text", bookMeta("intro_text"));
    set("rail-title", "This " + pathWord());
    set("key-note", bookMeta("key_note"));
    var long = document.querySelector("#tab-walk .tab-long");
    if (long) long.textContent = bookMeta("tab_walk_long");
    var short = document.querySelector("#tab-walk .tab-short");
    if (short) short.textContent = bookMeta("tab_walk_short");
    var picker = document.getElementById("path-picker");
    if (picker) picker.setAttribute("aria-label", bookMeta("picker_label"));
    var thread = document.getElementById("thread");
    if (thread) thread.setAttribute("aria-label", "Stops this " + pathWord());
    var notes = document.getElementById("path-deepest");
    if (notes) notes.setAttribute("aria-label", "About this " + pathWord());
    var graph = document.getElementById("graph");
    if (graph) graph.setAttribute("aria-label", bookMeta("graph_label"));
    var version = document.getElementById("map-version");
    if (version) {
      version.textContent = data.meta && data.meta.version
        ? "Map version " + data.meta.version + "."
        : "";
    }
  }

  function renderBookPicker() {
    var host = document.getElementById("book-picker");
    if (!host) return;
    host.replaceChildren();
    /* If the second book fails to load there is nothing to switch to, so the page
       stays exactly as it was before books existed. */
    host.hidden = BOOKS.length < 2;
    if (host.hidden) return;
    BOOKS.forEach(function (book) {
      var button = h("button", {
        type: "button",
        class: "week book-btn",
        "aria-pressed": book.key === bookKey ? "true" : "false",
        onClick: function () { chooseBook(book.key); }
      });
      button.append(h("span", { class: "week-title", text: book.label }));
      host.append(button);
    });
  }

  function chooseBook(key) {
    if (!setBook(key)) return;
    applyBookChrome();
    renderBookPicker();
    renderLegend();
    renderPicker();
    renderWalk({ animate: true });
    renderPanel();
    typologyHint();
    updateTitle();
    writeHash(true);
    if (state.mode === "explore") {
      nextFrame(function () { ensureGraph(); });
    }
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
      var when = formatMonthDay(path.advent_sunday || path.date || "");
      if (when) button.append(h("span", { class: "week-date", text: when }));
      button.append(h("span", { class: "week-title", text: path.title }));
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
    appendConnections(card, node);
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
      dir.textContent = "Next " + pathWord();
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
    if (line) line.textContent = PATH_LINE[path.id] || bookMeta("path_line_default");
    var host = document.getElementById("path-deepest");
    if (!host) return;
    host.replaceChildren();
    var word = pathWord();
    var weekDeeper = fold("This " + word + ", go deeper", "The whole " + word + " in one story, with verses and questions", function (body) {
      appendRichDeeper(body, deeperEntry("paths", path.id));
    });
    var deepest = makeDeepest("paths", path.id, "This " + word + ", go deepest", "What the Westminster Standards say about this " + word, "How Reformed theology reads this " + word);
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
    writeHash(true);
    if (opts.scroll) bringReadingIntoView();
  }

  function setStep(step, options) {
    var opts = options || {};
    var total = currentPath().nodes.length;
    if (step < 0 || step >= total || step === state.step) return;
    state.step = step;
    renderWalk({ animate: true });
    writeHash(true);
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

  function goHome(event) {
    if (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
    }
    state.mode = "walk";
    state.pathId = null;
    state.step = 0;
    state.selectedId = null;
    renderPicker();
    renderWalk();
    showMode({ push: true });
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    document.getElementById("main").focus({ preventScroll: true });
  }

  function openOnMap(id) {
    state.mode = "explore";
    state.selectedId = id;
    renderPanel();
    showMode({ frame: true, push: true });
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
      exploreCy = null;
      graphFailed();
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

  function graphFailed() {
    document.getElementById("graph-error").hidden = false;
    document.getElementById("graph-loading").classList.add("is-done");
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var tag = document.createElement("script");
      tag.src = src;
      tag.async = false;
      tag.onload = function () { resolve(null); };
      tag.onerror = function () { reject(new Error(src)); };
      document.head.appendChild(tag);
    });
  }

  /* The map drawing is 650KB of library. The walk never needs it, so it is
     fetched the first time a reader opens the map. dagreLayout falls back to a
     plain layout when dagre is missing, so only cytoscape is required. */
  function graphLibs() {
    if (!graphLibsPromise) {
      var cyReady = typeof cytoscape === "function"
        ? Promise.resolve(null)
        : loadScript("vendor/cytoscape.min.js");
      var dagreReady = (typeof dagre !== "undefined" && dagre.graphlib)
        ? Promise.resolve(null)
        : loadScript("vendor/dagre.min.js").catch(function () { return null; });
      graphLibsPromise = dagreReady.then(function () { return cyReady; });
    }
    return graphLibsPromise;
  }

  function ensureGraph(done) {
    if (exploreCy) {
      exploreCy.resize();
      refreshHighlight();
      if (done) done();
      return;
    }
    if (graphPending) return;
    graphPending = true;
    Promise.all([graphLibs(), fontsReady]).then(function () {
      graphPending = false;
      if (typeof cytoscape !== "function") {
        graphFailed();
        return;
      }
      if (!exploreCy) createGraph();
    }, function () {
      graphPending = false;
      graphFailed();
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
    appendConnections(panel, node);
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
    writeHash(true);
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
    writeHash(true);
    updateTitle();
    revealSheet();
    if (opts.focusPanel) focusPanelTitle();
  }

  function renderLegend() {
    var edges = document.getElementById("edge-legend");
    var nodes = document.getElementById("node-legend");
    edges.replaceChildren();
    nodes.replaceChildren();
    var usedEdges = {};
    data.edges.forEach(function (edge) { usedEdges[edge.type] = true; });
    var usedKinds = {};
    data.nodes.forEach(function (node) { usedKinds[node.type] = true; });
    EDGE_ORDER.filter(function (key) { return usedEdges[key]; }).forEach(function (key) {
      var item = h("li");
      item.append(h("span", { class: "swatch", "data-edge": key, "aria-hidden": "true" }), document.createTextNode(edgeLabel(key)));
      edges.append(item);
    });
    KIND_ORDER.filter(function (key) { return usedKinds[key]; }).forEach(function (key) {
      var item = h("li");
      item.append(h("span", { class: "kind-dot", "data-kind": key, "aria-hidden": "true" }), document.createTextNode(kindLabel(key)));
      nodes.append(item);
    });
  }

  function typologyHint() {
    document.getElementById("typology-hint").textContent = state.hideTypology
      ? "Interpretive lines are hidden on the map. Open a name and go deeper to read about them."
      : "A dashed line marks an interpretive connection. Hiding those leaves direct textual and narrative connections.";
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

  /* Comments and requests */

  var requestsBuilt = false;

  function requestConfig() {
    var config = window.scarletRequests;
    return config && typeof config === "object" ? config : {};
  }

  function requestsOpen() {
    var endpoint = requestConfig().endpoint;
    return typeof endpoint === "string" && /^https:\/\//.test(endpoint);
  }

  function requestField(id, label, control) {
    var wrap = h("label", { class: "request-field", for: id });
    wrap.append(h("span", { class: "request-label", text: label }), control);
    return wrap;
  }

  function submissionCard(issue) {
    var card = h("article", { class: "request-card" });
    card.append(h("h5", { class: "request-title", text: issue.title || "" }));
    var when = formatDate(String(issue.created_at || "").slice(0, 10));
    if (when) card.append(h("p", { class: "request-meta", text: when }));
    if (issue.body) card.append(h("p", { class: "request-body", text: issue.body }));
    var comments = Array.isArray(issue.comments) ? issue.comments : [];
    if (comments.length) {
      var replies = h("div", { class: "request-replies" });
      replies.append(h("p", { class: "section-label", text: "Replies" }));
      comments.forEach(function (comment) {
        var line = comment.author ? comment.author + ": " + (comment.body || "") : comment.body || "";
        if (line) replies.append(h("p", { text: line }));
      });
      card.append(replies);
    }
    return card;
  }

  function showSubmissions(host, issues, shown) {
    var nodes = issues.slice(0, shown).map(submissionCard);
    if (shown < issues.length) {
      nodes.push(h("button", {
        type: "button",
        class: "text-btn",
        text: "See more",
        onClick: function () { showSubmissions(host, issues, shown + 5); }
      }));
    }
    host.replaceChildren.apply(host, nodes);
  }

  function loadSubmissions(host) {
    if (!host) return;
    if (!requestsOpen()) {
      host.replaceChildren(h("p", { class: "hint", text: "Nothing here yet." }));
      return;
    }
    host.replaceChildren(h("p", { class: "hint", text: "Loading what people have sent." }));
    fetch(requestConfig().endpoint, { method: "GET", headers: { accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function (issues) {
        if (!Array.isArray(issues) || !issues.length) {
          host.replaceChildren(h("p", { class: "hint", text: "No one has asked yet. Yours can be the first." }));
          return;
        }
        issues.sort(function (a, b) {
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
        showSubmissions(host, issues, 3);
      })
      .catch(function () {
        host.replaceChildren(h("p", { class: "hint", text: "The list did not load." }));
      });
  }

  function requestForm(list) {
    var form = h("form", { class: "request-form" });
    var subject = h("input", { id: "request-subject", name: "subject", type: "text", maxlength: "120" });
    var kind = h("select", { id: "request-kind", name: "kind" });
    kind.append(
      h("option", { value: "", text: "Not sure" }),
      h("option", { value: "person", text: "A person" }),
      h("option", { value: "event", text: "An event" })
    );
    var name = h("input", { id: "request-name", name: "name", type: "text", maxlength: "80", autocomplete: "name" });
    var message = h("textarea", { id: "request-message", name: "message", required: "required", maxlength: "2000", rows: "5" });
    var honey = h("input", { id: "request-company", name: "company", type: "text", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    var honeyLabel = h("label", { class: "request-honey", for: "request-company" });
    honeyLabel.append(h("span", { text: "Company" }), honey);
    var status = h("p", { class: "request-status", role: "status" });
    var submit = h("button", { type: "submit", class: "send-btn", text: "Send" });

    form.append(
      requestField("request-subject", "Who or what is missing", subject),
      requestField("request-kind", "Is it a person or an event?", kind),
      requestField("request-name", "Your name (optional)", name),
      requestField("request-message", "Say why it belongs on the map", message),
      honeyLabel
    );

    if (requestConfig().turnstileSiteKey) {
      var box = h("div", { class: "request-turnstile" });
      form.append(box);
      var script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = function () {
        if (window.turnstile) {
          form.dataset.turnstileId = window.turnstile.render(box, { sitekey: requestConfig().turnstileSiteKey });
        }
      };
      document.head.append(script);
    }
    form.append(submit, status);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      status.textContent = "";
      if (!requestsOpen()) {
        status.textContent = "Requests open soon.";
        return;
      }
      var text = message.value.trim();
      if (!text) {
        status.textContent = "Write a comment or a request.";
        message.focus();
        return;
      }
      submit.disabled = true;
      fetch(requestConfig().endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(),
          subject: subject.value.trim(),
          kind: kind.value,
          message: text,
          company: honey.value,
          turnstile: form.dataset.turnstileId && window.turnstile
            ? window.turnstile.getResponse(form.dataset.turnstileId)
            : ""
        })
      })
        .then(function (response) {
          if (!response.ok) throw new Error(String(response.status));
          form.reset();
          status.textContent = "Sent. It will show in the list below.";
          announce("Your request was sent.");
          loadSubmissions(list);
        })
        .catch(function () {
          status.textContent = "The message did not send. Try again.";
        })
        .then(function () {
          submit.disabled = false;
        });
    });
    return form;
  }

  function renderRequests() {
    if (requestsBuilt) return;
    requestsBuilt = true;
    var host = document.getElementById("requests-body");
    host.replaceChildren();
    host.append(
      h("p", { class: "eyebrow", text: "Add to the map" }),
      h("h3", { id: "requests-title", class: "step-name", tabindex: "-1", text: "Ask for a person or an event" }),
      h("p", {
        class: "lead",
        text: "This map is small on purpose. If a person or an event belongs on it, say so. Name it, say where it is in Scripture, and say how it points to Christ. Every note is read."
      })
    );
    var list = h("div", { class: "request-list" });
    if (requestsOpen()) {
      host.append(requestForm(list));
    } else {
      host.append(h("p", { class: "hint", text: "Requests open soon." }));
    }
    host.append(h("h4", { class: "section-label", text: "What people have asked for" }), list);
    loadSubmissions(list);
  }

  /* Events */

  function bind() {
    MODES.forEach(function (name) {
      document.getElementById("tab-" + name).addEventListener("click", function () { switchMode(name); });
    });
    document.querySelector(".mode-switch").addEventListener("keydown", function (event) {
      var keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (keys.indexOf(event.key) < 0) return;
      event.preventDefault();
      event.stopPropagation();
      var at = Math.max(0, MODES.indexOf(state.mode));
      var to;
      if (event.key === "Home") to = 0;
      else if (event.key === "End") to = MODES.length - 1;
      else if (event.key === "ArrowLeft") to = (at - 1 + MODES.length) % MODES.length;
      else to = (at + 1) % MODES.length;
      switchMode(MODES[to], true);
      document.getElementById("tab-" + MODES[to]).focus();
    });
    document.querySelector(".brand-home").addEventListener("click", goHome);
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
        if (state.mode === "explore" && event.key === "Escape") {
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
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStep(state.step - 1);
      }
    });
    window.addEventListener("hashchange", function () {
      var was = bookKey;
      readHash();
      /* A hash can name a stop in the other book, and Back can cross between
         books, so the legend, the switcher and the intro are rebuilt too. */
      if (bookKey !== was) {
        applyBookChrome();
        renderBookPicker();
        renderLegend();
        typologyHint();
      }
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
    data = books[bookKey];
    nodesById = new Map(data.nodes.map(function (node) { return [node.id, node]; }));
    state.pathId = data.paths[0].id;
    readHash();
    bind();
    applyTheme(currentTheme());
    applyBookChrome();
    renderBookPicker();
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

  function validGraph(json) {
    return !!json && Array.isArray(json.nodes) && Array.isArray(json.edges) && Array.isArray(json.paths)
      && json.nodes.length > 0 && json.paths.length > 0
      && json.paths.every(function (path) { return Array.isArray(path.nodes) && path.nodes.length > 0; });
  }

  Promise.all([
    Promise.all(BOOKS.map(function (book) {
      /* A second book that fails to load must not take the first one down. */
      return loadJson(book.file).catch(function () { return null; });
    })),
    loadJson("data/sermons.json").catch(function () { return {}; }),
    loadJson("data/deuteronomy-sermons.json").catch(function () { return {}; }),
    loadJson("data/confessions.json").catch(function () { return null; }),
    loadJson("data/deeper.json").catch(function () { return null; })
  ])
    .then(function (files) {
      var graphs = files[0];
      BOOKS.forEach(function (book, index) {
        var json = graphs[index];
        if (!validGraph(json)) return;
        books[book.key] = json;
        json.nodes.forEach(function (node) { nodeBook[node.id] = book.key; });
        json.paths.forEach(function (path) { pathBook[path.id] = book.key; });
      });
      BOOKS = BOOKS.filter(function (book) { return !!books[book.key]; });
      if (!BOOKS.length) {
        throw new Error("The map file is missing nodes, edges, or paths.");
      }
      bookKey = BOOKS[0].key;
      sermonsByBook = {
        advent: files[1] && typeof files[1] === "object" ? files[1] : {},
        deuteronomy: files[2] && typeof files[2] === "object" ? files[2] : {}
      };
      confessions = files[3] && files[3].sections ? files[3] : null;
      deeper = files[4] && files[4].nodes ? files[4] : null;
      start();
    })
    .catch(function () {
      fail("The map could not be loaded. Start a local web server in the project folder, then open this site from that server. Opening the HTML file directly blocks the map.");
    });
})();
