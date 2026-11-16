# Scarlet Thread

Scarlet Thread tells Bible stories as one connected graph that points to Jesus Christ. People, places, events, and promises are nodes. Lines between them are family ties, covenants, prophecy and fulfillment, and Old Testament types that point to Christ.

The perspective is Reformed and Christ-centered, in the line of the Westminster Standards. The wording is meant for a new believer. Scripture quotations are short excerpts from the ESV.

This first version is an Advent map for 2026. It has 16 nodes, 19 edges, and five guided paths: the four Advent Sundays, then Christmas Day.

## How to read it

The site has two modes.

**Walk a week.** Choose Week 1, Week 2, Week 3, Week 4, or Christmas. Move with Back and Next (or the arrow keys). Next names the stop that comes after, and at the end of a week it moves on to the next week. Each stop opens with a short explanation and a quote when the map has one. A rail beside the reading (above it on a phone) marks where you are on the week, and the line between two stops shows whether the New Testament makes that connection, whether it is a picture of Jesus, or whether the two stops only sit side by side.

**See the map.** An interactive graph of every node and edge. Drag to pan, and pinch or use the buttons to zoom. Solid edges are stated in Scripture. Dashed edges are typology. Colors follow the edge type, and the key in the corner of the map explains them. A switch hides typology edges. Choose a node to open its reading beside the map (below it on a phone). If the drawing is hard to use, the list of names in the same place opens the same details.

A solid line means the New Testament itself draws the link. A dashed line is typology, an interpretive picture. Faithful readers may differ on those.

Sermon links come from Faith Presbyterian Church Tacoma's YouTube channel: https://www.youtube.com/@faithpresbyterianchurch-ta4701. They are listed in `data/sermons.json`, under each node id, best match first. To add one, copy an existing entry and fill in `title`, `preacher`, `date`, `service`, `text`, `url`, `start_seconds`, `match` (`exact` or `thematic`), and `notes`. Use the YouTube URL as published. Do not invent a sermon or a link.

Each stop opens with a short explanation. Go deeper, from `data/deeper.json`, tells the story, quotes the main verses, and walks the lines on the map. Go deepest, from `data/confessions.json`, quotes the Westminster Confession and Catechisms in the modern spelling text on the Orthodox Presbyterian Church site, with the Scripture proofs printed in the editions at thewestminsterstandard.org. Add a section only when it really speaks to that stop, and keep every quotation exact.

The app works on a phone and on a desktop, in light mode and in dark mode.

## The data model

The map lives in `data/advent-graph.json`. Do not change the Scripture quotes or the references. Do not add connections that are not already in the file.

### Top level

- `meta`: title, version, translation, and notes for editors.
- `paths`: guided readings.
- `nodes`: people, places, events, promises, and teachings.
- `edges`: directed links from one node to another.

### Path fields

- `id`: stable key.
- `title`: name shown in the path list.
- `advent_sunday` or `date`: the calendar day for that reading, as `YYYY-MM-DD`.
- `nodes`: node ids in reading order.

### Node fields

- `id`: stable key.
- `label`: name shown to the reader.
- `type`: kind of node. This map uses `person`, `place`, `event`, `promise`, `covenant`, `prophecy`, and `teaching`.
- `refs`: Scripture references for the node. An array of strings.
- `summary`: optional short explanation in our own words.
- `quote`: optional short ESV excerpt. It has `ref` (the citation) and `text` (the excerpt, unchanged).

### Edge fields

- `from`: source node id.
- `to`: target node id.
- `type`: kind of link. This map uses `family_line`, `prophecy_fulfillment`, `promise_narrowing`, `event_sequence`, `place_link`, and `type_to_christ`.
- `confidence`: `explicit` or `typology`. See below.
- `refs`: Scripture references for the link. An array of strings.
- `note`: optional caution or explanation. Show it as written.

### Confidence flags

`explicit` means the New Testament itself draws the link. The app calls this "Stated in Scripture" and draws a solid line.

`typology` means an interpretive link. Faithful readers may differ. The app calls this "Typology" and draws a dashed line. The note on a typology edge says how to hold it (for example, as illustration only).

Some stops on a guided path sit next to each other without a direct edge. The app says so. It does not invent a line to fill the gap.

## Run it locally

The app is static. It has no build step and no server of its own. The browser loads `data/advent-graph.json`.

From the project folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080

Opening `index.html` as a file will not load the map. Browsers block that fetch. Use a local web server.

Any other static server works too. For example: `npx --yes serve`.

The graph library is included in `vendor/` (Cytoscape.js and dagre, both MIT licensed), so the map works without a network connection once the page is served. The app runs the dagre layout itself and routes each line left to right from it. The reading font, Source Serif 4, is served from `fonts/` under the SIL Open Font License (see `fonts/OFL.txt`). Interface text uses the system sans serif.

## GitHub Pages

`.github/workflows/pages.yml` publishes the site on every push to `main`. The workflow copies the static files and deploys that folder with GitHub Actions. There is nothing to compile.

After Pages is enabled, the default address for this repository is:

https://netpaddler.github.io/Scarlett-thread/

The repository name is `Scarlett-thread`, so the address uses that spelling.

### What Pete needs to do

1. Merge the pull request into `main`.
2. On GitHub, open the repository Settings, then Pages.
3. Under Build and deployment, set Source to GitHub Actions.
4. Open the Actions tab and confirm the "Deploy to GitHub Pages" workflow succeeds. The first run can wait until a maintainer approves the `github-pages` environment. Approve it if GitHub asks. If the first run failed because Pages was still turned off, use Re-run jobs after step 3.
5. Open the Pages URL above. Settings, then Pages, also shows the live URL after a successful deploy.

If the repository is private, GitHub Pages for a private repository depends on the account plan. A public repository can serve this site on the free plan.

Before a public launch, check the ESV excerpts in `data/advent-graph.json` against the licensed text. The file's own editor note asks for that check. The app copies those quotes as they are and does not rewrite them.

## Project layout

- `index.html`, `styles.css`, `app.js`: the site.
- `data/advent-graph.json`: the Advent map.
- `data/sermons.json`: Faith Presbyterian sermon links for each node.
- `data/confessions.json`: Westminster Confession and Catechism quotations for each stop.
- `data/deeper.json`: the Go deeper reading for each stop and each week.
- `vendor/`: Cytoscape.js and dagre.
- `fonts/`: Source Serif 4 and its license.
- `favicon.svg`: the mark.
- `.github/workflows/pages.yml`: the Pages deploy.
