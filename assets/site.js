(function(){
const PROJECTS=window.PROJECTS||[];
const $=id=>document.getElementById(id);
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const S={order:'time',page:null,items:[],tags:new Set(),stat:store.get('static')==='1',zoom:-1,wasOff:false};
const mobile=()=>matchMedia('(max-width:760px)').matches;
const kindOf=src=>/\.gif(\?|$)|^data:image\/gif/i.test(src)?'gif':/\.(mp4|mov|m4v|webm)(\?|$)|^data:video\//i.test(src)?'video':'image';
/* Vimeo / YouTube links */
function embedOf(u){
  let m=String(u).match(/vimeo\.com\/(?:.*?\/)?(?:video\/)?(\d{5,})(?:\/([0-9a-f]{6,}))?/i);
  if(m){const h=m[2]||(String(u).match(/[?&]h=([0-9a-f]+)/i)||[])[1]||'';return {type:'vimeo',id:m[1],h};}
  m=String(u).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if(m)return {type:'youtube',id:m[1]};
  return null;
}
function embedURL(e,bg){
  if(e.type==='vimeo')return 'https://player.vimeo.com/video/'+e.id+'?'+(e.h?'h='+e.h+'&':'')+(bg?'background=1&muted=1&autoplay=1&loop=1&dnt=1':'autoplay=1&dnt=1');
  return 'https://www.youtube-nocookie.com/embed/'+e.id+'?'+(bg?'autoplay=1&mute=1&loop=1&playlist='+e.id+'&controls=0&modestbranding=1&playsinline=1':'autoplay=1&playsinline=1&rel=0');
}
function thumbFor(d,cb){
  const e=d.embed;
  if(e.type==='youtube'){cb('https://i.ytimg.com/vi/'+e.id+'/hqdefault.jpg',16,9);return;}
  fetch('https://vimeo.com/api/oembed.json?width=960&url='+encodeURIComponent(d.src))
    .then(r=>r.json()).then(j=>cb(j.thumbnail_url,j.width,j.height)).catch(()=>cb('',16,9));
}
/* Build the item list: folder photos first, then Pages CMS uploads (which can add captions/tags to folder photos) */
const MEDIA_RE=/\.(jpe?g|png|gif|webp|avif|mp4|mov|m4v|webm)$/i;
const dec=s=>{try{return decodeURIComponent(s)}catch(e){return s}};
const enc=s=>/^\//.test(s)?dec(s).split('/').map(encodeURIComponent).join('/'):s;  // file names may contain spaces, commas and #
const slugify=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const ALL=[],bySrc={};
const keyOf=src=>{const e=embedOf(src);return e?e.type+':'+e.id:dec(src);};
(window.FILES||[]).forEach(path=>{
  const isLink=/\.txt$/i.test(path);          // e.g. "DSCN0028 vimeo 123456789.txt" = a Vimeo video placed in the folder
  if(!MEDIA_RE.test(path)&&!isLink)return;
  const parts=path.split('/');               // ["", "media", page, folder..., file]
  let src=enc(path);
  if(isLink){
    const v=parts[parts.length-1].match(/\b(vimeo|youtube|youtu\.?be)\s+([\w-]+)(?:\s+([0-9a-f]{6,}))?/i);
    if(!v)return;
    src=/vimeo/i.test(v[1])?'https://vimeo.com/'+v[2]+(v[3]?'/'+v[3]:''):'https://www.youtube.com/watch?v='+v[2];
  }
  const page=slugify(parts[2]);
  const folder=parts.length>4?parts[3]:'';
  const m=folder.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
  const date=m?m[1]:'';
  // only words after # are tags, in folder names and file names alike: "2023-04-01 uluru trip #uluru 2023"
  const hashTags=t=>t.split('#').slice(1).map(x=>x.replace(/[,\s]+$/,'').trim()).filter(Boolean);
  const tags=hashTags(folder);
  // tags in the file name: "S1280035 #beach #nikon coolpix.jpg"
  hashTags(parts[parts.length-1].replace(/\.[^.]+$/,'')).forEach(t=>tags.push(t));
  const d={p:page,src,date,title:'',desc:'',tags,file:parts[parts.length-1],dir:parts.slice(0,-1).join('/')};
  ALL.push(d);bySrc[keyOf(src)]=d;
  if(!PROJECTS.some(x=>x.slug===page))PROJECTS.push({slug:page,title:parts[2].replace(/[-_]+/g,' ').replace(/^./,c=>c.toUpperCase()),auto:true});
});
(window.ITEMS||[]).forEach(d=>{
  const src=enc(d.src),hit=bySrc[keyOf(src)];
  if(hit){ // caption / extra tags for a folder photo
    if(d.title&&d.title!==d.upload)hit.title=d.title;
    if(d.desc)hit.desc=d.desc;
    hit.tags=[...new Set([...hit.tags,...(d.tags||[])])];
    return;
  }
  ALL.push({...d,src});
});
ALL.forEach((d,i)=>d.seq=i);
ALL.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(a.dir&&a.dir===b.dir?(a.file||'').localeCompare(b.file||'',undefined,{numeric:true}):0)||a.seq-b.seq);
ALL.forEach(d=>{d.embed=embedOf(d.src);d.kind=d.embed?'embed':kindOf(d.src);d.tags=(d.tags||[]).filter(Boolean).map(t=>String(t).trim().toLowerCase());});

/* --- menu: list of pages --- */
const pagesNav=$('pages');
PROJECTS.forEach(p=>{
  const a=document.createElement('a');a.className='row';a.href='#'+p.slug;a.dataset.slug=p.slug;
  a.innerHTML='<span class="t"></span><span class="n"></span>';
  a.querySelector('.t').textContent=p.title;
  a.querySelector('.n').textContent=ALL.filter(d=>d.p===p.slug).length;
  pagesNav.appendChild(a);
});

/* --- grid --- */
const grid=$('grid'),tagBox=$('tags');
const io='IntersectionObserver' in window?new IntersectionObserver(es=>{es.forEach(en=>{en.target.dataset.inview=en.isIntersecting?'1':'';});applyStatic();},{rootMargin:'200px'}):null;
function setRatio(cell,w,h){if(w&&h){const r=(w/h).toFixed(3);cell.style.flexGrow=r;cell.style.width='calc('+r+' * var(--row))';}}
function buildGrid(){
  grid.innerHTML='';
  S.items.forEach((d,i)=>{
    const b=document.createElement('button');b.className='cell';b.dataset.i=i;
    setRatio(b,3,2);b.setAttribute('aria-label',d.title||'Photo');
    let m;
    if(d.kind==='video'){
      m=document.createElement('video');m.src=d.src+'#t=0.1';m.muted=true;m.loop=true;m.playsInline=true;m.preload='metadata';
      m.addEventListener('loadedmetadata',()=>setRatio(b,m.videoWidth,m.videoHeight));
    }else if(d.kind==='embed'){
      m=document.createElement('img');m.alt=d.title||'';setRatio(b,16,9);
      thumbFor(d,(src,w,h)=>{if(src)m.src=src;d.vr=w&&h?w/h:16/9;setRatio(b,w,h);});
      io&&io.observe(b);
    }else{
      m=document.createElement('img');m.src=d.src;m.alt=d.title||'';m.loading='lazy';m.decoding='async';
      m.addEventListener('load',()=>setRatio(b,m.naturalWidth,m.naturalHeight));
    }
    b.appendChild(m);
    if(d.kind==='gif')b.appendChild(document.createElement('canvas'));
    b.addEventListener('click',()=>openZoom(i));
    grid.appendChild(b);
  });
  const counts={};S.items.forEach(d=>d.tags.forEach(t=>counts[t]=(counts[t]||0)+1));
  tagBox.innerHTML='';
  Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b)).forEach(t=>{
    const b=document.createElement('button');b.className='row tag';b.dataset.tag=t;
    b.innerHTML='<span class="t"></span><span class="n"></span>';
    b.querySelector('.t').textContent=t;b.querySelector('.n').textContent=counts[t];
    b.addEventListener('click',()=>{S.tags.has(t)?S.tags.delete(t):S.tags.add(t);filter();});
    tagBox.appendChild(b);
  });
}
$('clear').addEventListener('click',()=>{S.tags.clear();filter();});
function visible(){return [...grid.children].filter(c=>!c.hidden).map(c=>+c.dataset.i);}
function filter(){
  let shown=0;
  [...grid.children].forEach(c=>{const d=S.items[c.dataset.i];
    const ok=!S.tags.size||d.tags.some(t=>S.tags.has(t));c.hidden=!ok;if(ok)shown++;});
  tagBox.querySelectorAll('.tag').forEach(b=>{const on=S.tags.has(b.dataset.tag);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  $('clear').hidden=!S.tags.size;$('empty').hidden=shown>0||!S.page;
  applyStatic();
}

/* --- order: time or shuffle (keeps the selected tags) --- */
function applyOrder(){
  const cells=[...grid.children];
  if(S.order==='shuffle'){for(let i=cells.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}}
  else cells.sort((a,b)=>a.dataset.i-b.dataset.i);
  cells.forEach(c=>grid.appendChild(c));
  $('order').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.o===S.order));
}
$('order').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.order=b.dataset.o;applyOrder();window.scrollTo(0,0);});

