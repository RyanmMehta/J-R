# R@JC

Jenna Chuan's personal site, built as one research journal you read by turning its pages.

Plain HTML, CSS and JavaScript. There's no build step and nothing to install.

## How it works

1. **Cover.** The closed book follows the mouse, the same amount in every direction. On phones it leans a little as the phone tilts, and a finger dragged across the screen turns it too. iPhones ask once for permission to use motion, the first time someone touches the page anywhere other than the book. Clicking the book turns the cover and the first page to the table of contents.
2. **Turning to a section.** Picking a chapter turns the pages forward to that section's two-page spread. The book lies flat and the camera zooms in until the spread fills the screen.
3. **Reading.** Once zoomed in, the real text takes over, so it's sharp, selectable and scrollable. The pages in the 3D book are copies of these same pages, so the hand-off is seamless.
4. **Index tabs.** Clicking a tab on the page edge (along the bottom on phones) zooms back out, turns forward or back to that section, and zooms in again. Contents goes back to the table of contents. Escape and the arrow keys work too.

Links like `index.html#research` open straight to a section. Sections: `intro`, `research`, `building`, `community`, `appendix`, `contact`, plus `contents`.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Where things live

- `index.html`: the book (cover, flyleaf, contents and six leaves) and, below it, the reading layer with each section's two pages. Edit section text in the reading layer only; `js/book.js` copies each page into the book when the page loads.
- `styles.css`: the desk, the 3D book, the cover, the contents and welcome pages. Book size and timing settings are at the top (`--w` page width, `--t` thickness, `--flip` turn time).
- `pages.css`: the section pages and the reading view. Every size on a page is a multiple of `--u`, 1% of the page width, which is what lets a page look identical in the book and when zoomed in. The blue and pink accents are phycocyanin and phycoerythrin, the two algal pigments from entry 03.
- `js/book.js`: opening, turning, zooming, tabs, deep links and the tilt.
- `js/pages.js`: paper and poster previews on research titles, the Explain sheets and their figures, the introduction timeline, the HappyPEA pea and copying the email address.
- `assets/`: the portrait (`jenna-chuan.jpg`).

## Explain sheets

Each research entry has an **Explain** button. It opens a sheet with a deeper write-up and a small interactive figure. The write-ups live in `<template id="deep-…">` blocks at the bottom of `index.html`, and each figure's behavior is in the `FIGURES` object in `js/pages.js`. Figures that use example data say so in their captions.

## Fitting content on a page

On wide screens each page has a fixed shape (1 : 1.4), like a real page. If you add text to a section, check that it still fits on its page at a 1440 × 900 window. On phones and narrow windows the pages stack and grow to fit, so length matters less there.

## Swapping in real posters and papers

Each research entry has a `<figure class="pv">` drawn in HTML as a preview. Replace its contents with an `<img>` of the real poster or the paper's first page.
