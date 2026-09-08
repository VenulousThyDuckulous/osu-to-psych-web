import { getOggAudio } from "./audio.js";

export async function buildModZip(jobs, onStatus) {
  if (!jobs.length) throw new Error("No difficulties were selected.");
  const out = new JSZip();
  const templateResp = await fetch("./template/modTemplate.zip", { cache: "no-store" });
  if (!templateResp.ok) throw new Error("Could not load modTemplate.zip from the site.");
  const template = await JSZip.loadAsync(await templateResp.blob());
  const root = topFolder(template);

  onStatus?.("Copying Psych Engine template…");
  for (const entry of Object.values(template.files)) {
    if (!entry.dir) out.file(entry.name, await entry.async("uint8array")); else out.folder(entry.name);
  }

  // Group difficulties by song folder. Multiple difficulties of the same song
  // share one songs/<song>/Inst.ogg and get separate data/<song>/*.json files.
  const groups = new Map();
  const usedIds = new Set();
  for (const job of jobs) {
    const base = safeSongPath(job.map.title || job.parsed.title || "converted-song");
    let songId = base;
    let n = 2;
    while (usedIds.has(songId)) songId = `${base}-${n++}`;
    // Same song title + multiple difficulties should stay together.
    const existing = [...groups.values()].find(g => g.base === base && g.parsed === job.parsed);
    if (existing) songId = existing.songId;
    else usedIds.add(songId);
    if (!groups.has(songId)) groups.set(songId, {songId, base, parsed:job.parsed, jobs:[]});
    groups.get(songId).jobs.push(job);
  }

  const audioCache = new Map();
  const weekSongs = [];
  for (const group of groups.values()) {
    const songId = group.songId;
    const dataDir = `${root}data/${songId}/`;
    const songDir = `${root}songs/${songId}/`;
    let audioEntry = group.jobs[0].map.audioEntry;
    if (!audioEntry) throw new Error(`No audio referenced by ${group.jobs[0].map.version}.`);

    for (const job of group.jobs) {
      const diffId = difficultyId(job.map.version);
      const chart = job.chart;
      chart.song.song = songId;
      out.file(`${dataDir}${songId}-${diffId}.json`, JSON.stringify(chart, null, 2));
    }

    const cacheKey = audioEntry.name;
    if (!audioCache.has(cacheKey)) {
      onStatus?.(`Converting audio for ${group.parsed.title}…`);
      audioCache.set(cacheKey, await getOggAudio(audioEntry, onStatus));
    }
    out.file(`${songDir}Inst.ogg`, audioCache.get(cacheKey));
    weekSongs.push([group.parsed.title || songId, "dad", [146,113,253]]);
  }

  const week = {
    songs: weekSongs,
    hideFreeplay: false,
    weekBackground: "",
    difficulties: "Hard",
    weekCharacters: ["dad", "bf", "gf"],
    storyName: "Converted Songs",
    weekName: "osu-converted-freeplay",
    freeplayColor: [146,113,253],
    hideStoryMode: true,
    weekBefore: "",
    startUnlocked: true
  };
  out.file(`${root}weeks/osu-converted-freeplay.json`, JSON.stringify(week, null, 2));
  onStatus?.("Building final ZIP…");
  return out;
}
function topFolder(zip) { const names=Object.keys(zip.files), first=names[0]||"", slash=first.indexOf("/"); return slash>=0?first.slice(0,slash+1):""; }
function safeSongPath(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"converted-song";}
function difficultyId(s){return String(s||"difficulty").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"difficulty";}