/* --- light / dark --- */
function applyTheme(){
  const dark=document.documentElement.classList.contains('dark'),b=$('theme');
  b.setAttribute('aria-pressed',dark);b.dataset.label=dark?'Light mode':'Dark mode';b.setAttribute('aria-label',b.dataset.label);
}
$('theme').addEventListener('click',()=>{const d=document.documentElement.classList.toggle('dark');store.set('theme',d?'dark':'light');applyTheme();});
applyTheme();

/* Vimeo/YouTube in the grid: size the player so the video covers its tile edge to edge */
function fitFrame(c,f,vr){
  vr=vr||16/9;const cr=(c.clientWidth||1)/(c.clientHeight||1);
  const w=Math.max(1,vr/cr)*100,h=Math.max(1,cr/vr)*100;
  f.style.width=w+'%';f.style.height=h+'%';f.style.left=(100-w)/2+'%';f.style.top=(100-h)/2+'%';
}
window.addEventListener('resize',()=>grid.querySelectorAll('.cell iframe').forEach(f=>{const c=f.parentElement;fitFrame(c,f,S.items[c.dataset.i]&&S.items[c.dataset.i].vr);}));

/* Keyboard: S shuffles (press again to reshuffle) */
document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||/input|textarea|select/i.test(e.target.tagName))return;
  if((e.key==='s'||e.key==='S')&&S.page&&S.zoom<0){S.order='shuffle';applyOrder();window.scrollTo(0,0);}
});

