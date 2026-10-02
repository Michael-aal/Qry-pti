(() => {
  const $ = (s) => document.querySelector(s);
  const API = localStorage.getItem("qrypti_api_url") || window.QRYPTI_API_URL || "http://localhost:5000";
  const sidebar=$("#sidebar"), rightPanel=$("#rightPanel"), overlay=$("#overlay");
  const closePanels=()=>{sidebar?.classList.remove("active");rightPanel?.classList.remove("active");overlay?.classList.remove("active")};
  $("#toggleSidebar")?.addEventListener("click",()=>{sidebar?.classList.add("active");overlay?.classList.add("active")});
  $("#toggleRightPanel")?.addEventListener("click",()=>{rightPanel?.classList.add("active");overlay?.classList.add("active")});
  $("#closeSidebar")?.addEventListener("click",closePanels); $("#closeRightPanel")?.addEventListener("click",closePanels); overlay?.addEventListener("click",closePanels);

  const settings=JSON.parse(localStorage.getItem("qrypti_settings")||"{}");
  const saveSettings=()=>localStorage.setItem("qrypti_settings",JSON.stringify(settings));
  document.querySelectorAll(".toggle-switch").forEach((toggle,i)=>{
    const key=["blockTrackers","fingerprintProtection","blockScripts","encryptedMode"][i]||"privacyToggle";
    if(settings[key]===false) toggle.classList.add("off");
    toggle.addEventListener("click",()=>{
      settings[key]=settings[key]===false;
      toggle.classList.toggle("off",settings[key]===false); saveSettings();
      if(key==="encryptedMode"&&settings[key]){alert("Encrypted Mode is not a VPN. A web page cannot create a system-wide encrypted tunnel.");settings[key]=false;toggle.classList.add("off");saveSettings();}
    });
  });

  const history=JSON.parse(localStorage.getItem("qrypti_history")||"[]");
  const bookmarks=JSON.parse(localStorage.getItem("qrypti_bookmarks")||"[]");
  function recordHistory(url){if(!url||url==="about:blank")return;history.unshift({url,at:Date.now()});localStorage.setItem("qrypti_history",JSON.stringify(history.slice(0,100)))}
  function normalizeQuery(value){const q=value.trim();if(!q)return"";try{return new URL(q).href}catch{}return "https://www.google.com/search?q="+encodeURIComponent(q)}
  function openUrl(value){const url=normalizeQuery(value);if(!url)return;const frame=$("#searchFrame");if(frame){frame.src=url;frame.style.zIndex="1";frame.onload=()=>recordHistory(url)}else window.open(url,"_blank","noopener,noreferrer");$("#searchBar")&&($("#searchBar").value=url)}
  $(".search")?.addEventListener("click",()=>openUrl($("#searchBar")?.value||""));
  $("#searchBar")?.addEventListener("keydown",e=>{if(e.key==="Enter")openUrl(e.currentTarget.value)});
  window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="l"){e.preventDefault();$("#searchBar")?.focus();$("#searchBar")?.select()}});
  document.querySelectorAll(".tab-nav-item").forEach(t=>t.addEventListener("click",()=>{document.querySelectorAll(".tab-nav-item").forEach(x=>x.classList.remove("active"));t.classList.add("active")}));
  document.querySelectorAll(".category-btn").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".category-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active")}));
  let privacyMode=false; $(".screenshot")?.addEventListener("click",()=>{privacyMode=!privacyMode;document.body.classList.toggle("screenshot-mode",privacyMode);alert(privacyMode?"Privacy mode enabled. OS screenshots cannot be reliably blocked by a web page.":"Privacy mode disabled.")});
  document.addEventListener("contextmenu",e=>{if(privacyMode)e.preventDefault()});
  window.QRYPTI={API,openUrl,history:()=>[...history],bookmarks:()=>[...bookmarks],authToken:()=>localStorage.getItem("qrypti_token")};
})();