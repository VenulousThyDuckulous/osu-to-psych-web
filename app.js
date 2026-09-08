import { parseOsz } from "./converter/osu.js";
import { buildPsych104 } from "./converter/psych104.js";
import { buildModZip } from "./converter/mod-builder.js";

const input = document.querySelector("#fileInput");
const drop = document.querySelector("#dropZone");
const status = document.querySelector("#status");
const info = document.querySelector("#mapInfo");
const diffPanel = document.querySelector("#difficultyPanel");
const diffList = document.querySelector("#difficultyList");
const convertBtn = document.querySelector("#convertBtn");
const jsonBtn = document.querySelector("#jsonBtn");

let parsed = null;
let selected = null;
let lastChart = null;

function showStatus(text, error=false) {
  status.textContent = text;
  status.className = "status" + (error ? " error" : "");
}
function reset() {
  parsed = null; selected = null; lastChart = null; info.classList.add("hidden");
  diffPanel.classList.add("hidden"); convertBtn.disabled = true; jsonBtn.disabled = true;
  status.classList.add("hidden"); diffList.innerHTML = "";
}
async function load(file) {
  reset();
  if (!file || !/\.osz$|\.zip$/i.test(file.name)) return showStatus("Please choose an .osz file.", true);
  try {
    showStatus("Reading map…");
    parsed = await parseOsz(file);
    if (!parsed.difficulties.length) throw new Error("No osu!mania 4K difficulties were found.");
    document.querySelector("#title").textContent = parsed.title;
    document.querySelector("#artist").textContent = parsed.artist;
    document.querySelector("#keys").textContent = "4K";
    document.querySelector("#bpm").textContent = parsed.bpm ? Math.round(parsed.bpm) : "—";
    document.querySelector("#objects").textContent = parsed.difficulties.reduce((n,d)=>n+d.hitobjects.length,0).toLocaleString();
    info.classList.remove("hidden");
    diffList.innerHTML = "";
    parsed.difficulties.forEach((d,i)=>{
      const el = document.createElement("div");
      el.className = "diff";
      el.innerHTML = `<span>${escapeHtml(d.version)}</span><span>${d.hitobjects.length.toLocaleString()} notes</span>`;
      el.onclick = () => {
        [...diffList.children].forEach(x=>x.classList.remove("selected"));
        el.classList.add("selected"); selected = d; convertBtn.disabled = false; jsonBtn.disabled = false;
      };
      diffList.appendChild(el);
    });
    diffPanel.classList.remove("hidden");
    showStatus(`Loaded ${parsed.difficulties.length} compatible 4K difficulty${parsed.difficulties.length===1?"":"ies"}.`);
  } catch(e) { reset(); showStatus(e.message || String(e), true); }
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

input.addEventListener("change",()=>load(input.files[0]));
["dragenter","dragover"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",ev=>load(ev.dataTransfer.files[0]));

jsonBtn.onclick = () => {
  if (!selected || !parsed) return;
  const chart = lastChart || buildPsych104(selected);
  const blob = new Blob([JSON.stringify(chart, null, 2)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName(selected.title || parsed.title)}-hard.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

convertBtn.onclick = async () => {
  if (!selected || !parsed) return;
  try {
    convertBtn.disabled = true; convertBtn.textContent = "BUILDING MOD…";
    const chart = buildPsych104(selected);
    lastChart = chart;
    const zip = await buildModZip(parsed, selected, chart, (msg) => showStatus(msg));
    const blob = await zip.generateAsync({type:"blob"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName(selected.title || parsed.title)}-Psych104.zip`;
    a.click(); URL.revokeObjectURL(a.href);
    showStatus("Done! Your Psych Engine 1.0.4 mod ZIP is ready.");
  } catch(e) {
    showStatus(e.message || String(e), true);
  } finally { convertBtn.disabled = false; convertBtn.textContent = "CONVERT TO PSYCH 1.0.4"; }
};
function safeName(s){return String(s).replace(/[<>:"/\\|?*]/g,"_").trim()||"Converted-Map";}
