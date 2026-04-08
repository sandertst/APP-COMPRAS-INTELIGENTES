import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const STORAGE_KEY_PRODUTOS="comprasInteligenteProdutos";
const STORAGE_KEY_TOTAL="comprasInteligenteTotal";
const STORAGE_KEY_CHECKS="comprasInteligenteChecks";
const STORAGE_KEY_CATEGORIA="comprasInteligenteCategoria";
const STORAGE_KEY_MERCADO_CATEGORIA="comprasInteligenteMercadoCategoria";
const STORAGE_KEY_OCULTAR="comprasInteligenteOcultarComprados";
const STORAGE_KEY_DEVICE="comprasInteligenteDeviceName";
const STORAGE_KEY_LOG="comprasInteligenteFamilyLog";

let produtos=[], totalCompra=0, checksComprados={}, categoriaAtiva="Todas", categoriaMercadoAtiva="Todas", ocultarComprados=true;
let firebaseAtivo=false, listaRef=null, ignorarRenderRemoto=false, deferredPrompt=null, deviceName="";

function formatarNumero(v){return Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:2});}
function formatarMoeda(v){return Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});}
function escapeHtml(t){return String(t??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
function carregarLocal(chave,fallback){try{const v=JSON.parse(localStorage.getItem(chave));return v??fallback}catch{return fallback}}
function salvarLocal(chave,valor){localStorage.setItem(chave,JSON.stringify(valor))}
function atualizarStatus(texto){document.getElementById("syncStatus").textContent=texto;document.getElementById("familyStatus").textContent=texto;}
function nowText(){const d=new Date();return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});}
function getDeviceName(){if(!deviceName){deviceName=localStorage.getItem(STORAGE_KEY_DEVICE)||"Aparelho";}return deviceName;}
function setDeviceName(nome){deviceName=nome||"Aparelho";localStorage.setItem(STORAGE_KEY_DEVICE,deviceName);}
function logFamilia(texto){const logs=carregarLocal(STORAGE_KEY_LOG,[]);logs.unshift({texto,quando:nowText()});salvarLocal(STORAGE_KEY_LOG,logs.slice(0,12));renderFamilyLog();}
function renderFamilyLog(){const el=document.getElementById("familyLog");if(!el)return;const logs=carregarLocal(STORAGE_KEY_LOG,[]);el.innerHTML=logs.length?logs.map(item=>`<div class="family-log-item"><strong>${escapeHtml(item.quando)}</strong><br>${escapeHtml(item.texto)}</div>`).join(""):`<div class="family-log-item">Ainda não há ações registradas.</div>`;}

function snapshotPadrao(){return{produtos:[...produtosPadrao].map(p=>({...p,estoqueAtual:0})),totalCompra:0,checksComprados:{},atualizadoEm:Date.now()};}

async function iniciarFirebaseSeConfigurado(){
  const cfg=window.firebaseSettings||{};
  if(!cfg.enabled||!cfg.apiKey||!cfg.databaseURL||!cfg.projectId||!cfg.appId){atualizarStatus("Modo local");return;}
  const app=initializeApp({apiKey:cfg.apiKey,authDomain:cfg.authDomain,databaseURL:cfg.databaseURL,projectId:cfg.projectId,appId:cfg.appId});
  const db=getDatabase(app);
  listaRef=ref(db,`listas/${cfg.shoppingListId}`);
  firebaseAtivo=true;
  atualizarStatus("Sincronização ativa");
  const existente=await get(listaRef);
  if(!existente.exists()) await set(listaRef,snapshotPadrao());
  onValue(listaRef,(snapshot)=>{
    const dados=snapshot.val()||snapshotPadrao();
    ignorarRenderRemoto=true;
    produtos=Array.isArray(dados.produtos)?dados.produtos:snapshotPadrao().produtos;
    totalCompra=Number(dados.totalCompra||0);
    checksComprados=dados.checksComprados||{};
    salvarTudoLocal();
    renderizarTudo();
    ignorarRenderRemoto=false;
  });
}
async function sincronizarRemoto(){
  if(!firebaseAtivo||!listaRef||ignorarRenderRemoto) return;
  await update(listaRef,{produtos,totalCompra,checksComprados,atualizadoEm:Date.now()});
}

