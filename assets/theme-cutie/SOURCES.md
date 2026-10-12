# Cutie artwork

User supplied these seven PNG images from `C:/Users/Taqip/Pictures/theme/cutie` on 12 October 2026 for the Cutie app theme. Original files are preserved here with descriptive names; none are redrawn.

| Bundled name | Supplied filename | Main surface |
| --- | --- | --- |
| sunshine.png | 1.png | Account widget |
| pinkSky.png | 452d66f6-e8aa-4cb3-8eb8-43f57b324492.png | Home |
| yummy.png | 2.png | Log / quick actions |
| cool.png | Screenshot 2026-10-12 191555.png | Coach |
| cheer.png | Screenshot 2026-10-12 191620.png | Progress |
| thumbsUp.png | Screenshot 2026-10-12 191649.png | Settings drawer / cash widget |
| wow.png | Screenshot 2026-10-12 191723.png | Daily widget / navigation |

Regenerate the compact offline image module with `node scripts/bundle-cutie-art.cjs`. Portraits use JPEG encoding at 512px; sticker PNGs preserve original proportions and pixels. App rendering frames portraits with a feathered SVG mask. A generated SVG outline clip hides the stickers' connected outer black canvas at render time, keeping enclosed eyes/hair and the supplied raster artwork intact. Native widgets share the same embedded images. No access to the user's Pictures directory or Internet is needed at runtime.

`node scripts/preview-cutie.cjs` creates a palette/artwork contact sheet using the real SVG compositions. It is a design preview, not an app/phone screenshot.
