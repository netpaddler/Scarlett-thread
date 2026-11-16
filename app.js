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
    prophecy_fulfillment: "Prophecy and fulfillment",
    promise_narrowing: "Promise narrowing",
    family_line: "Family line",
    event_sequence: "Event sequence",
    place_link: "Place link",
    type_to_christ: "Type pointing to Christ"
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

  var data = null;
  var nodesById = new Map();
  var exploreCy = null;
  var state = {
    mode: "walk",
    pathId: null,
    step: 0,
    selectedId: null,
    hideTypology: false,
    fitted: false
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
      return "Stated in Scripture. The New Testament itself draws this link.";
    }
    if (flag === "typology") {
      return "Typology. This is an interpretive link, and faithful readers may differ.";
    }
    return flag || "";
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

  function nodeById(id) {
    return nodesById.get(id) || null;
  }

  function edgesBetween(a, b) {
    return data.edges.filter(function (edge) {
      return (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a);
    });
  }

  function addFact(dl, term, value) {
    if (value == null || value === "") return;
    var row = h("div");
    row.append(h("dt", { text: term }), h("dd", { text: value }));
    dl.append(row);
  }

  function appendNodeBody(parent, node) {
    var facts = h("dl", { class: "facts" });
    addFact(facts, "Kind", kindLabel(node.type));
    addFact(facts, "Scripture", (node.refs || []).join(", ") || "None listed");
    parent.append(facts);
    if (node.quote && node.quote.text) {
      var figure = h("figure", { class: "quote" });
      var quote = h("blockquote", { text: node.quote.text });
      quote.setAttribute("translate", "no");
      figure.append(quote);
      if (node.quote.ref) figure.append(h("figcaption", { text: node.quote.ref }));
      parent.append(figure);
    }
    if (node.summary) {
      parent.append(
        h("h4", { class: "section-label", text: "Summary" }),
        h("p", { class: "summary", text: node.summary })
      );
    }
  }

  function announce(text) {
    var live = document.getElementById("live");
    live.textContent = "";
    window.setTimeout(function () { live.textContent = text; }, 30);
  }

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
    button.setAttribute("aria-pressed", dark ? "true" : "false");
    button.textContent = dark ? "Use light mode" : "Use dark mode";
    if (exploreCy) {
      var zoom = exploreCy.zoom();
      var pan = exploreCy.pan();
      exploreCy.style(graphStylesheet());
      exploreCy.zoom(zoom);
      exploreCy.pan(pan);
    }
  }

  function showMode(options) {
    var opts = options || {};
    var explore = state.mode === "explore";
    document.getElementById("status").hidden = true;
    document.getElementById("walk-view").hidden = explore;
    document.getElementById("explore-view").hidden = !explore;
    document.getElementById("tab-walk").setAttribute("aria-selected", explore ? "false" : "true");
    document.getElementById("tab-explore").setAttribute("aria-selected", explore ? "true" : "false");
    writeHash();
    if (explore) {
      window.requestAnimationFrame(function () {
        ensureGraph();
        if (opts.frame && state.selectedId) frameNode(state.selectedId);
      });
    }
  }

  function renderPicker() {
    var host = document.getElementById("path-picker");
    host.replaceChildren();
    data.paths.forEach(function (path) {
      var button = h("button", {
        type: "button",
        class: "path-card",
        "aria-pressed": path.id === currentPath().id ? "true" : "false",
        onClick: function () { choosePath(path.id); }
      });
      button.append(
        h("span", { class: "path-date", text: formatDate(path.advent_sunday || path.date || "") }),
        h("span", { class: "path-title", text: path.title })
      );
      host.append(button);
    });
    var active = host.querySelector('[aria-pressed="true"]');
    if (active) {
      var hostRect = host.getBoundingClientRect();
      var rect = active.getBoundingClientRect();
      if (rect.left < hostRect.left + 4 || rect.right > hostRect.right - 4) {
        host.scrollLeft += rect.left - hostRect.left - 8;
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
        onClick: function () { setStep(index); }
      });
      var track = h("span", { class: "thread-track" });
      var before = h("span", { class: "thread-line", "aria-hidden": "true" });
      var after = h("span", { class: "thread-line", "aria-hidden": "true" });
      if (index === 0) before.classList.add("is-empty");
      else styleLine(before, path.nodes[index - 1], id);
      if (index === path.nodes.length - 1) after.classList.add("is-empty");
      else styleLine(after, id, path.nodes[index + 1]);
      track.append(
        before,
        h("span", { class: "bead", "aria-hidden": "true", text: String(index + 1) }),
        after
      );
      button.append(track, h("span", { class: "thread-label", text: label }));
      if (kind) button.append(h("span", { class: "thread-kind", text: kind }));
      item.append(button);
      host.append(item);
    });
    var current = host.querySelector(".is-current");
    if (current) {
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      current.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: reduce ? "auto" : "smooth"
      });
    }
  }

  function renderStep() {
    var path = currentPath();
    var node = nodeById(path.nodes[state.step]);
    var card = document.getElementById("step-card");
    card.replaceChildren();
    card.append(
      h("p", { class: "kicker", text: "Step " + (state.step + 1) + " of " + path.nodes.length }),
      h("p", { class: "kicker-path", text: path.title })
    );
    if (!node) {
      card.append(h("p", { text: "This stop is missing from the map." }));
      return;
    }
    card.append(h("h3", { class: "step-name", text: node.label }));
    appendNodeBody(card, node);
    card.append(h("button", {
      type: "button",
      class: "text-btn",
      text: "See this stop on the map",
      onClick: function () { openOnMap(node.id); }
    }));
  }

  function renderLink() {
    var path = currentPath();
    var slot = document.getElementById("link-slot");
    slot.replaceChildren();
    var card = h("section", { class: "link-card" });
    if (state.step >= path.nodes.length - 1) {
      card.dataset.confidence = "none";
      card.append(
        h("h3", { class: "link-title", text: "End of this path" }),
        h("p", { class: "next-label", text: "Step back to review a stop, or choose another reading." })
      );
      slot.append(card);
      return;
    }
    var currentId = path.nodes[state.step];
    var nextId = path.nodes[state.step + 1];
    var next = nodeById(nextId);
    var found = edgesBetween(currentId, nextId);
    card.append(
      h("h3", { class: "link-title", text: "The line to the next stop" }),
      h("p", { class: "next-label", text: "Next: " + (next ? next.label : nextId) })
    );
    if (!found.length) {
      card.dataset.confidence = "none";
      card.append(h("p", {
        class: "direction-note",
        text: "No direct line. This reading places the two stops side by side. The map does not draw a line straight from one to the other."
      }));
      slot.append(card);
      return;
    }
    var first = found[0];
    card.dataset.confidence = first.confidence === "typology" ? "typology" : "explicit";
    card.style.setProperty("--link-color", "var(--edge-" + first.type + ")");
    found.forEach(function (edge) {
      if (edge.from !== currentId || edge.to !== nextId) {
        var from = nodeById(edge.from);
        var to = nodeById(edge.to);
        card.append(h("p", {
          class: "direction-note",
          text: "On the map this line runs from " + (from ? from.label : edge.from) + " to " + (to ? to.label : edge.to) + "."
        }));
      }
      card.append(h("p", { class: "badge " + edge.confidence, text: confidenceCopy(edge.confidence) }));
      var facts = h("dl", { class: "facts" });
      addFact(facts, "Line", edgeLabel(edge.type));
      addFact(facts, "Scripture", (edge.refs || []).join(", ") || "None listed");
      if (edge.note) addFact(facts, "Note", edge.note);
      card.append(facts);
    });
    slot.append(card);
  }

  function updateNav() {
    var total = currentPath().nodes.length;
    document.getElementById("prev-step").disabled = state.step <= 0;
    document.getElementById("next-step").disabled = state.step >= total - 1;
  }

  function renderWalk() {
    renderThread();
    renderStep();
    renderLink();
    updateNav();
    var node = nodeById(currentPath().nodes[state.step]);
    if (node) {
      announce("Step " + (state.step + 1) + " of " + currentPath().nodes.length + ". " + node.label);
    }
  }

  function choosePath(id) {
    if (!data.paths.some(function (path) { return path.id === id; })) return;
    state.pathId = id;
    state.step = 0;
    renderPicker();
    renderWalk();
    writeHash();
  }

  function setStep(step) {
    var total = currentPath().nodes.length;
    if (step < 0 || step >= total || step === state.step) return;
    state.step = step;
    renderWalk();
    writeHash();
  }

  function openOnMap(id) {
    state.mode = "explore";
    state.selectedId = id;
    renderPanel();
    renderNameList();
    showMode({ frame: true });
    if (window.matchMedia("(max-width: 959px)").matches) {
      window.setTimeout(function () {
        document.getElementById("panel").scrollIntoView({ block: "start", behavior: "auto" });
      }, 80);
    }
  }

  function dagreReady() {
    try {
      return typeof cytoscape("layout", "dagre") === "function";
    } catch (err) {
      return false;
    }
  }

  function registerDagre() {
    if (dagreReady()) return;
    if (typeof cytoscapeDagre === "function") cytoscapeDagre(cytoscape);
  }

  function layoutOptions() {
    if (dagreReady()) {
      return {
        name: "dagre",
        rankDir: "LR",
        nodeSep: 36,
        edgeSep: 16,
        rankSep: 96,
        animate: false,
        fit: false,
        padding: 28
      };
    }
    return {
      name: "breadthfirst",
      directed: true,
      spacingFactor: 1.35,
      animate: false,
      fit: false,
      padding: 28
    };
  }

  function edgeElements() {
    var elements = [];
    data.edges.forEach(function (edge) {
      if (state.hideTypology && edge.confidence === "typology") return;
      elements.push({
        data: {
          id: edge.from + "__" + edge.to + "__" + edge.type,
          source: edge.from,
          target: edge.to,
          etype: edge.type,
          confidence: edge.confidence
        },
        classes: edge.confidence === "typology" ? "typology" : "explicit"
      });
    });
    return elements;
  }

  function nodeElements() {
    return data.nodes.map(function (node) {
      return {
        data: {
          id: node.id,
          label: node.label,
          ntype: node.type
        }
      };
    });
  }

  function graphStylesheet() {
    var ink = token("--ink");
    var accent = token("--accent-fill");
    var dark = currentTheme() === "dark";
    return [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "text-wrap": "wrap",
          "text-max-width": "136px",
          "text-halign": "center",
          "text-valign": "center",
          "text-justification": "center",
          "text-overflow": "clip",
          "font-family": '"Source Sans 3", "Segoe UI", sans-serif',
          "font-size": 13,
          "font-weight": 600,
          color: ink,
          width: 154,
          height: 72,
          shape: "round-rectangle",
          "background-color": function (ele) { return token("--node-" + ele.data("ntype") + "-fill"); },
          "border-width": 2,
          "border-color": function (ele) { return token("--node-" + ele.data("ntype") + "-line"); },
          "overlay-opacity": 0,
          "shadow-blur": dark ? 0 : 12,
          "shadow-color": "#3a2a22",
          "shadow-opacity": dark ? 0 : 0.12,
          "shadow-offset-y": 3
        }
      },
      {
        selector: "node.picked",
        style: {
          "border-width": 4,
          "border-color": accent,
          opacity: 1
        }
      },
      {
        selector: "edge",
        style: {
          width: 2.5,
          "curve-style": "bezier",
          "line-color": function (ele) { return token("--edge-" + ele.data("etype")); },
          "target-arrow-color": function (ele) { return token("--edge-" + ele.data("etype")); },
          "target-arrow-shape": "triangle",
          "arrow-scale": 0.85,
          opacity: 0.95,
          "overlay-opacity": 0
        }
      },
      {
        selector: "edge.typology",
        style: {
          "line-style": "dashed",
          "line-dash-pattern": [7, 5]
        }
      },
      {
        selector: ".faded",
        style: { opacity: 0.34 }
      }
    ];
  }

  function refreshHighlight() {
    if (!exploreCy) return;
    var id = state.selectedId;
    exploreCy.batch(function () {
      exploreCy.elements().removeClass("faded picked");
      if (!id) return;
      var node = exploreCy.getElementById(id);
      if (!node || node.empty()) return;
      exploreCy.elements().addClass("faded");
      node.removeClass("faded").addClass("picked");
      node.connectedEdges().removeClass("faded");
      node.connectedNodes().removeClass("faded");
    });
  }

  function frameNode(id) {
    if (!exploreCy || !id) return;
    var node = exploreCy.getElementById(id);
    if (!node || node.empty()) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var zoom = Math.max(exploreCy.zoom(), window.innerWidth < 800 ? 0.95 : 0.72);
    exploreCy.stop();
    exploreCy.animate({
      center: { eles: node },
      zoom: zoom
    }, { duration: reduce ? 0 : 280 });
  }

  function createGraph() {
    registerDagre();
    var container = document.getElementById("graph");
    try {
      exploreCy = cytoscape({
        container: container,
        elements: nodeElements().concat(edgeElements()),
        layout: { name: "preset" },
        style: graphStylesheet(),
        minZoom: 0.2,
        maxZoom: 2.6,
        wheelSensitivity: 0.22,
        boxSelectionEnabled: false,
        autoungrabify: true,
        nodeDimensionsIncludeLabels: true
      });
    } catch (err) {
      document.getElementById("graph-error").hidden = false;
      exploreCy = null;
      return;
    }
    var layout = exploreCy.layout(layoutOptions());
    layout.one("layoutstop", function () {
      exploreCy.resize();
      exploreCy.fit(undefined, 36);
      state.fitted = true;
      refreshHighlight();
    });
    layout.run();
    exploreCy.on("tap", function (evt) {
      if (evt.target === exploreCy) {
        clearSelection();
        return;
      }
      if (evt.target.isNode && evt.target.isNode()) {
        selectNode(evt.target.id(), { scrollPanel: true });
        return;
      }
      if (evt.target.isEdge && evt.target.isEdge()) {
        selectNode(evt.target.data("target"), { scrollPanel: true, frame: true });
      }
    });
  }

  function ensureGraph() {
    if (typeof cytoscape !== "function") {
      document.getElementById("graph-error").hidden = false;
      return;
    }
    if (!exploreCy) createGraph();
    if (!exploreCy) return;
    exploreCy.resize();
    if (!state.fitted) {
      exploreCy.fit(undefined, 32);
      state.fitted = true;
    }
    refreshHighlight();
  }

  function relayout(fitAfter) {
    if (!exploreCy) return;
    var layout = exploreCy.layout(layoutOptions());
    layout.one("layoutstop", function () {
      if (fitAfter) exploreCy.fit(undefined, 32);
      refreshHighlight();
    });
    layout.run();
  }

  function renderEdgeDetails(edge, homeId) {
    var otherId = edge.from === homeId ? edge.to : edge.from;
    var other = nodeById(otherId);
    var block = h("div", { class: "edge-block" });
    var button = h("button", {
      type: "button",
      class: "edge-jump",
      onClick: function () { selectNode(otherId, { frame: true, scrollPanel: true, focusPanel: true }); }
    });
    button.append(
      h("span", { class: "edge-dir", text: edge.from === homeId ? "Line to" : "Line from" }),
      h("span", { class: "edge-target", text: other ? other.label : otherId })
    );
    block.append(button);
    block.append(h("p", { class: "badge " + edge.confidence, text: confidenceCopy(edge.confidence) }));
    var facts = h("dl", { class: "facts" });
    addFact(facts, "Line", edgeLabel(edge.type));
    addFact(facts, "Scripture", (edge.refs || []).join(", ") || "None listed");
    if (edge.note) addFact(facts, "Note", edge.note);
    block.append(facts);
    if (state.hideTypology && edge.confidence === "typology") {
      block.append(h("p", { class: "hint", text: "This typology line is hidden on the map right now." }));
    }
    return block;
  }

  function renderPanel() {
    var panel = document.getElementById("panel");
    panel.replaceChildren();
    if (!state.selectedId) {
      panel.append(
        h("h3", { class: "step-name", text: "Choose a name" }),
        h("p", {
          class: "summary",
          text: "Tap the map, or open Pick a name. This panel shows the Scripture for that stop and every line connected to it."
        })
      );
      return;
    }
    var node = nodeById(state.selectedId);
    if (!node) {
      panel.append(h("p", { text: "This stop is missing from the map." }));
      return;
    }
    var title = h("h3", { id: "panel-title", class: "step-name", tabindex: "-1", text: node.label });
    panel.append(title);
    appendNodeBody(panel, node);
    var outgoing = data.edges.filter(function (edge) { return edge.from === node.id; });
    var incoming = data.edges.filter(function (edge) { return edge.to === node.id; });
    if (!outgoing.length && !incoming.length) {
      panel.append(h("p", { class: "summary", text: "No lines touch this name in the map." }));
      return;
    }
    if (outgoing.length) {
      panel.append(h("h4", { class: "section-label", text: "Lines from here" }));
      outgoing.forEach(function (edge) { panel.append(renderEdgeDetails(edge, node.id)); });
    }
    if (incoming.length) {
      panel.append(h("h4", { class: "section-label", text: "Lines to here" }));
      incoming.forEach(function (edge) { panel.append(renderEdgeDetails(edge, node.id)); });
    }
  }

  function renderNameList() {
    var host = document.getElementById("name-list-body");
    host.replaceChildren();
    var seen = {};
    KIND_ORDER.forEach(function (kind) { seen[kind] = true; });
    var kinds = KIND_ORDER.slice();
    data.nodes.forEach(function (node) {
      if (!seen[node.type]) {
        seen[node.type] = true;
        kinds.push(node.type);
      }
    });
    kinds.forEach(function (kind) {
      var group = data.nodes.filter(function (node) { return node.type === kind; })
        .slice()
        .sort(function (a, b) { return a.label.localeCompare(b.label); });
      if (!group.length) return;
      host.append(h("h3", { class: "name-kind", text: kindLabel(kind) }));
      group.forEach(function (node) {
        host.append(h("button", {
          type: "button",
          class: "name-btn",
          "aria-pressed": node.id === state.selectedId ? "true" : "false",
          text: node.label,
          onClick: function () { selectNode(node.id, { frame: true, scrollPanel: true, focusPanel: true }); }
        }));
      });
    });
  }

  function selectNode(id, options) {
    var opts = options || {};
    state.selectedId = id;
    state.mode = "explore";
    renderPanel();
    renderNameList();
    refreshHighlight();
    if (opts.frame) frameNode(id);
    writeHash();
    if (opts.scrollPanel && window.matchMedia("(max-width: 959px)").matches) {
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("panel").scrollIntoView({
        block: "start",
        behavior: reduce ? "auto" : "smooth"
      });
    }
    if (opts.focusPanel) {
      var title = document.getElementById("panel-title");
      if (title) title.focus();
    }
    var node = nodeById(id);
    if (node) announce(node.label);
  }

  function clearSelection() {
    state.selectedId = null;
    renderPanel();
    renderNameList();
    refreshHighlight();
    writeHash();
  }

  function renderLegend() {
    var edges = document.getElementById("edge-legend");
    var nodes = document.getElementById("node-legend");
    edges.replaceChildren();
    nodes.replaceChildren();
    EDGE_ORDER.forEach(function (key) {
      var item = h("li");
      item.append(h("span", { class: "swatch", "data-edge": key }), document.createTextNode(edgeLabel(key)));
      edges.append(item);
    });
    KIND_ORDER.forEach(function (key) {
      var item = h("li");
      item.append(h("span", { class: "kind-dot", "data-kind": key }), document.createTextNode(kindLabel(key)));
      nodes.append(item);
    });
  }

  function typologyHint() {
    document.getElementById("typology-hint").textContent = state.hideTypology
      ? "Typology lines are hidden. A name's details still mention them."
      : "Hiding typology leaves only lines the New Testament states.";
  }

  function zoomBy(factor) {
    if (!exploreCy) return;
    var next = exploreCy.zoom() * factor;
    next = Math.max(exploreCy.minZoom(), Math.min(exploreCy.maxZoom(), next));
    exploreCy.zoom({
      level: next,
      renderedPosition: { x: exploreCy.width() / 2, y: exploreCy.height() / 2 }
    });
  }

  function bind() {
    document.getElementById("tab-walk").addEventListener("click", function () {
      state.mode = "walk";
      showMode();
    });
    document.getElementById("tab-explore").addEventListener("click", function () {
      state.mode = "explore";
      showMode();
      renderPanel();
      renderNameList();
    });
    document.getElementById("theme-toggle").addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      try { localStorage.setItem("scarlet-thread-theme", next); } catch (err) { /* ignore */ }
      applyTheme(next);
    });
    document.getElementById("prev-step").addEventListener("click", function () { setStep(state.step - 1); });
    document.getElementById("next-step").addEventListener("click", function () { setStep(state.step + 1); });
    document.getElementById("hide-typology").addEventListener("change", function (event) {
      state.hideTypology = event.target.checked;
      typologyHint();
      renderPanel();
      if (!exploreCy) return;
      exploreCy.edges().remove();
      exploreCy.add(edgeElements());
      relayout(true);
    });
    document.getElementById("zoom-in").addEventListener("click", function () { zoomBy(1.25); });
    document.getElementById("zoom-out").addEventListener("click", function () { zoomBy(0.8); });
    document.getElementById("zoom-fit").addEventListener("click", function () {
      if (!exploreCy) return;
      exploreCy.fit(undefined, 32);
      state.fitted = true;
    });
    document.addEventListener("keydown", function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (state.mode !== "walk") {
        if (event.key === "Escape" && state.selectedId) clearSelection();
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
      renderNameList();
      showMode();
    });
    window.addEventListener("resize", function () {
      if (exploreCy && !document.getElementById("explore-view").hidden) exploreCy.resize();
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
    status.textContent = message;
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
    if (window.matchMedia("(min-width: 960px)").matches) {
      document.getElementById("legend-details").open = true;
    }
    renderPicker();
    renderWalk();
    renderPanel();
    renderNameList();
    typologyHint();
    showMode();
  }

  fetch("data/advent-graph.json")
    .then(function (response) {
      if (!response.ok) throw new Error("status " + response.status);
      return response.json();
    })
    .then(function (json) {
      if (!json || !Array.isArray(json.nodes) || !Array.isArray(json.edges) || !Array.isArray(json.paths)) {
        throw new Error("The map file is missing nodes, edges, or paths.");
      }
      data = json;
      start();
    })
    .catch(function () {
      fail("The map could not be loaded. Start a local web server in the project folder, then open this site from that server. Opening the HTML file directly blocks the map.");
    });
})();
