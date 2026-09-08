const CORE_VERSION = "0.12.10";
const CORE_ESM = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm/ffmpeg-core.js`;
let ffmpegCore = null;
const ERR_UNKNOWN = new Error("unknown message type");
const ERR_NOT_LOADED = new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first");
const ERR_LOAD = new Error("failed to import ffmpeg-core.js");
const TYPES = {
  LOAD:"LOAD", EXEC:"EXEC", FFPROBE:"FFPROBE", WRITE_FILE:"WRITE_FILE", READ_FILE:"READ_FILE",
  DELETE_FILE:"DELETE_FILE", RENAME:"RENAME", CREATE_DIR:"CREATE_DIR", LIST_DIR:"LIST_DIR",
  DELETE_DIR:"DELETE_DIR", ERROR:"ERROR", DOWNLOAD:"DOWNLOAD", PROGRESS:"PROGRESS", LOG:"LOG",
  MOUNT:"MOUNT", UNMOUNT:"UNMOUNT"
};
async function loadCore({coreURL, wasmURL, workerURL}) {
  const first = !ffmpegCore;
  try {
    // GitHub Pages supplies coreURL as a same-origin blob URL containing the
    // ESM build. Import that module directly inside this same-origin worker.
    const mainScript = coreURL || CORE_ESM;
    if (!self.createFFmpegCore) {
      self.createFFmpegCore = (await import(mainScript)).default;
    }
    if (!self.createFFmpegCore) throw ERR_LOAD;

    const config = {};
    if (wasmURL) config.wasmURL = wasmURL;
    if (workerURL) config.workerURL = workerURL;

    const hash = btoa(JSON.stringify(config));
    ffmpegCore = await self.createFFmpegCore({
      mainScriptUrlOrBlob: `${mainScript}#${hash}`
    });
    ffmpegCore.setLogger(i=>self.postMessage({type:TYPES.LOG,data:i}));
    ffmpegCore.setProgress(i=>self.postMessage({type:TYPES.PROGRESS,data:i}));
    return first;
  } catch (e) {
    throw new Error(`${ERR_LOAD.message}: ${e?.message || e}`);
  }
}
function exec(args, timeout=-1){ffmpegCore.setTimeout(timeout);ffmpegCore.exec(...args);const r=ffmpegCore.ret;ffmpegCore.reset();return r;}
function ffprobe(args, timeout=-1){ffmpegCore.setTimeout(timeout);ffmpegCore.ffprobe(...args);const r=ffmpegCore.ret;ffmpegCore.reset();return r;}
self.onmessage=async ({data:{id,type,data}})=>{
  let result;
  try {
    if(type!==TYPES.LOAD && !ffmpegCore) throw ERR_NOT_LOADED;
    switch(type){
      case TYPES.LOAD: result=await loadCore(data); break;
      case TYPES.EXEC: result=exec(data.args,data.timeout??-1); break;
      case TYPES.FFPROBE: result=ffprobe(data.args,data.timeout??-1); break;
      case TYPES.WRITE_FILE: result=(ffmpegCore.FS.writeFile(data.path,data.data),true); break;
      case TYPES.READ_FILE: result=ffmpegCore.FS.readFile(data.path,{encoding:data.encoding}); break;
      case TYPES.DELETE_FILE: result=(ffmpegCore.FS.unlink(data.path),true); break;
      case TYPES.RENAME: result=(ffmpegCore.FS.rename(data.oldPath,data.newPath),true); break;
      case TYPES.CREATE_DIR: result=(ffmpegCore.FS.mkdir(data.path),true); break;
      case TYPES.LIST_DIR: { const list=ffmpegCore.FS.readdir(data.path); result=list.map(name=>{const st=ffmpegCore.FS.stat(`${data.path}/${name}`);return {name,isDir:ffmpegCore.FS.isDir(st.mode)};}); break; }
      case TYPES.DELETE_DIR: result=(ffmpegCore.FS.rmdir(data.path),true); break;
      default: throw ERR_UNKNOWN;
    }
  } catch(e) { self.postMessage({id,type:TYPES.ERROR,data:String(e)}); return; }
  const transfer=[];
  if(result instanceof Uint8Array) transfer.push(result.buffer);
  self.postMessage({id,type,data:result},transfer);
};
