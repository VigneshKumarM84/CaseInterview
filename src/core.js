/* Shared helpers used by every Case Room tool. */
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{toast('Could not save in this browser. Download your feedback before closing.')}}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>$('#toast').style.display='none',5000)}
function clock(n){return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function modal(html){$('#modalContent').innerHTML=html;$('#modal').showModal()}
$('#closeModal').onclick=()=>$('#modal').close();
