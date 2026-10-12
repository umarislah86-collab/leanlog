# Character artwork sources

Retrieved 12 October 2026 from the official character pages. These are existing character artworks, not original LeanLog drawings; copyright remains with the respective creators/rightsholders. Public availability is not a redistribution licence.

- Luffy, Zoro, Sanji, Chopper: https://one-piece.com/character/ (individual /character/{name}/index.html). Original image URLs: https://one-piece.com/o/assets/images/anime/character/data/{name}/img.jpg . Download with the corresponding character page as Referer; otherwise the site returns its promotional fallback image.
- Goku: https://www.toei-anim.co.jp/tv/dragon_s/chara/01.html
- Vegeta: https://www.toei-anim.co.jp/tv/dragon_s/chara/04.html
- Piccolo: https://www.toei-anim.co.jp/tv/dragon_s/chara/09.html
- Gohan: https://www.toei-anim.co.jp/tv/dragon_s/chara/02.html
- Dragon Ball image URLs: https://www.toei-anim.co.jp/tv/dragon_s/assets/img/chara/{goku,vejita,piccoro,gohan}/img01.png

Run `node scripts/bundle-character-art.cjs` to regenerate the offline image module after changing the source files. SVG viewBoxes frame the original image; characters are never redrawn. Feathered edges are rendered by an SVG mask.