function carregarEstadoInicial(){
  produtos=carregarLocal(STORAGE_KEY_PRODUTOS,[...produtosPadrao].map(p=>({...p,estoqueAtual:0})));
  totalCompra=Number(localStorage.getItem(STORAGE_KEY_TOTAL)||"0")||0;
  checksComprados=carregarLocal(STORAGE_KEY_CHECKS,{});
  categoriaAtiva=localStorage.getItem(STORAGE_KEY_CATEGORIA)||"Todas";
  categoriaMercadoAtiva=localStorage.getItem(STORAGE_KEY_MERCADO_CATEGORIA)||"Todas";
  ocultarComprados=localStorage.getItem(STORAGE_KEY_OCULTAR)!=="false";
  deviceName=localStorage.getItem(STORAGE_KEY_DEVICE)||"Aparelho";
}
function salvarTudoLocal(){
  salvarLocal(STORAGE_KEY_PRODUTOS,produtos);
  localStorage.setItem(STORAGE_KEY_TOTAL,String(totalCompra));
  salvarLocal(STORAGE_KEY_CHECKS,checksComprados);
  localStorage.setItem(STORAGE_KEY_CATEGORIA,categoriaAtiva);
  localStorage.setItem(STORAGE_KEY_MERCADO_CATEGORIA,categoriaMercadoAtiva);
  localStorage.setItem(STORAGE_KEY_OCULTAR,String(ocultarComprados));
  localStorage.setItem(STORAGE_KEY_DEVICE,getDeviceName());
}
function normalizarProdutos(){
  produtos=produtos.map((p,i)=>({
    id:p.id||`base_${i+1}`,
    nome:p.nome||`Produto ${i+1}`,
    minimo:Math.max(0,Number(p.minimo||0)),
    unidade:p.unidade||"un",
    categoria:p.categoria||"Outros",
    estoqueAtual:Math.max(0,Number(p.estoqueAtual||0))
  }));
}
function getCategorias(){
  const cats=Array.from(new Set(produtos.map(p=>p.categoria||"Outros"))).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  return ["Todas",...cats];
}
function renderizarChips(containerId,ativa,onClick){
  const el=document.getElementById(containerId);
  el.innerHTML="";
  getCategorias().forEach(cat=>{
    const btn=document.createElement("button");
    btn.className="chip"+(cat===ativa?" active":"");
    btn.textContent=cat;
    btn.addEventListener("click",()=>onClick(cat));
    el.appendChild(btn);
  });
}
function produtoVisivel(produto,termo,categoria){
  const okBusca=!termo||String(produto.nome||"").toLowerCase().includes(termo);
  const okCat=categoria==="Todas"||(produto.categoria||"Outros")===categoria;
  return okBusca&&okCat;
}
function atualizarProduto(id,campo,valor){
  const produto=produtos.find(p=>p.id===id); if(!produto) return;
  if(campo==="nome"||campo==="unidade"||campo==="categoria") produto[campo]=valor;
  else if(campo==="minimo"||campo==="estoqueAtual") produto[campo]=Math.max(0,Number(String(valor).replace(",", "."))||0);
  salvarTudoLocal(); sincronizarRemoto();
  if(campo==="categoria"){renderizarCategorias(); renderizarMercado();}
  atualizarDashboard();
}
function adicionarProduto(){
  const nome=document.getElementById("novoNome").value.trim();
  const minimo=Math.max(0,parseFloat(String(document.getElementById("novoMinimo").value).replace(",", "."))||0);
  const unidade=document.getElementById("novoUnidade").value.trim()||"un";
  const categoria=document.getElementById("novaCategoria").value||"Outros";
  if(!nome){alert("Digite o nome do produto."); return;}
  produtos.unshift({id:`prod_${Date.now()}_${Math.floor(Math.random()*1000)}`,nome,minimo,unidade,categoria,estoqueAtual:0});
  salvarTudoLocal(); renderizarTudo(); sincronizarRemoto();
  document.getElementById("novoNome").value="";
  document.getElementById("novoMinimo").value="";
  document.getElementById("novoUnidade").value="un";
}
function excluirProduto(id){
  const produto=produtos.find(p=>p.id===id); if(!produto) return;
  if(!confirm(`Excluir o produto "${produto.nome}"?`)) return;
  produtos=produtos.filter(p=>p.id!==id); delete checksComprados[id];
  salvarTudoLocal(); renderizarTudo(); sincronizarRemoto();
}
function renderizarProdutos(filtro=""){
  const container=document.getElementById("listaProdutos");
  const termo=filtro.trim().toLowerCase();
  container.innerHTML="";
  let exibidos=0;
  produtos.forEach(produto=>{
    if(!produtoVisivel(produto,termo,categoriaAtiva)) return;
    exibidos++;
    const card=document.createElement("div");
    card.className="product-card";
    card.innerHTML=`
      <div class="product-grid">
        <div><label class="product-label">Produto</label><input type="text" value="${escapeHtml(produto.nome)}" oninput="window.app.atualizarProduto('${produto.id}','nome',this.value)" /></div>
        <div><label class="product-label">Mínimo</label><input type="number" min="0" step="0.01" value="${produto.minimo ?? 0}" oninput="window.app.atualizarProduto('${produto.id}','minimo',this.value)" /></div>
        <div><label class="product-label">Unidade</label><input type="text" value="${escapeHtml(produto.unidade || "un")}" oninput="window.app.atualizarProduto('${produto.id}','unidade',this.value)" /></div>
        <div><label class="product-label">Categoria</label><select onchange="window.app.atualizarProduto('${produto.id}','categoria',this.value)">${getCategorias().filter(c=>c!=="Todas").map(c=>`<option value="${escapeHtml(c)}" ${c===produto.categoria?"selected":""}>${escapeHtml(c)}</option>`).join("")}</select></div>
        <div><label class="product-label">Em casa</label><input type="number" min="0" step="0.01" value="${produto.estoqueAtual ?? 0}" oninput="window.app.atualizarProduto('${produto.id}','estoqueAtual',this.value)" /></div>
      </div>
      <div class="product-actions"><button class="btn btn-delete btn-full" onclick="window.app.excluirProduto('${produto.id}')">Excluir</button></div>`;
    container.appendChild(card);
  });
  document.getElementById("contadorProdutos").textContent=`${exibidos} produtos`;
}
function itensDaListaBase(){
  return produtos.map(produto=>{
    const minimo=Math.max(0,Number(produto.minimo||0));
    const estoqueAtual=Math.max(0,Number(produto.estoqueAtual||0));
    const falta=Math.max(0,minimo-estoqueAtual);
    return {...produto,minimo,estoqueAtual,falta,comprado:!!checksComprados[produto.id]};
  }).filter(item=>item.falta>0);
}
function renderizarMercado(){
  const lista=document.getElementById("listaCompras");
  const resumo=document.getElementById("listaResumo");
  const busca=(document.getElementById("buscaMercado").value||"").trim().toLowerCase();
  const itensBase=itensDaListaBase();
  let itens=itensBase.filter(item=>produtoVisivel(item,busca,categoriaMercadoAtiva));
  if(ocultarComprados) itens=itens.filter(item=>!item.comprado);
  const agrupados={};
  itens.forEach(item=>{
    const cat=item.categoria||"Outros";
    if(!agrupados[cat]) agrupados[cat]=[];
    agrupados[cat].push(item);
  });
  const cats=Object.keys(agrupados).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  lista.innerHTML="";
  cats.forEach(cat=>{
    const title=document.createElement("div");
    title.className="market-category-title";
    title.textContent=cat;
    lista.appendChild(title);
    agrupados[cat].forEach(item=>{
      const card=document.createElement("div");
      card.className="shopping-item"+(item.comprado?" comprado":"");
      card.innerHTML=`
        <div>
          <div class="item-title">${escapeHtml(item.nome)}</div>
          <span class="qty-badge">Comprar ${formatarNumero(item.falta)} ${escapeHtml(item.unidade || "un")}</span>
          <span class="item-meta">Mínimo: ${formatarNumero(item.minimo)} | Em casa: ${formatarNumero(item.estoqueAtual)}</span>
        </div>
        <div class="market-item-actions">
          <button class="btn ${item.comprado?"btn-light":"btn-primary"} pick-btn" onclick="window.app.alternarComprado('${item.id}')">${item.comprado?"Desmarcar":"Marcar pego"}</button>
        </div>`;
      lista.appendChild(card);
    });
  });
  if(!itens.length){
    lista.innerHTML=`<div class="family-log-item">Nada pendente nesta visão. Tente trocar a categoria, a busca ou mostrar comprados.</div>`;
  }
  const totalBase=itensDaListaBase().length;
  const concluidos=itensDaListaBase().filter(i=>i.comprado).length;
  const percentual=totalBase===0?0:Math.round((concluidos/totalBase)*100);
  const barra=document.getElementById("barra");
  barra.style.width=percentual+"%";
  barra.textContent=percentual+"%";
  resumo.textContent=totalBase===0?"Tudo certo. Sua lista zerou bonito.":`${totalBase} item(ns) faltando. ${concluidos} já marcados.`;
  atualizarDashboard();
}
function alternarComprado(id){marcarComprado(id,!checksComprados[id]);}
function marcarComprado(id,checked){
  checksComprados[id]=checked;
  salvarTudoLocal();
  const item=produtos.find(p=>p.id===id);
  if(item){logFamilia(`${getDeviceName()} ${checked?"marcou":"desmarcou"} ${item.nome}.`);}
  renderizarMercado();
  sincronizarRemoto();
}
function atualizarDashboard(){
  const itens=itensDaListaBase();
  const concluidos=itens.filter(i=>i.comprado).length;
  const percentual=itens.length===0?0:Math.round((concluidos/itens.length)*100);
  document.getElementById("statProdutos").textContent=produtos.length;
  document.getElementById("statFaltando").textContent=itens.length;
  document.getElementById("statProgresso").textContent=percentual+"%";
  document.getElementById("statTotal").textContent=formatarMoeda(totalCompra);
}
function adicionarValor(){
  const campo=document.getElementById("valorItem");
  const valor=parseFloat(String(campo.value).replace(",", "."))||0;
  totalCompra+=valor;
  salvarTudoLocal();
  document.getElementById("total").textContent=formatarMoeda(totalCompra);
  atualizarDashboard();
  campo.value="";
  sincronizarRemoto();
}
function zerarTotal(){
  totalCompra=0;
  salvarTudoLocal();
  document.getElementById("total").textContent=formatarMoeda(totalCompra);
  atualizarDashboard();
  sincronizarRemoto();
}
function exportarLista(){
  const itens=itensDaListaBase();
  if(!itens.length){alert("A lista de compras está vazia."); return;}
  const linhas=["COMPRAS INTELIGENTE",""];
  itens.forEach(item=>linhas.push(`- ${item.nome} | Comprar: ${formatarNumero(item.falta)} ${item.unidade} | Categoria: ${item.categoria} | ${item.comprado?"PEGUEI":"PENDENTE"}`));
  linhas.push("",`Total de itens: ${itens.length}`,`Total acumulado na calculadora: R$ ${formatarMoeda(totalCompra)}`);
  const blob=new Blob([linhas.join("\\n")],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="lista-de-compras.txt";a.click();
  URL.revokeObjectURL(url);
}
function restaurarPadrao(){
  if(!confirm("Deseja restaurar a lista padrão e apagar alterações locais?")) return;
  produtos=[...produtosPadrao].map(p=>({...p,estoqueAtual:0}));
  totalCompra=0;checksComprados={};
  salvarLocal(STORAGE_KEY_LOG,[]);
  salvarTudoLocal();renderizarTudo();sincronizarRemoto();
}
function trocarTela(nome){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(`screen-${nome}`).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(btn=>btn.classList.toggle("active",btn.dataset.go===nome));
}
function renderizarCategorias(){
  renderizarChips("chipsCategorias",categoriaAtiva,(cat)=>{categoriaAtiva=cat;salvarTudoLocal();renderizarCategorias();renderizarProdutos(document.getElementById("buscaProduto").value);});
  renderizarChips("chipsMercado",categoriaMercadoAtiva,(cat)=>{categoriaMercadoAtiva=cat;salvarTudoLocal();renderizarCategorias();renderizarMercado();});
}
function renderizarTudo(){
  document.getElementById("total").textContent=formatarMoeda(totalCompra);
  document.getElementById("toggleOcultarComprados").checked=ocultarComprados;
  document.getElementById("deviceName").value=getDeviceName();
  renderizarCategorias();
  renderizarProdutos(document.getElementById("buscaProduto").value||"");
  renderizarMercado();
  atualizarDashboard();
  renderFamilyLog();
}
function bindEventos(){
  document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>trocarTela(btn.dataset.go)));
  document.getElementById("btnStartShopping").addEventListener("click",()=>trocarTela("market"));
  document.getElementById("btnAdicionarProduto").addEventListener("click",adicionarProduto);
  document.getElementById("btnAtualizarMercado").addEventListener("click",renderizarMercado);
  document.getElementById("btnSalvar").addEventListener("click",async()=>{salvarTudoLocal();await sincronizarRemoto();alert("Dados salvos.");});
  document.getElementById("btnRestaurar").addEventListener("click",restaurarPadrao);
  document.getElementById("btnAdicionarValor").addEventListener("click",adicionarValor);
  document.getElementById("btnZerarTotal").addEventListener("click",zerarTotal);
  document.getElementById("btnExportar").addEventListener("click",exportarLista);
  document.getElementById("valorItem").addEventListener("keydown",e=>{if(e.key==="Enter") adicionarValor();});
  document.getElementById("buscaProduto").addEventListener("input",e=>renderizarProdutos(e.target.value));
  document.getElementById("buscaMercado").addEventListener("input",renderizarMercado);
  document.getElementById("toggleOcultarComprados").addEventListener("change",e=>{ocultarComprados=e.target.checked;salvarTudoLocal();renderizarMercado();});
  document.getElementById("deviceName").addEventListener("input",e=>{setDeviceName(e.target.value);document.getElementById("familySummary").textContent=`Este aparelho está como "${getDeviceName()}".`;});
  document.getElementById("novoUnidade").value="un";
  document.getElementById("familySummary").textContent=`Este aparelho está como "${getDeviceName()}".`;
}
function setupPWA(){
  if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));}
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.getElementById("btnInstall").classList.remove("hidden");});
  document.getElementById("btnInstall").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById("btnInstall").classList.add("hidden");});
}
window.app={atualizarProduto,excluirProduto,marcarComprado,alternarComprado};
async function iniciar(){
  carregarEstadoInicial();
  normalizarProdutos();
  bindEventos();
  setupPWA();
  renderizarTudo();
  await iniciarFirebaseSeConfigurado();
}
iniciar();
