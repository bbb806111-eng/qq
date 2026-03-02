const API_BASE = localStorage.getItem("api_base") || "http://127.0.0.1:8001";
const state = { token: localStorage.getItem("token") || "", username: "", projectId: null, screenMode: "竖屏", novel: "", adapted: "", storyboard: [], assets: { characters: [], scenes: [], props: [] }, analytics: null };
const $ = (id) => document.getElementById(id);
const statusText = $("statusText");
const authStatus = $("authStatus");
function setStatus(t){statusText.textContent=t}

async function api(path, method="GET", body=null){
  const headers = {"Content-Type":"application/json"};
  if(state.token) headers.Authorization = `Bearer ${state.token}`;
  const r = await fetch(`${API_BASE}${path}`, {method, headers, body: body ? JSON.stringify(body):null});
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.detail || `API错误 ${r.status}`);
  return data;
}

function requireLogin(){ if(!state.token){ setStatus("请先登录"); return false; } return true; }

document.querySelectorAll(".nav-btn").forEach((btn)=>btn.addEventListener("click",()=>{document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));btn.classList.add("active");$(btn.dataset.target).classList.add("active");}));

async function refreshProjects(){
  if(!state.token) return;
  const projects = await api("/projects");
  const sel = $("projectSelect"); sel.innerHTML = "";
  projects.forEach(p=>{ const op=document.createElement("option"); op.value=p.id; op.textContent=`#${p.id} ${p.name}`; sel.appendChild(op); });
  if(projects[0]){ sel.value = projects[0].id; loadProject(projects[0]); }
}

function loadProject(p){
  state.projectId = Number(p.id);
  state.novel = p.novel || "";
  state.adapted = p.adapted_script || "";
  $("novelInput").value = state.novel;
  $("adaptOutput").textContent = state.adapted || "暂无内容";
  setStatus(`已加载项目：${p.name}`);
}

$("registerBtn").addEventListener("click", async ()=>{
  try { const data = await api("/auth/register", "POST", {username: $("username").value, password: $("password").value}); state.token=data.token; state.username=data.username; localStorage.setItem("token",state.token); authStatus.textContent=`已登录：${state.username}`; setStatus("注册并登录成功"); await refreshProjects(); }
  catch(e){ setStatus(e.message); }
});

$("loginBtn").addEventListener("click", async ()=>{
  try { const data = await api("/auth/login", "POST", {username: $("username").value, password: $("password").value}); state.token=data.token; state.username=data.username; localStorage.setItem("token",state.token); authStatus.textContent=`已登录：${state.username}`; setStatus("登录成功"); await refreshProjects(); }
  catch(e){ setStatus(e.message); }
});

$("createProjectBtn").addEventListener("click", async ()=>{
  if(!requireLogin()) return;
  try { const name = $("projectName").value || `项目-${Date.now()}`; await api("/projects", "POST", {name}); setStatus("项目创建成功"); await refreshProjects(); }
  catch(e){ setStatus(e.message); }
});

$("projectSelect").addEventListener("change", async (e)=>{
  if(!requireLogin()) return;
  const projects = await api("/projects");
  const p = projects.find(x=>String(x.id)===e.target.value);
  if(p) loadProject(p);
});

$("saveProjectBtn").addEventListener("click", async ()=>{
  if(!requireLogin() || !state.projectId) return setStatus("请先创建/选择项目");
  try {
    await api(`/projects/${state.projectId}`, "PUT", { novel: $("novelInput").value, adapted_script: $("adaptOutput").textContent, structure_json: { storyboard: state.storyboard, assets: state.assets, analytics: state.analytics } });
    setStatus("项目已保存到数据库");
  } catch(e){ setStatus(e.message); }
});

$("quickDemoBtn").addEventListener("click",()=>{$("novelInput").value="林夜被嘲讽后，三秒内反转打脸，全场震惊。雨夜天台，他一句话逼退对手，掀起情绪高潮。随后师父现身，揭露更大阴谋，留下强钩子。"; setStatus("已加载演示数据");});

$("adaptBtn").addEventListener("click", async ()=>{
  if(!requireLogin()) return;
  try { const text = $("novelInput").value.trim(); if(!text) return setStatus("请先输入小说内容"); state.novel=text; const data = await api("/generate/adapt", "POST", {text, screen_mode: state.screenMode}); state.adapted = data.adapted_script; $("adaptOutput").textContent = state.adapted; setStatus("改编生成完成（后端API）"); }
  catch(e){ setStatus(e.message); }
});

