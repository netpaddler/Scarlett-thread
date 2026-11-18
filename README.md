# Scarlet Thread

Scarlet Thread tells Bible stories as one connected graph that points to Jesus Christ. People, places, events, and promises are nodes. Lines between them are family ties, covenants, prophecy and fulfillment, and Old Testament types that point to Christ.

The perspective is Reformed and Christ-centered, in the line of the Westminster Standards. The wording is meant for a new believer. Scripture quotations are short excerpts from the ESV.

This first version is an Advent map for 2026. It has 17 nodes, 21 edges, and five guided paths: the four Advent Sundays, then Christmas Day. Three more books sit beside it and are described below: a pilot through Deuteronomy, Isaiah, and Revelation.

## How to read it

The site has three modes.

**Walk a week.** Choose Week 1, Week 2, Week 3, Week 4, or Christmas. Move with Back and Next (or the arrow keys). Next names the stop that comes after, and at the end of a week it moves on to the next week. Each stop opens with a short explanation and a quote when the map has one. A rail beside the reading (above it on a phone) marks where you are on the week, and the line between two stops shows whether the connection is direct, interpretive, or only side by side.

**See the map.** An interactive graph of every node and edge. Drag to pan, and pinch or use the buttons to zoom. Solid edges are direct textual or narrative connections. Dashed edges are interpretive. Colors follow the edge type, and the key in the corner of the map explains them. A switch hides interpretive edges. Choose a node to open its reading beside the map (below it on a phone). If the drawing is hard to use, the list of names in the same place opens the same details.

**Ask for a stop.** Comments/Requests holds a short form. A reader names a person or an event that is missing from the map, says why it belongs, and sends it. Past submissions are listed under the form, newest first, with any reply.

The title in the top bar is a link back to the start: Week 1, first stop. The browser Back button steps back through the stops and the names you opened, instead of leaving the site.

A solid line marks a direct textual or narrative connection. A dashed line marks an interpretive connection. Open a stop and go deeper for the exact claim.

Sermon links come from Faith Presbyterian Church Tacoma's YouTube channel and sermon archive. Advent links are listed in `data/sermons.json`, and Deuteronomy links are listed in `data/deuteronomy-sermons.json`, under each node id, best match first. A YouTube entry uses the published video URL and a caption checked start time. An archive entry uses the verified faithtacoma.org page. Each entry gives `title`, `preacher`, `date`, `text`, `url`, and `match`. YouTube entries also give `start_seconds`. Use `exact` when the sermon text contains the stop's passage, or `overlap` when it covers only part of the passage or a nearby passage. Give every overlap a brief, honest note. Do not invent a sermon, link, or timestamp.

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

Some stops on a guided path sit next to each other without a direct edge. The app says so. It does not invent a line to fill the gap. Under Lines on the map, each stop names the edges it really has. Those usually run to Jesus or to the birth rather than to the stop beside it, which is why most of a week's rail is dotted.

## The Deuteronomy book view

Beside the Advent map there is a second book, `data/deuteronomy-graph.json`, labeled "Deuteronomy (pilot)". A switcher under the introduction moves between the two. Switching rebuilds the walk, the legend, the picker, and the drawing. Advent is the default and reads exactly as it did before.

The Deuteronomy map has 15 nodes, 14 edges, and two paths. "Through the book" reads Moses' last sermon in order, ten stops from the plains of Moab to his grave. "Deuteronomy in the New Testament" sets each Deuteronomy text beside the writer who quotes it, twelve stops. Where a New Testament writer quotes two Deuteronomy texts, that writer stands between them on the path.

The file uses the same schema as the Advent map, with extra `meta` keys that carry the wording for the book: `eyebrow`, `intro_title`, `intro_text`, `path_word`, `subtitle`, `picker_label`, `graph_label`, `path_line_default`, `key_note`, and `tabs`. `path_word` is the word the interface uses for one guided reading, "path" here and "week" for Advent. The Advent file has none of these keys, so it falls back to the copy the page ships with.

Two edge types are new. `quoted_by` is a New Testament writer quoting Deuteronomy. Most of those quotations are marked in the text with a phrase such as "it is written", "Moses said", or "first Moses says"; two are not, and the notes on those stops say so. `book_sequence` is a link Deuteronomy makes inside itself, where the book carries the reader from one of these passages to another in its own words. Both types carry the same `explicit` and `typology` flags as every other edge.

Where a quotation differs in wording from the ESV of Deuteronomy, the edge note gives both wordings. It does not say which Greek text the writer was using. No source available here could settle that, so the notes state the difference and leave the cause alone.

Node ids and path ids are unique across all the books, so a link names the book as well as the stop. `#walk/deut_nt/5` and `#explore/dt_prophet` both open Deuteronomy. `#explore/deuteronomy` opens its map with nothing selected. Advent links are unchanged, including the plain `#explore`.

