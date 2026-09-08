import { parseOsz } from "./converter/osu.js";
import { buildPsych104 } from "./converter/psych104.js";
import { buildModZip } from "./converter/mod-builder.js";

const input = document.querySelector("#fileInput");
const drop = document.querySelector("#dropZone");
const status = document.querySelector("#status");
const diffPanel = document.querySelector("#difficultyPanel");
const diffList = document.querySelector("#difficultyList");
const convertBtn = document.querySelector("#convertBtn");
const jsonBtn = document.querySelector("#jsonBtn");
const selectedCount = document.querySelector("#selectedCount");
const clearBtn = document.querySelector("#clearBtn");

let maps = [];
let lastZip = null;

function showStatus(text, error=false) {
  status.textContent = text;
  status.className = "status" + (error ? " error" : "");
  status.classList.remove("hidden");
}
function reset() {
  maps = []; lastZip = null;
  diffPanel.classList.add("hidden"); convertBtn.disabled = true; jsonBtn.disabled = true;
  status.classList.add("hidden"); diffList.innerHTML = "";
  selectedCount.textContent = "0 difficulties selected";
}
function selectedDiffs(){ return maps.flatMap(m => m.difficulties.filter(d => d.selected).map(d => ({parsed:m, map:d}))); }
function updateButtons(){
  const n = selectedDiffs().length;
  selectedCount.textContent = `${n} difficulty${n===1?"":"ies"} selected`;
  convertBtn.disabled = n === 0;
  jsonBtn.disabled = n !== 1;
}

async function loadFiles(files) {
  const incoming = [...files].filter(f => /\.osz$/i.test(f.name));
  if (!incoming.length) return showStatus("Please choose one or more .osz files.", true);
  reset();
  try {
    showStatus(`Reading ${incoming.length} map${incoming.length===1?"":"s"}…`);
    for (const file of incoming) {
      const parsed = await parseOsz(file);
      parsed.fileName = file.name;
      parsed.difficulties.forEach(d => d.selected = false);
      maps.push(parsed);
    }
    renderDifficultyList();
    diffPanel.classList.remove("hidden");
    showStatus(`Loaded ${maps.length} map${maps.length===1?"":"s"}. Select any difficulties to include.`);
  } catch(e) {
    reset(); showStatus(e.message || String(e), true);
  }
}

function renderDifficultyList(){
  diffList.innerHTML = "";
  maps.forEach((parsed, mapIndex) => {
    const group = document.createElement("div");
    group.className = "map-group";
    group.innerHTML = `<div class="map-group-head"><div><b>${escapeHtml(parsed.title)}</b><small>${escapeHtml(parsed.artist)} • ${escapeHtml(parsed.fileName)}</small></div><button type="button" class="select-all">Select all</button></div>`;
    const list = document.createElement("div");
    parsed.difficulties.forEach((d, diffIndex) => {
      const el = document.createElement("label");
      el.className = "diff" + (d.selected ? " selected" : "");
      el.innerHTML = `<input type="checkbox" ${d.selected ? "checked" : ""}><span>${escapeHtml(d.version)}</span><span>${d.hitobjects.length.toLocaleString()} notes</span>`;
      const checkbox = el.querySelector("input");
      checkbox.addEventListener("change", () => { d.selected = checkbox.checked; el.classList.toggle("selected", d.selected); updateButtons(); });
      list.appendChild(el);
    });
    group.querySelector(".select-all").onclick = () => {
      const value = parsed.difficulties.some(d => !d.selected);
      parsed.difficulties.forEach(d => d.selected = value);
      renderDifficultyList();
      updateButtons();
    };
    group.appendChild(list); diffList.appendChild(group);
  });
  updateButtons();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

input.addEventListener("change",()=>loadFiles(input.files));
["dragenter","dragover"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",ev=>loadFiles(ev.dataTransfer.files));
clearBtn.onclick = reset;

jsonBtn.onclick = () => {
  const picked = selectedDiffs()[0];
  if (!picked) return;
  const chart = buildPsych104(picked.map);
  const blob = new Blob([JSON.stringify(chart, null, 2)], {type:"application/json"});
  const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download = `${safeName(picked.map.title || picked.parsed.title)}-${safeName(picked.map.version)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
};

convertBtn.onclick = async () => {
  const picked = selectedDiffs();
  if (!picked.length) return;
  try {
    convertBtn.disabled=true; convertBtn.textContent="BUILDING MOD…";
    const jobs = picked.map(x => ({ parsed:x.parsed, map:x.map, chart:buildPsych104(x.map) }));
    const zip = await buildModZip(jobs, msg => showStatus(msg));
    const blob = await zip.generateAsync({type:"blob"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`osu-mania-${jobs.length}-chart${jobs.length===1?"":"s"}-Psych104.zip`; a.click(); URL.revokeObjectURL(a.href);
    showStatus(`Done! Added ${jobs.length} selected difficulty${jobs.length===1?"":"ies"} to one Psych Engine 1.0.4 mod.`);
  } catch(e) { showStatus(e.message || String(e), true); }
  finally { convertBtn.disabled=selectedDiffs().length===0; convertBtn.textContent="CONVERT SELECTED TO PSYCH 1.0.4"; }
};
function safeName(s){return String(s).replace(/[<>:"/\\|?*]/g,"_").trim()||"Converted-Map";}