/* --- static mode --- */
function freeze(img,canvas){
  if(!img.complete||!img.naturalWidth){img.addEventListener('load',()=>freeze(img,canvas),{once:true});return;}
  canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  canvas.getContext('2d').drawImage(img,0,0);
}
function applyStatic(){
  $('motion').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.m==='pause')===S.stat));
  grid.querySelectorAll('.cell').forEach(c=>{
    const v=c.querySelector('video'),cv=c.querySelector('canvas');
    if(v){(S.stat||c.hidden||!S.page||S.zoom>-1)?v.pause():v.play().catch(()=>{});}
    if(cv){if(S.stat)freeze(c.querySelector('img'),cv);c.classList.toggle('frozen',S.stat);}
    const d=S.items[c.dataset.i];
    if(d&&d.kind==='embed'){
      const live=!S.stat&&!c.hidden&&S.page&&S.zoom<0&&(!io||c.dataset.inview==='1');
      let f=c.querySelector('iframe');
      if(live&&!f){f=document.createElement('iframe');f.src=embedURL(d.embed,true);f.title=d.title||'Video';f.tabIndex=-1;f.allow='autoplay; fullscreen; picture-in-picture';f.setAttribute('aria-hidden','true');
        f.addEventListener('load',()=>setTimeout(()=>c.classList.add('playing'),400));c.appendChild(f);fitFrame(c,f,d.vr);}
      if(!live&&f){f.remove();c.classList.remove('playing');}
    }
  });
  const z=$('zoom'),zv=z.querySelector('video'),zc=z.querySelector('canvas');
  if(zv){S.stat?zv.pause():zv.play().catch(()=>{});}
  if(zc){if(S.stat)freeze(z.querySelector('img'),zc);z.classList.toggle('frozen',S.stat);}
}
$('motion').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.stat=b.dataset.m==='pause';store.set('static',S.stat?'1':'0');applyStatic();});

