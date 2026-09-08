export function buildPsych104(map) {
  // Match the timing/section algorithm used by the original
  // "osu songs in psych engine" converter:
  // - preserve osu! hit-object timestamps exactly
  // - take the first osu! timing point's beat length
  // - floor the resulting BPM
  // - split notes into 4-beat / 16-step Psych sections using that BPM
  const notes = map.hitobjects.map(o => [
    Number(o.time),
    o.lane,
    Number(Math.max(0, o.endTime - o.time))
  ]).sort((a,b)=>a[0]-b[0]);

  let bpm = 150;
  if (map.timing?.length) {
    const first = map.timing.find(t => Number.isFinite(t.beatLength));
    if (first && first.beatLength > 0) {
      bpm = Math.floor(60000 / first.beatLength);
    }
  }

  const beatMs = 1000 * 60 / bpm;
  const sectionMs = 4 * beatMs;
  const sections = [];

  let i = 0;
  while (true) {
    const start = i * sectionMs;
    const end = (i + 1) * sectionMs;

    const sectionNotes = notes.filter(n => n[0] <= end && n[0] > start);

    sections.push({
      typeOfSection: 0,
      lengthInSteps: 16,
      sectionNotes,
      mustHitSection: true,
      gfSection: false,
      altAnim: false
    });

    if (notes.length === 0 || notes[notes.length - 1][0] <= end) break;
    i++;
  }

  const title = map.title || "Converted Song";
  const songId = safeSongName(title);

  return {
    song: {
      convertedBy: "osu songs in psych engine script",
      song: songId,
      notes: sections,
      events: [],
      bpm,
      needsVoices: false,
      player1: "bf",
      player2: "dad",
      gfVersion: "gf",
      speed: 3,
      stage: "osu",
      mania: 3,
      playerKeyCount: 4,
      keyCount: 4,
      validScore: false
    }
  };
}

function safeSongName(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "converted-song";
}