`data/deeper.json` and `data/confessions.json` are shared between the books, and the Deuteronomy ids were added to both. Advent keeps its existing sermon data in `data/sermons.json`. Deuteronomy sermons live separately in `data/deuteronomy-sermons.json`, so adding the second book does not alter Advent's entries.

Go deepest on the Deuteronomy stops reuses Westminster sections already in `data/confessions.json`, whose text and proofs were checked against the OPC editions in the earlier audit. No new section was added. The OPC proof-text PDFs are page scans with no text layer, so a new section's proofs could not be verified, and the rule is to leave a section out rather than guess at it.

## The Isaiah and Revelation books

Two more books follow the Deuteronomy pattern: `data/isaiah-graph.json`, labeled "Isaiah", and `data/revelation-graph.json`, labeled "Revelation". Each has 23 nodes and two paths, and each uses the same schema and the same `meta` keys as Deuteronomy. Their Go deeper and Go deepest text is in the shared `data/deeper.json` and `data/confessions.json`. Neither has sermon links yet. None were invented.

The Isaiah map has 18 edges. "Through the book" reads sixteen stops in the book's own order, from the opening vision to the new heavens and new earth. "Isaiah in the New Testament" sets Isaiah's words beside the New Testament writers who use them, thirteen stops. The Advent map already has four Isaiah stops (`isaiah`, `prophecy_immanuel`, `prophecy_child`, `jesse_root`). They are unchanged.

The Revelation map has 23 edges. "Through the book" follows John's visions in the order he tells them, sixteen stops. "Revelation and the Old Testament" puts each Old Testament root before the vision that draws on it, sixteen stops.

Three things are new in these two files.

- `ot_echo` is an edge type for shared wording with no citation formula. Revelation never says "it is written", so its Old Testament lines are echoes, and each note says what is shared and what differs. An echo marked `explicit` is one where the same phrase stands in both texts. Looser links are marked `typology` and drawn dashed.
- `meta.edge_labels` lets a book rename an edge type for the reader. `book_sequence` reads "Next in Isaiah" in one book and "Next in the vision" in the other. Advent and Deuteronomy have no such key and read as before.
- `see_also` on a node points to a stop on another map. It is a list of `id` and `text`. The app shows it under "On another map" as a link, and the browser Back button returns. This is how the Isaiah stops reach the Advent stops for the same verses, and how Isaiah and Revelation reach each other. A target on a book that failed to load is left out.

The Isaiah book's key is `isaiah_book`, not `isaiah`, because the Advent map already has a stop with the id `isaiah` and `#explore/isaiah` must keep opening it. So `#explore/isaiah_book` and `#explore/revelation` open those maps with nothing selected, and `#walk/isaiah_nt/3` or `#explore/rv_lamb` open a stop.

### Disputed passages

Where faithful Reformed readers differ, the stop describes the main views, labels them "Interpretation", and does not choose. On Revelation 20 the amillennial, postmillennial, and historic premillennial views are each described, with what all three share. Dispensational timelines are named and not laid out. The same rule covers the seals, the 144,000, the two witnesses, the woman of chapter 12, the beasts and 666, Babylon, the rider of 19:11, the four broad approaches to the book, and its date. In Isaiah it covers the near meaning of the Immanuel sign, the Servant Songs as one figure, Isaiah 14:12, Isaiah 65:20, and the date of chapters 40 to 66. In the visions, a `book_sequence` edge is the order John tells them in. The join between chapters 19 and 20 is drawn dashed because that order is the disputed point.

## Lines between the books and the All books view

`data/cross-links.json` ties the books together. It adds no stops and changes none. It has three parts.

- `links`: one line from a stop in one book to a stop in another. Each has an `id`, `from` (the earlier text), `to` (the later one), a `type`, `refs`, and a `note` in plain words. The types are `quotation` (the later writer quotes the earlier words and says so), `fulfillment` (the New Testament states the earlier word came true), `allusion` (shared wording with no citation formula), `typology` (interpretive, drawn dashed, and the note says what Scripture does and does not state), and `same_passage` (two books each have a stop on the same passage). Only add a link the text supports, and quote the ESV exactly.
- `threads`: guided paths across the books, such as "The Lamb". A thread is a list of existing stop ids. Where two neighbouring stops have no line between them the walk shows a dotted join.
- `overview`: the wording for the All books view.

In the app a stop with links shows them under "In other books", as "Also in Isaiah: ..." with the kind of link, the note, and the references. The chip is a plain hash, so it opens the stop in the other book and Back returns. A `see_also` entry that a link already covers is not shown twice.

"All books" is the last button in the book switcher. It is not a file. The app builds it from the books that loaded plus the links. Each book is a box on the map, laid out as on its own map, and the thick lines are the links between books. The Walk tab walks the threads, and the timeline shows every entry from every book. Its hashes are `#explore/all`, `#explore/all/<stop id>`, and `#walk/<thread id>/<step>`. If `cross-links.json` fails to load, the four books read as before and the All books button is not shown.

## The timeline

