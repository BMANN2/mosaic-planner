# Mosaic Bookcase Planner

A small website for planning a mosaic crochet blanket from the Zigz Crochet
*Mosaic Bookcase (Extended Version)* charts. Arrange the charts on a grid, preview
the finished blanket, then press **Finish** to get the full written pattern,
row by row.

For personal use only. The chart data comes from the paid pattern PDF, so keep
the repository **private** if your GitHub plan allows Pages on private repos.
Otherwise, keep the link to yourself.

---

## What's in the folder

| File | What it is |
|---|---|
| `index.html` | The page itself |
| `style.css` | How it looks |
| `app.js` | How it works |
| `charts.json` | Every row of all 27 charts, taken from the PDF's written instructions |
| `validation-report.txt` | Rows in the PDF that didn't pass the stitch-count check (see below) |
| `images/charts/` | Small preview pictures of each chart (optional) |
| `README.md` | This file |

---

## Put it on GitHub Pages (about 10 minutes)

You only need a web browser. No software to install.

### 1. Make a GitHub account
Go to <https://github.com> and sign up, if you don't already have an account.

### 2. Create a repository
1. Click the **+** at the top right, then **New repository**.
2. **Repository name:** type something like `mosaic-planner`.
3. Choose **Public** or **Private**. Pages on a private repository needs a paid
   GitHub plan. On a free account, choose Public.
4. Tick **Add a README file**.
5. Click **Create repository**.

### 3. Upload the files
1. In your new repository, click **Add file**, then **Upload files**.
2. Open the unzipped `mosaic-planner` folder on your computer. Select
   **everything inside it**: `index.html`, `style.css`, `app.js`, `charts.json`,
   `validation-report.txt`, `README.md` and the `images` folder. Drag them all
   onto the GitHub upload page.
   - Drag the `images` folder in as a folder so it keeps its
     `images/charts/` structure. Dragging folders works in Chrome, Edge and
     Firefox on a computer.
   - If GitHub asks about replacing `README.md`, say yes.
3. Scroll down and click **Commit changes**.

Check that `index.html` sits at the top level of the repository, not inside
another folder. If it's in a folder, the site won't load.

### 4. Turn on GitHub Pages
1. In the repository, click **Settings** (top menu).
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
5. Wait one or two minutes, then refresh the page. A box will show your site's
   address. It looks like
   `https://YOUR-USERNAME.github.io/mosaic-planner/`.

Open that link on your computer or phone. Bookmark it, or on iPhone use
**Share → Add to Home Screen**.

> Opening `index.html` straight from your computer (double-clicking it) won't
> work. Browsers block the page from reading `charts.json` that way. Use the
> GitHub Pages link.

### Updating later
To change a file, open it in the repository, click the pencil icon (or upload a
new copy with **Add file → Upload files**), then **Commit changes**. The site
updates within a minute or two.

---

## Using the planner

1. **Size:** set **Columns** (charts across) and **Chart rows** (charts up).
   The default is 4 × 6. The stitch count per row is shown underneath
   (4 columns = 163 stitches).
2. **Place charts**
   - **Computer:** drag a chart from the list onto a spot.
   - **Phone:** tap a chart in the list, then tap the spots where you want it.
     Tap **Done** when you're finished.
   - **Tap or click a spot** to choose a chart from a dropdown, or to clear it.
   - **Drag one spot onto another** to swap them. On a phone, press and hold
     for a moment first.
   - The same chart can be used as many times as you like.
3. **Colours:** pick colours A, B and C. Colour C is only used for the shelves,
   if you set **Shelves** to **Colour C**.
4. **Stitch symbols:** tick the box to show an X on every double crochet.
5. **Finish:** builds the whole written pattern from the bottom up. Use
   **Copy to clipboard** or **Download .txt**. Every spot must have a chart
   first.

Your layout and colours are saved in the browser, so they'll still be there
next time you open the page on the same device and browser.

### How the pattern is put together
- Each row is worked right to left. The rightmost chart comes first:
  `BS (rightmost chart) … (leftmost chart) stitch-41 BS`.
- Rows are numbered continuously up the blanket. For 6 chart rows: 1–31 (chart
  row 1), 32–34 (shelf), 35–65 (chart row 2), and so on, up to row 202.
- Each shelf is 3 rows of SC in the shelf colour.
- After the top chart row comes one last row of SC in colour A.

---

## Data check: errors printed in the PDF

Every row was checked for exactly 40 stitches inside the brackets, only SC and
DC stitches, and A/B colours alternating. Seven rows in five charts didn't
pass. They look like typos in the PDF. **They have not been corrected.** They
appear in the pattern exactly as printed, with a note at the end of the
pattern. You can also open **Data check** at the bottom of the page or read
`validation-report.txt`.

| Chart | Row | As printed | Likely meant |
|---|---|---|---|
| Chart 2 | 24 | `… 3DC 1OSC)`, a letter O, not a zero | `10SC` |
| Chart 7 | 1, 2 | `(40S)` | `(40SC)` |
| Chart 7 (Reversed) | 4 | `… 3DC 2S 3DC …` | `2SC` |
| Bookend Left | 16, 18 | `… 1SC 3D 13SC)` | `3DC` |

Check these rows against the picture charts in the PDF before you crochet them.
In the preview, an unrecognised stitch is drawn as SC. Charts with a flagged
row show a **!** in the list and on the blanket.

## Chart pictures

The thumbnails in `images/charts/` were drawn from the chart data. To use your
own pictures, upload PNG files with exactly the same names, for example
`images/charts/Teddy Bear.png`. If a picture is missing, the list just shows
the chart's name.
