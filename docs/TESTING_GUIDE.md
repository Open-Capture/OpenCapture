# Testing OpenCapture — a quick guide

Thanks for helping test this! OpenCapture is a Chrome extension for
full-page screenshots — captures, no watermark, everything stays on your
machine (no cloud upload). It's not published on the Chrome Web Store yet,
so you'll load it manually as an "unpacked" extension. Takes about a
minute.

## 1. Install it

1. Unzip `opencapture-dist.zip` somewhere you'll remember (e.g. your
   Desktop). You should end up with a folder containing `manifest.json`,
   `popup.html`, etc. — not a nested folder inside a folder.
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the unzipped folder
6. OpenCapture's icon (a blue tile with a crop symbol) should appear in
   your toolbar. If you don't see it, click the puzzle-piece icon and pin
   it.

## 2. What to try

Go to any real webpage (a news article, a long blog post, whatever) and
click the OpenCapture icon.

- **Capture full page** — scrolls and stitches the whole page into one
  image.
- **Capture visible area** — just what's currently on screen.
- **Capture selected area** — drag a rectangle on the page to capture only
  that.
- After a capture, try **PDF**, **Copy**, and **Annotate**.
- In the Annotate editor: try **Crop**, **Arrow**, **Rectangle**, **Text**,
  and **Blur**. Try **Undo**. Try the **Select** tool to move/resize a
  shape you just drew (see the limitation below).
- In the popup, try **Browse…** under "Save to" to pick a custom download
  folder.
- Close the popup after a capture and reopen it — your last capture should
  still be there, not reset.

## 3. Things that are known, not bugs

Don't bother reporting these — already known:

- **Select tool only works on the shape you *just* drew.** Once you draw
  another shape, switch tools, or do anything else, the previous
  arrow/rectangle/text/blur is permanently baked into the image and can no
  longer be selected or moved. (One arrow at a time can be adjusted, not
  "go back and edit something from a minute ago.")
- **Blur is permanent once applied** — there's no way to "unblur," same as
  any real redaction tool.
- A **very** long page that needs more than one output image downloads
  each piece immediately instead of opening the editor (use "Export as
  PDF" afterward to get one merged file).

## 4. The one thing I actually need you to check

The **custom folder picker** ("Browse…" under "Save to") has never been
tested in a real, everyday Chrome window by an actual person clicking the
real toolbar popup — only in an automated headless test, which can't
fully represent it. Specifically: does the popup stay open long enough for
the folder picker dialog to appear and for you to pick a folder, or does
clicking Browse… cause the popup to close/misbehave? This is the most
useful thing you can report.

## 5. How to report anything odd

For each issue, please note:

1. What you clicked / did, in order
2. What you expected vs. what happened
3. A screenshot if it's visual
4. Any red text in the console — right-click the popup → **Inspect** →
   Console tab, or on `chrome://extensions` click OpenCapture's
   "service worker" link → Console tab

Send it all back my way (screenshots + the steps) and I'll take it from
there.
