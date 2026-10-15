# R@JC

A portfolio site styled as a research journal. It opens on a 3D lab notebook with the owner's photo and name on the cover. Clicking the book turns the cover and the first page, landing on the table of contents.

Plain HTML, CSS and JavaScript. There's no build step and nothing to install.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Changing the name, photo and tagline

Edit the `JOURNAL` block at the top of `js/journal.js`:

```js
const JOURNAL = {
  name: 'Jane Doe',
  tagline: 'Scientist · Researcher · Curious Mind',
  photo: 'assets/portrait-placeholder.svg',
  volume: '01',
};
```

Put the real photo in `assets/` (a square-ish portrait works best) and point `photo` at it. Also update the `<title>` and `alt` text in `index.html`, so the page reads right before the script runs.

## Where things live

- `index.html`: the book's layers, from bottom to top: back cover, page edges, table of contents, the flyleaf (bookplate on the front, welcome note on the back), and the front cover.
- `styles.css`: the desk, the 3D book, cover art, the page-turn shading and the inside pages. Size and timing settings are at the top (`--w` page width, `--t` thickness, `--flip` turn time, `--stagger` delay between the cover and the first page).
- `js/journal.js`: the customer details, open and close, keyboard support and the mouse tilt.

## Behaviour

- Click the book, or focus it and press Enter or Space, to open it. Close it with the "Close journal" button or Escape.
- On phones the right-hand page (the table of contents) stays centred and the left page swings off to the side.
- If the visitor's device asks for reduced motion, the book opens without animating.
- The table of contents links are placeholders until the inner pages are built.
