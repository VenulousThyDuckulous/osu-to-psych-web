const MODE_MANIA = 3;

export async function parseOsz(file) {
  const osz = await JSZip.loadAsync(file);
  const entries = Object.values(osz.files).filter(x=>!x.dir);
  const osuFiles = entries.filter(x=>/\.osu$/i.test(x.name));
  if (!osuFiles.length) throw new Error("The .osz contains no .osu beatmap files.");

  const difficulties = [];
  let common = null;

  for (const entry of osuFiles) {
    const text = await entry.async("string");
    const d = parseOsu(text);
    if (d.mode !== MODE_MANIA) continue;
    if (d.keys !== 4) continue;
    // Use the audio file explicitly referenced by this .osu file.
    // Do NOT pick the first .ogg/.mp3/.wav in the .osz: osu! maps often
    // contain many hitsounds/samples alongside the actual song.
    d.audioEntry = findReferencedAudio(entries, d.audioFilename);
    if (!d.audioEntry) {
      throw new Error(`The difficulty "${d.version}" references an audio file that is missing: ${d.audioFilename || "(empty AudioFilename)"}`);
    }
    if (!common) common = d;
    d.sourceEntry = entry;
    difficulties.push(d);
  }
  if (!difficulties.length) {
    throw new Error("No osu!mania 4K maps found. This converter rejects non-mania and non-4K maps.");
  }
  return {
    title: common.title || "Converted Song",
    artist: common.artist || "Unknown Artist",
    oszEntries: entries,
    bpm: common.bpm,
    difficulties
  };
}

function parseOsu(text) {
  const sec = {};
  let current = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const m = line.match(/^\[(.+)\]$/);
    if (m) { current=m[1]; sec[current]=[]; continue; }
    if (current) sec[current].push(line);
  }
  const kv = name => Object.fromEntries((sec[name]||[]).filter(x=>x.includes(":")).map(x=>{const i=x.indexOf(":");return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));
  const general=kv("General"), meta=kv("Metadata"), diff=kv("Difficulty");
  const mode=Number(general.Mode);
  const keys=Number(diff.CircleSize);
  const timing=(sec.TimingPoints||[]).map(x=>{
    const p=x.split(",");
    return {time:Number(p[0]), beatLength:Number(p[1]), uninherited:p[6] === "1"};
  }).filter(x=>Number.isFinite(x.time)&&Number.isFinite(x.beatLength)).sort((a,b)=>a.time-b.time);
  const hitobjects=(sec.HitObjects||[]).map(line=>{
    const p=line.split(",");
    if(p.length<6) return null;
    const x=Number(p[0]), time=Number(p[2]), type=Number(p[3]);
    if(!Number.isFinite(x)||!Number.isFinite(time)) return null;
    let endTime=time;
    if(type & 128) {
      const first=p[5]?.split(":")[0];
      const n=Number(first); if(Number.isFinite(n)) endTime=n;
    }
    const lane=Math.min(3,Math.max(0,Math.floor(x*4/512)));
    return {x,time,type,endTime,lane};
  }).filter(Boolean);
  const first=timing.find(x=>x.uninherited&&x.beatLength>0);
  return {
    mode,keys,title:meta.Title||"",artist:meta.Artist||"",
    version:meta.Version||"Difficulty",audioFilename:general.AudioFilename||"",
    timing,hitobjects,bpm:first?60000/first.beatLength:120
  };
}

function normalizeZipPath(s) {
  return String(s || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .toLowerCase();
}

function findReferencedAudio(entries, audioFilename) {
  const wanted = normalizeZipPath(audioFilename);
  if (!wanted) return null;

  // First require an exact path/name match, case-insensitively.
  const exact = entries.find(e => !e.dir && normalizeZipPath(e.name) === wanted);
  if (exact) return exact;

  // Some .osz files store the referenced audio at the ZIP root even when
  // the .osu filename contains a relative path. Only accept a basename
  // fallback when it is unambiguous.
  const base = wanted.split("/").pop();
  const matches = entries.filter(e =>
    !e.dir &&
    normalizeZipPath(e.name).split("/").pop() === base &&
    /\.(ogg|mp3|wav)$/i.test(e.name)
  );
  return matches.length === 1 ? matches[0] : null;
}

export function bpmAt(time,timing) {
  let bpm=120;
  for(const t of timing) { if(t.time>time) break; if(t.uninherited&&t.beatLength>0) bpm=60000/t.beatLength; }
  return bpm;
}
