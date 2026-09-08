# osu!mania → Psych Engine 1.0.4

Static GitHub Pages prototype.

## Current scope
- `.osz` input
- osu!mania (`Mode: 3`) only
- 4K (`CircleSize: 4`) only
- Multiple 4K difficulties can be selected
- Long notes
- Basic BPM changes
- Browser-side conversion
- Template ZIP → output ZIP

## GitHub Pages
Put `modTemplate.zip` in `template/`, commit, then enable GitHub Pages for the repository.

## Important
This is a prototype. Psych 1.0.4 chart compatibility and timing need to be tested against actual maps before calling it production-ready.


### Generated file layout

The generated chart is written to `My-Mod/data/<song-name>/<song-name>-hard.json`. The instrumental is written to `My-Mod/songs/<song-name>/Inst.<ext>`.


### Audio output

The generated mod always contains:

`My-Mod/songs/<song-name>/Inst.ogg`

If the osu!mania `.osz` contains MP3 or WAV audio, the website converts it locally in the browser to OGG Vorbis before building the ZIP. OGG input is copied directly.


Audio conversion bugfix (browser ESM FFmpeg core): MP3/WAV input is converted in-browser to OGG Vorbis using FFmpeg.wasm; existing OGG is passed through unchanged.


### Psych 1.0.4 song ID fix
The generated chart's `song` value now uses the same lowercase safe song ID as its `data/` and `songs/` folder names (for example, `montagem-vozes-talentinho-instrumental`). This lets Psych Engine resolve `songs/<song-id>/Inst.ogg` correctly.


Timing compatibility note: the Psych chart sectioning now mirrors the original osu songs in psych engine converter algorithm, while preserving osu! hit-object timestamps.


Audio selection fix: the converter now uses the selected `.osu` file’s `AudioFilename` field and ignores unrelated hitsounds/samples in the `.osz`.