$("hookBtn").addEventListener("click",()=>{ if(!state.adapted) return setStatus("请先生成改编内容"); $("adaptOutput").textContent += "\n\n【钩子优化】前3秒加入‘身份反差+时间倒计时+结果悬念’。"; setStatus("已强化钩子"); });

$("generateStoryboard").addEventListener("click", async ()=>{
  if(!requireLogin()) return;
  try { const data = await api("/generate/storyboard", "POST", {adapted_script: $("adaptOutput").textContent}); state.storyboard = data.storyboard; const tbody=document.querySelector("#storyboardTable tbody"); tbody.innerHTML=""; state.storyboard.forEach(row=>{const tr=document.createElement("tr");row.forEach(c=>{const td=document.createElement("td");td.textContent=c;tr.appendChild(td);});tbody.appendChild(tr);}); setStatus(`已生成 ${state.storyboard.length} 条分镜`); }
  catch(e){ setStatus(e.message); }
});

$("toggleScreen").addEventListener("click",()=>{state.screenMode = state.screenMode === "竖屏" ? "横屏" : "竖屏"; setStatus(`当前分镜适配：${state.screenMode}`);});

$("extractAssets").addEventListener("click", async ()=>{
  if(!requireLogin()) return;
  try { const data = await api("/generate/assets", "POST", {storyboard: state.storyboard}); state.assets = data; [["characterAssets","characters"],["sceneAssets","scenes"],["propAssets","props"]].forEach(([id,key])=>{const el=$(id);el.innerHTML="";(state.assets[key]||[]).forEach(item=>{const li=document.createElement("li");li.textContent=item;el.appendChild(li);});}); setStatus("资产提取完成"); }
  catch(e){ setStatus(e.message); }
});

function createCanvasNodes(){ const board=$("canvasBoard"); const nodes=[["小说输入",30,40],["短剧改编",230,80],["分镜生成",430,140],["资产提取",640,200],["视频生成",840,260]]; board.innerHTML=""; nodes.forEach(([name,x,y])=>{const node=document.createElement("div"); node.className="node"; node.textContent=name; node.style.left=`${x}px`; node.style.top=`${y}px`; makeDraggable(node,board); board.appendChild(node);}); }
function makeDraggable(el, container){ let active=false,offsetX=0,offsetY=0; el.addEventListener("pointerdown",(e)=>{active=true;offsetX=e.clientX-el.offsetLeft;offsetY=e.clientY-el.offsetTop;el.setPointerCapture(e.pointerId)}); el.addEventListener("pointermove",(e)=>{if(!active)return; const x=Math.max(0,Math.min(container.clientWidth-el.offsetWidth,e.clientX-offsetX)); const y=Math.max(0,Math.min(container.clientHeight-el.offsetHeight,e.clientY-offsetY)); el.style.left=`${x}px`;el.style.top=`${y}px`;}); el.addEventListener("pointerup",()=>active=false); }

$("analyzeBtn").addEventListener("click",()=>{ const density=Math.min(100,30+state.storyboard.length*12+state.assets.props.length*8); const pleasure=Math.min(100,45+state.storyboard.length*10); const viral=Math.round((density+pleasure)/2); state.analytics={pleasureIndex:pleasure,viralScore:viral,hotspotDensity:density,emotionCurve:[45,55,70,88,62,74,92,68]}; $("metricsCard").innerHTML=`<p>爽感指数：<strong>${pleasure}</strong></p><p>爆款评分：<strong>${viral}</strong></p><p>爆点密度：<strong>${density}</strong></p>`; const bars=$("emotionBars"); bars.innerHTML=""; state.analytics.emotionCurve.forEach(v=>{const bar=document.createElement("div");bar.className="bar";bar.style.height=`${v}%`;bars.appendChild(bar);}); setStatus("爆款分析完成");});

$("exportJson").addEventListener("click",()=>{ const payload={projectId:state.projectId,screenMode:state.screenMode,novel:$("novelInput").value,adaptedScript:$("adaptOutput").textContent,storyboard:state.storyboard,assets:state.assets,analytics:state.analytics}; const json=JSON.stringify(payload,null,2); $("exportPreview").textContent=json; const blob=new Blob([json],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download="shortdrama-project.json";a.click(); URL.revokeObjectURL(url); setStatus("JSON 导出完成"); });

if(state.token){ authStatus.textContent="已登录（令牌已恢复）"; refreshProjects().catch(()=>{}); }
createCanvasNodes();
