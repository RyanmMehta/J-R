# R@JC

Jenna Chuan's personal site, styled as a research journal.

- `index.html` is the cover: a 3D lab notebook with her photo and name. Clicking it turns the cover and the first page, landing on a table of contents. Picking a chapter lifts the book away and opens the journal at that section.
- `journal.html` is the journal: the opening (portrait, name, tagline), then three chapters (Research, Building, Community), an appendix of honors and certifications, and contact details.

Plain HTML, CSS and JavaScript. There's no build step and nothing to install.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Swapping in real images

- **Portrait:** put the photo in `assets/` and point both pages at it: the `photo` field in `js/journal.js` (cover) and the `<img>` in the opening of `journal.html`.
- **Paper and poster previews:** each research entry in `journal.html` has a `<figure class="pv">` drawn in HTML. Replace its contents with an `<img>` of the real poster or first page.
- **Résumé:** `assets/Jenna-Chuan-Resume.pdf`.

## Where things live

- `styles.css` and `js/journal.js`: the cover. Size and timing settings are at the top of `styles.css` (`--w` page width, `--t` thickness, `--flip` turn time).
- `journal.css` and `js/pages.js`: the journal. Colors and fonts are tokens at the top of `journal.css`. The blue and pink accents are phycocyanin and phycoerythrin, the two algal pigments from her Freshman Research Initiative project.

## Interactions in the journal

- Hovering over a research title shows a preview of the paper or poster. Clicking or tapping pins it open (on phones it opens under the entry).
- The handwritten notes in the margin open a short explanation.
- Images and project art settle into place as they scroll into view. The maze traces its path and the regression line draws itself.
- The pea next to HappyPEA bounces and says something when clicked.
- The running head at the top shows the current chapter and its page number from the table of contents.
- If the visitor's device asks for reduced motion, everything appears without animating.