A band above the map sets the map's stops beside world history. It is on every map. The top track holds the Bible dates for the stops of the book that is open. The bottom track holds world history: Egypt's kingdoms and pharaohs, Hammurabi, the Hittites, Assyria and the fall of Samaria, Babylon and the fall of Jerusalem, Cyrus and Persia, Alexander, the Maccabees, Rome, Augustus, Herod, Pilate, and the destruction of the temple. A row of chips under the tracks gives the modern name of each place, such as Ur in southern Iraq.

Hover or choose a stop on the map and its dates light up on the timeline, and the timeline scrolls to them. Tap a date and its note opens over a corner of the map, with the matching stop chosen and framed where there is one. The plus and minus buttons stretch and squeeze the band, and it scrolls sideways. The Timeline button folds it away. On a phone it starts folded.

The scale is not even. A century is drawn as wide as the number of things that begin in it, so the years around the birth of Jesus are not one smear. The band says so, and the axis labels the centuries.

Everything on the band comes from `data/timeline.json`. No date lives in the code. If the file fails to load, the band is hidden and the map reads as it did before.

### Timeline fields

`events` holds the dated entries and `places` holds the modern place names.

- `id`: stable key.
- `track`: `bible` or `world`. Events only.
- `label`: name shown to the reader.
- `date`: events only. `start` and `end` are whole years, negative for BC, so 1446 BC is `-1446`. `end` is `null` for a single year. `display` is the wording the reader sees, such as "c. 1446 to 1406 BC".
- `modern`: places only. Where the place is today.
- `note`: a short explanation in plain words.
- `source`: a Scripture reference for a Bible entry. For world history, a standard reference named at the level of the work, with Scripture beside it where Scripture speaks of the same event.
- `certainty`: `firm`, `approximate`, `disputed`, `traditional`, or `undated`. The file's top level `certainty` object holds the sentence the reader sees for each.
- `alternatives`: optional. The other view on a disputed date. Each has `display` and `note`. One that also has `start` is drawn on the band as its own dashed marker.
- `nodes`: the map stops the entry belongs to. This is the link between the band and the map.
- `books`: optional. Limits an entry to the maps it names: `advent`, `deuteronomy`, `isaiah_book`, or `revelation`. Without it the entry shows on every map.

### Timeline rules

- Do not invent an event or a date. Leave an entry out before guessing at it.
- Every early date carries "c." for about. Write a range with the word "to".
- Nothing in Genesis 1 to 11 carries a year. Such an entry has `start: null` and `certainty: undated`, and the band draws it in a box marked as not dated.
- Where scholars differ, keep one primary date and put the other view under `alternatives`. Do not pick silently. A `disputed` entry must have an alternative.
- The early date of the Exodus (c. 1446 BC, from 1 Kings 6:1) is primary. The late date (c. 1260s BC) is always shown beside it. The dates for Abraham, Jacob, Sinai, the wilderness, and Deuteronomy are counted from the early date and say so.
- The Bible does not name the pharaoh of the Exodus, so the notes on Thutmose III and Ramesses II call the link a suggestion.
- Revelation is dated c. AD 95, under Domitian, following Irenaeus. The date before AD 70 is shown beside it as a minority view. Isaiah 40 to 66 and Daniel 7 keep the books' own dating as primary and show the later critical dates beside them.
- Every stop on every map has at least one dated entry.
- The world history dates were written from the standard references named in each entry. They have not yet had the line by line check against sources that the rest of the site has had in `AUDIT.md`.

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

The app is static. It has no build step and no server of its own. The browser loads the four graph files in `data/`.

From the project folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080

Opening `index.html` as a file will not load the map. Browsers block that fetch. Use a local web server.

Any other static server works too. For example: `npx --yes serve`.

The graph library is included in `vendor/` (Cytoscape.js and dagre, both MIT licensed), so the map works without a network connection once the page is served. The two files come to about 650KB, so the page does not fetch them until a reader opens the map. The walk never needs them. The app runs the dagre layout itself and routes each line left to right from it. The reading font, Source Serif 4, is served from `fonts/` under the SIL Open Font License (see `fonts/OFL.txt`). Interface text uses the system sans serif.

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
- `data/deuteronomy-graph.json`: the Deuteronomy map.
- `data/isaiah-graph.json`: the Isaiah map.
- `data/revelation-graph.json`: the Revelation map.
- `data/sermons.json`: Faith Presbyterian sermon links for Advent nodes.
- `data/deuteronomy-sermons.json`: Faith Presbyterian sermon links for Deuteronomy nodes.
- `data/confessions.json`: Westminster Confession and Catechism quotations for each stop.
- `data/deeper.json`: the Go deeper reading for each stop and each week.
- `data/timeline.json`: the dates, world history, and modern place names for the timeline band.
- `vendor/`: Cytoscape.js and dagre.
- `fonts/`: Source Serif 4 and its license.
- `config/requests.js`: the public endpoint and site key for the form.
- `worker/`: the Cloudflare Worker behind Comments/Requests.
- `favicon.svg`: the mark.
- `.github/workflows/pages.yml`: the Pages deploy.
