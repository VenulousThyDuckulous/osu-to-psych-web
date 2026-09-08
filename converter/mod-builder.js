import { getOggAudio } from "./audio.js";

export async function buildModZip(parsed, map, chart, onStatus) {
  const out = new JSZip();

  const templateResp = await fetch("./template/modTemplate.zip", { cache: "no-store" });
  if (!templateResp.ok) throw new Error("Could not load modTemplate.zip from the site.");
  const template = await JSZip.loadAsync(await templateResp.blob());

  const root = topFolder(template);
  const songName = safeSongPath(map.title || parsed.title || "converted-song");

  // Psych Engine 1.0.4 chart:
  // My-Mod/data/song-name/song-name-hard.json
  const dataDir = `${root}data/${songName}/`;

  // Psych Engine 1.0.4 instrumental:
  // My-Mod/songs/song-name/Inst.ogg
  const songDir = `${root}songs/${songName}/`;

  // Freeplay-only week:
  // Hide the generated week from Story Mode, but keep its song visible in Freeplay.
  // This lets the player launch the converted chart directly from Freeplay.
  const weekDir = `${root}weeks/`;
  const weekFile = `${songName}.json`;

  onStatus?.("Copying Psych Engine template…");
  for (const entry of Object.values(template.files)) {
    if (!entry.dir) out.file(entry.name, await entry.async("uint8array"));
    else out.folder(entry.name);
  }

  const json = JSON.stringify(chart, null, 2);
  out.file(`${dataDir}${songName}-hard.json`, json);

  // Psych Engine 1.0.4 week definition. `hideStoryMode: true`
  // makes this a Freeplay-only week while `hideFreeplay: false`
  // keeps the song available from the Freeplay menu.
  const week = {
    songs: [[map.title || parsed.title || songName, "dad", [146, 113, 253]]],
    hideFreeplay: false,
    weekBackground: "",
    difficulties: "Hard",
    weekCharacters: ["dad", "bf", "gf"],
    storyName: "Converted Song",
    weekName: songName,
    freeplayColor: [146, 113, 253],
    hideStoryMode: true,
    weekBefore: "",
    startUnlocked: true
  };
  out.file(`${weekDir}${weekFile}`, JSON.stringify(week, null, 2));

  if (!map.audioEntry) {
    throw new Error(`No audio file referenced by the selected .osu difficulty was found: ${map.audioFilename || "(empty AudioFilename)"}`);
  }

  // ALWAYS output Inst.ogg. MP3/WAV is converted client-side to OGG Vorbis.
  // map.audioEntry comes from that difficulty's AudioFilename, so hitsounds
  // and other sample files in the .osz are never selected as the song.
  const oggData = await getOggAudio(map.audioEntry, onStatus);
  out.file(`${songDir}Inst.ogg`, oggData);

  onStatus?.("Building final ZIP…");
  return out;
}

function topFolder(zip) {
  const names = Object.keys(zip.files);
  const first = names[0] || "";
  const slash = first.indexOf("/");
  return slash >= 0 ? first.slice(0, slash + 1) : "";
}

function safeSongPath(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "converted-song";
}
