# Scarlet Thread

Scarlet Thread tells Bible stories as one connected graph that points to Jesus Christ. People, places, events, and promises are nodes. Lines between them are family ties, covenants, prophecy and fulfillment, and Old Testament types that point to Christ.

The perspective is Reformed and Christ-centered, in the line of the Westminster Standards. The wording is meant for a new believer. Scripture quotations are short excerpts from the ESV.

This first version is an Advent map for 2026. It has 17 nodes, 21 edges, and five guided paths: the four Advent Sundays, then Christmas Day.

## How to read it

The site has three modes.

**Walk a week.** Choose Week 1, Week 2, Week 3, Week 4, or Christmas. Move with Back and Next (or the arrow keys). Next names the stop that comes after, and at the end of a week it moves on to the next week. Each stop opens with a short explanation and a quote when the map has one. A rail beside the reading (above it on a phone) marks where you are on the week, and the line between two stops shows whether the connection is direct, interpretive, or only side by side.

**See the map.** An interactive graph of every node and edge. Drag to pan, and pinch or use the buttons to zoom. Solid edges are direct textual or narrative connections. Dashed edges are interpretive. Colors follow the edge type, and the key in the corner of the map explains them. A switch hides interpretive edges. Choose a node to open its reading beside the map (below it on a phone). If the drawing is hard to use, the list of names in the same place opens the same details.

**Ask for a stop.** Comments/Requests holds a short form. A reader names a person or an event that is missing from the map, says why it belongs, and sends it. Past submissions are listed under the form, newest first, with any reply.

The title in the top bar is a link back to the start: Week 1, first stop.

A solid line marks a direct textual or narrative connection. A dashed line marks an interpretive connection. Open a stop and go deeper for the exact claim.

Sermon links come from Faith Presbyterian Church Tacoma's YouTube channel: https://www.youtube.com/@faithpresbyterianchurch-ta4701. They are listed in `data/sermons.json`, under each node id, best match first. To add one, copy an existing entry and fill in `title`, `preacher`, `date`, `service`, `text`, `url`, `start_seconds`, `match` (`exact` or `thematic`), and `notes`. Use the YouTube URL as published. Do not invent a sermon or a link.

Each stop opens with a short explanation. Go deeper, from `data/deeper.json`, tells the story, quotes the main verses, and walks the lines on the map. Go deepest, from `data/confessions.json`, quotes the Westminster Confession and Catechisms in the modern spelling text on the Orthodox Presbyterian Church site, with Scripture proofs from the OPC's 2005 proof-text editions. Add a section only when it really speaks to that stop, and keep every quotation exact.

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
- `type`: kind of link. This map uses `family_line`, `prophecy_fulfillment`, `promise_narrowing`, `event_sequence`, `place_link`, `prophet_voice`, and `type_to_christ`. `prophet_voice` runs from a prophet to a saying in his own book.
- `confidence`: `explicit` or `typology`. See below.
- `refs`: Scripture references for the link. An array of strings.
- `note`: optional caution or explanation. This one is for editors. The app does not display it. The reader sees a longer form of the same caution in the matching entry under `connections` in `data/deeper.json`. Change the two together.

### Confidence flags

`explicit` means a direct textual or narrative connection. The app draws a solid line and points the reader to the exact claim, which it prints under Go deeper from the matching entry in `data/deeper.json`.

`typology` means an interpretive link. Faithful readers may differ. The app draws a dashed line.

Some stops on a guided path sit next to each other without a direct edge. The app says so. It does not invent a line to fill the gap.

## Comments and requests

The form posts to a Cloudflare Worker. The Worker opens a public GitHub issue in this repository for each submission, labels it `map-request`, and adds a short reply. A GET to the same Worker returns the labeled issues and their comments, stripped of HTML, so the site can list them. Nothing is stored anywhere else.

The GitHub token never reaches the browser. It lives in the Worker as a secret.

`config/requests.js` holds the two public values, the Worker endpoint and the Turnstile site key. While `endpoint` is empty the site shows "Requests open soon" and no form.

To open it:

1. `cd worker` and `npx wrangler deploy`.
2. `npx wrangler secret put GITHUB_TOKEN`. Use a fine grained token limited to this repository, with read and write on Issues and nothing else.
3. Make a Turnstile widget in the Cloudflare dashboard for the site's domain, then `npx wrangler secret put TURNSTILE_SECRET`.
4. Put the Worker URL in `endpoint` and the Turnstile site key in `turnstileSiteKey` in `config/requests.js`, then push.

`worker/wrangler.toml` carries the three plain settings: `REPO`, `LABEL`, and `ALLOWED_ORIGIN`. The Worker rate limits to five submissions an hour for each address, drops anything that fills the hidden Company field, and refuses an origin that is not `ALLOWED_ORIGIN`.

Issues created this way are public, and so are the names people type. The form says the submission is read. It does not promise privacy.

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

The ESV excerpts and references were independently checked against esv.org in November 2026. The app copies those quotes as they are and does not rewrite them.

## Project layout

- `index.html`, `styles.css`, `app.js`: the site.
- `data/advent-graph.json`: the Advent map.
- `data/sermons.json`: Faith Presbyterian sermon links for each node.
- `data/confessions.json`: Westminster Confession and Catechism quotations for each stop.
- `data/deeper.json`: the Go deeper reading for each stop and each week.
- `vendor/`: Cytoscape.js and dagre.
- `fonts/`: Source Serif 4 and its license.
- `config/requests.js`: the public endpoint and site key for the form.
- `worker/`: the Cloudflare Worker behind Comments/Requests.
- `favicon.svg`: the mark.
- `.github/workflows/pages.yml`: the Pages deploy.
