# Mosaic Bookcase Planner

A small website for planning a mosaic crochet blanket from the Zigz Crochet
*Mosaic Bookcase (Extended Version)* charts:

- **Design:** arrange the charts on a grid and preview the finished blanket.
- **Written pattern:** get the full row-by-row pattern to copy or download.
- **Follow pattern:** work through it on your phone or iPad, one chart section at a
  time, crossing off each stitch group as you go.

For personal use only. The chart data comes from the paid pattern PDF.

---

## What's in the folder

| File | What it is |
|---|---|
| `index.html` | The page itself |
| `style.css` | How it looks |
| `app.js` | How it works |
| `charts.json` | Every row of all 27 charts, from the PDF's written instructions |
| `validation-report.txt` | Results of the stitch-count check, and the PDF typos that were corrected |
| `images/charts/` | Small preview pictures of each chart |
| `README.md` | This file |

---

## Updating a site you already put on GitHub

If you set the site up before, you only need to replace the files.

1. Open your repository on <https://github.com>.
2. Click **Add file**, then **Upload files**.
3. Open the unzipped `mosaic-planner` folder. Select **everything inside it**
   (the files and the `images` folder) and drag it all onto the upload page.
   Files with the same name are replaced automatically.
4. Click **Commit changes**.
5. Wait one or two minutes, then open your site. If you still see the old
   version, refresh the page. On iPhone, close the tab or Home Screen app and
   open it again.

---

## First-time setup on GitHub Pages (about 10 minutes)

You only need a web browser.

### 1. Make a GitHub account
Go to <https://github.com> and sign up, if you don't already have an account.

### 2. Create a repository
1. Click the **+** at the top right, then **New repository**.
2. **Repository name:** type something like `mosaic-planner`.
3. Choose **Public**. Pages on a **Private** repository needs a paid GitHub plan.
4. Tick **Add a README file**.
5. Click **Create repository**.

### 3. Upload the files
1. In your new repository, click **Add file**, then **Upload files**.
2. Open the unzipped `mosaic-planner` folder on your computer. Select
   **everything inside it** and drag it onto the GitHub upload page.
   - Drag the `images` folder in as a folder so it keeps its
     `images/charts/` structure. Dragging folders works in Chrome, Edge and
     Firefox on a computer.
   - If GitHub asks about replacing `README.md`, say yes.
3. Scroll down and click **Commit changes**.

Check that `index.html` sits at the top level of the repository, not inside
another folder.

### 4. Turn on GitHub Pages
1. In the repository, click **Settings**, then **Pages** in the left menu.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
4. Wait one or two minutes and refresh. A box shows your site's address, like
   `https://YOUR-USERNAME.github.io/mosaic-planner/`.

> Opening `index.html` straight from your computer (double-clicking it) won't
> work. Browsers block the page from reading `charts.json` that way. Use the
> GitHub Pages link.

---

## Designing your blanket (Design tab)

1. **Size:** set **Columns** and **Chart rows** (default 4 × 6 = 163 stitches
   per row, 202 rows).
2. **Place charts**
   - **Computer:** drag a chart from the list onto a spot.
   - **Phone:** tap a chart in the list, then tap the spots for it. Tap
     **Done** when you're finished.
   - **Tap or click a spot** to pick a chart from a dropdown.
   - **Drag one spot onto another** to swap them. On a phone, press and hold
     for a moment first.
   - **Remove a chart:** click the **trash can** in its bottom-right corner.
     On a computer it appears when you hover over the chart; on a phone or
     iPad it's always there. Changed your mind? Tap **Undo** in the pop-up.
3. **Colours:** pick A, B and C. C is only used for the shelves, if you set
   **Shelves** to **Colour C**.
4. **Lock layout:** stops the layout being changed by accident. It turns on
   by itself the first time you cross something off in **Follow pattern**.
   Untick it to edit again.

### Saving a layout as a link
The page's address always holds your current layout (charts, size, colours,
shelf colour). Save it and you'll always get that exact blanket back.

- Click **Copy link to this layout** and paste it somewhere safe (Notes,
  an email to yourself), or bookmark the page.
- **Put it on your iPhone or iPad Home Screen:** open the site in **Safari**,
  set up your layout, then tap **Share → Add to Home Screen**. To open
  straight into the pattern tracker, switch to **Follow pattern** before you
  tap Share.

If you change the layout later, the old link or icon still opens the *old*
layout. Save a new link or icon for the new one.

---

## Following the pattern (Follow pattern tab)

Each screen shows one **section**: one chart's part of one row.

- **At the top:** the row number, the yarn colour (big dot), and which
  section you're on, like *Section 1 of 4 (rightmost) · Chart 7*. Rows are
  worked right to left, so section 1 is the chart on the right.
- **The instructions** come in big stitch groups: `BS (4DC 13SC 1DC …)`.
  - **Tap anywhere in the box** to cross off the next group. The group to
    work next is highlighted.
  - **Tap a crossed-off group** to un-cross it, or tap a later group to cross
    off everything up to it.
  - When the section is all crossed off, tap the box again (or **Next**) to
    move on.
- **Undo:** un-crosses the last group. **Back:** goes to the start of this
  section, then to the section before.
- **The picture underneath** shows the chart row you're on, with the
  current row and section outlined.
- **Whole row as written:** opens the full row, with your section highlighted.
- **Go to row:** jump to any row. Use this when you switch between your phone
  and iPad.
- **Keep screen awake:** stops the screen turning off while the page is open.
  This needs iOS 16.4 or later. If you use it from the Home Screen, you'll
  need iOS 18.4 or later.
- Shelf rows and the final row appear as their own steps ("SC across").

**Your place is saved on each device separately.** It doesn't sync between
your phone and iPad, because the site has no server. On iPhone, a Home Screen
icon also keeps its own place, separate from Safari, so always use the same
one. Each layout keeps its own place too.

---

## Data check

Every row was checked for 40 stitches inside the brackets, only SC and DC,
and alternating colours. All rows pass. Six rows had typos in the PDF and
were corrected as you confirmed:

| Chart | Row | Printed | Corrected to |
|---|---|---|---|
| Chart 2 | 24 | `1OSC` (letter O) | `10SC` |
| Chart 7 | 1 | `40S` | `40SC` |
| Chart 7 | 2 | `40S` | `40SC` |
| Chart 7 (Reversed) | 4 | `2S` | `2SC` |
| Bookend Left | 16 | `3D` | `3DC` |
| Bookend Left | 18 | `3D` | `3DC` |

The full details are under **Data check** at the bottom of the Design tab
and in `validation-report.txt`.

## Chart pictures

The thumbnails in `images/charts/` were drawn from the chart data. To use your
own, upload PNG files with exactly the same names, for example
`images/charts/Teddy Bear.png`.