/* --- zoom --- */
function fillDetail(el,d,pos,total){
  el.innerHTML='<button class="back" data-act="close">← Back to grid</button><div><h3></h3><div class="date"></div></div><p></p><div class="dtags"></div>'+
    '<div class="nav"><button data-act="prev">← Prev</button><span>'+pos+' / '+total+'</span><button data-act="next">Next →</button></div>';
  el.querySelector('h3').textContent=d.title||'';
  el.querySelector('.date').textContent=d.date?new Date(d.date+'T00:00').toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'}):'';
  const p=el.querySelector('p');if(d.desc)p.textContent=d.desc;else p.remove();
  const tg=el.querySelector('.dtags');
  d.tags.forEach(t=>{const b=document.createElement('button');b.dataset.tag=t;b.textContent='#'+t;tg.appendChild(b);});
}
function openZoom(i){
  const list=visible(),pos=list.indexOf(i);if(pos<0)return;
  S.zoom=i;const d=S.items[i],st=$('stage');st.innerHTML='';
  let m;
  if(d.kind==='video'){m=document.createElement('video');m.src=d.src;m.muted=true;m.loop=true;m.playsInline=true;m.controls=true;m.addEventListener('click',e=>e.stopPropagation());}
  else if(d.kind==='embed'){m=document.createElement('iframe');m.src=embedURL(d.embed,false);m.title=d.title||'Video';m.allow='autoplay; fullscreen; picture-in-picture';m.allowFullscreen=true;}
  else{m=document.createElement('img');m.src=d.src;m.alt=d.title||'';}
  st.appendChild(m);if(d.kind==='gif')st.appendChild(document.createElement('canvas'));
  fillDetail($('detail'),d,pos+1,list.length);fillDetail($('zcap'),d,pos+1,list.length);
  $('detail').hidden=false;$('controls').hidden=true;$('zoom').hidden=false;
  if(!mobile()&&document.body.classList.contains('menu-off')){S.wasOff=true;document.body.classList.remove('menu-off');}
  applyStatic();
}
function closeZoom(){
  if(S.zoom<0)return;S.zoom=-1;$('zoom').hidden=true;$('stage').innerHTML='';
  $('detail').hidden=true;$('controls').hidden=!S.page;
  if(S.wasOff){document.body.classList.add('menu-off');S.wasOff=false;}
  applyStatic();
}
function step(n){const l=visible(),p=l.indexOf(S.zoom);if(l.length)openZoom(l[(p+n+l.length)%l.length]);}
function detailClick(e){
  const b=e.target.closest('button');if(!b)return;e.stopPropagation();
  if(b.dataset.act==='close')closeZoom();
  else if(b.dataset.act==='prev')step(-1);
  else if(b.dataset.act==='next')step(1);
  else if(b.dataset.tag){S.tags.clear();S.tags.add(b.dataset.tag);closeZoom();filter();}
}
$('detail').addEventListener('click',detailClick);$('zcap').addEventListener('click',detailClick);
$('zoom').addEventListener('click',e=>{if(!e.target.closest('.zcap'))closeZoom();});
document.addEventListener('keydown',e=>{
  if(S.zoom<0)return;
  if(e.key==='Escape')closeZoom();else if(e.key==='ArrowRight')step(1);else if(e.key==='ArrowLeft')step(-1);
});

/* --- menu show/hide --- */
$('hide').addEventListener('click',()=>{document.body.classList.add('menu-off');S.wasOff=false;});
$('open').addEventListener('click',()=>document.body.classList.remove('menu-off'));
document.addEventListener('click',e=>{if(mobile()&&!document.body.classList.contains('menu-off')&&!e.target.closest('.menu,.open-menu'))document.body.classList.add('menu-off');},true);

/* --- pages (the address ends in #page-name) --- */
function route(){
  const slug=decodeURIComponent(location.hash.slice(1))||(PROJECTS[0]&&PROJECTS[0].slug)||'';  // no page chosen: open the first page (Everyday)
  const proj=PROJECTS.find(p=>p.slug===slug)||null;
  closeZoom();
  if((proj&&proj.slug)!==S.page){S.page=proj&&proj.slug;S.tags.clear();S.items=proj?ALL.filter(d=>d.p===proj.slug):[];buildGrid();applyOrder();}
  $('v-grid').hidden=!proj;$('controls').hidden=!proj;
  pagesNav.querySelectorAll('a').forEach(a=>a.classList.toggle('on',a.dataset.slug===S.page));
  if(proj&&mobile())document.body.classList.add('menu-off');
  filter();window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
$('home-link').addEventListener('click',e=>{
  e.preventDefault();document.body.classList.add('menu-off');S.wasOff=false;S.stat=false;store.set('static','0');S.tags.clear();S.order='time';applyOrder();document.documentElement.classList.remove('dark');store.set('theme','light');applyTheme();
  history.replaceState(null,'',location.pathname+location.search);route();
});
route();
})();
