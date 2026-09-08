import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/classes.js";
import { toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

let ffmpeg = null;
let loading = null;
let classWorkerURL = null;

async function getFFmpeg(onStatus) {
  if (ffmpeg?.loaded) return ffmpeg;
  if (loading) return loading;

  loading = (async () => {
    onStatus?.("Loading audio converter…");
    const instance = new FFmpeg();
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

    // The root FFmpeg worker must not be loaded directly from the CDN on GitHub Pages.
    // Keep the worker entry point same-origin by bundling its browser-side code locally.
    if (!classWorkerURL) {
      const workerSource = await (await fetch("./converter/ffmpeg-worker.js", { cache: "no-store" })).text();
      classWorkerURL = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    }

    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      classWorkerURL,
    });

    ffmpeg = instance;
    return instance;
  })();

  try { return await loading; }
  finally { loading = null; }
}

export async function getOggAudio(entry, onStatus) {
  const name = entry.name || "";
  const bytes = await entry.async("uint8array");

  if (/\.ogg$/i.test(name)) return bytes;

  const inputExt = (name.match(/\.(mp3|wav)$/i) || [])[1]?.toLowerCase();
  if (!inputExt) throw new Error("The .osz audio must be .ogg, .mp3, or .wav.");

  const instance = await getFFmpeg(onStatus);
  const inputName = `input.${inputExt}`;
  const outputName = "Inst.ogg";

  onStatus?.(`Converting ${inputExt.toUpperCase()} audio to OGG…`);
  await instance.writeFile(inputName, bytes);
  await instance.exec([
    "-i", inputName,
    "-vn",
    "-c:a", "libvorbis",
    "-b:a", "320k",
    "-map", "0:a",
    outputName
  ]);

  const data = await instance.readFile(outputName);
  try { await instance.deleteFile(inputName); } catch {}
  try { await instance.deleteFile(outputName); } catch {}
  return new Uint8Array(data);
}
