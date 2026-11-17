/* Velora Beauty storefront
   - Real URLs (/product/slug/, /shop/korean/ ...) so Google can index every page
   - Pages are pre-rendered at build time; this script hydrates them and handles navigation
   - Motion: scroll reveals, word-by-word headings, parallax hero, header hide/show, page transitions
*/
const G = typeof window !== "undefined" ? window : globalThis;
const CFG = G.VELORA_CONFIG || {};
const P = G.P || [];
const SSR = !!G.__PRERENDER;
const PV = !!(G.VELORA_CONFIG&&G.VELORA_CONFIG.preview); // hash routing for sandboxed previews
const curPath = () => PV ? (decodeURIComponent(location.hash.slice(1))||"/") : location.pathname;
const STORE = {
  name: CFG.name || "Velora Beauty",
  wa: CFG.whatsapp || "923000000000",
  phone: CFG.phone || "",
  email: CFG.email || "",
  address: CFG.address || "Lahore, Pakistan",
  hours: CFG.hours || "Mon–Sat, 10am–10pm",
  freeShip: CFG.freeShip || 4999,
  shipFee: CFG.shipFee || 200,
  coupons: CFG.coupons || { WELCOME10: 10 }
};
const CATS = [
  {k:"skincare",n:"Skin Care",d:"Cleansers, serums, moisturisers and sunscreen"},
  {k:"korean",n:"Korean Skincare",d:"Glass-skin favourites from Seoul"},
  {k:"makeup",n:"Makeup",d:"Base, blush, lips and eyes"},
  {k:"perfume",n:"Perfumes",d:"Signature scents for every occasion"},
  {k:"body",n:"Body Care",d:"Butters, oils and body mists"},
  {k:"hair",n:"Hair Care",d:"Oils, masks and styling tools"},
  {k:"tools",n:"Tools & Accessories",d:"Beauty gadgets and essentials"}
];
const CAT_INTRO = {
  skincare:"Dermatologist-favourite skincare for Pakistani weather: gentle cleansers, niacinamide and vitamin C serums, barrier-repair moisturisers and daily sunscreen.",
  korean:"Build a simple Korean routine that actually works: toners, essences, serums and sun creams from Seoul's most-loved brands, delivered across Pakistan.",
  makeup:"Skin-like bases, buildable blush, long-wear lips and everyday eye essentials, with shade notes on every product so you can order with confidence.",
  perfume:"Long-lasting fragrances for women and men, from fresh daytime scents to rich evening perfumes for weddings and Eid.",
  body:"Rich body butters, fast-absorbing oils and fine fragrance mists that keep skin soft through Pakistan's dry winters and humid summers.",
  hair:"Hair oils, masks and styling tools for smoother, shinier, healthier-looking hair at home.",
  tools:"Practical beauty tools and accessories that make your routine quicker and easier."
};
const $ = (s,el=document)=>el.querySelector(s), $$=(s,el=document)=>[...el.querySelectorAll(s)];
const rs = n => "Rs " + Math.round(n).toLocaleString("en-PK");
const off = p => p.compare>p.price ? Math.round((1-p.price/p.compare)*100) : 0;
const bySlug = s => P.find(p=>p.slug===s);
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const slugify = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const catOf = k => CATS.find(c=>c.k===k);
const BRAND_COUNT = {}; P.forEach(p=>BRAND_COUNT[p.brand]=(BRAND_COUNT[p.brand]||0)+1);
const BRANDS = Object.keys(BRAND_COUNT).filter(b=>b!=="Essentials"&&b!=="Fragrance"&&BRAND_COUNT[b]>=3).sort((a,b)=>BRAND_COUNT[b]-BRAND_COUNT[a]);
const brandBySlug = s => BRANDS.find(b=>slugify(b)===s);
const U = { home:"/", shop:c=>c?`/shop/${c}/`:"/shop/", sale:"/sale/", p:s=>`/product/${s}/`, brand:b=>`/brand/${slugify(b)}/`, page:k=>`/${k}/` };
const initials = b => String(b).replace(/[^A-Za-z0-9 &]/g,"").split(/[\s&]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const topBrands = (k,n=3) => { const c={}; P.filter(p=>p.cat===k&&p.brand!=="Essentials").forEach(p=>c[p.brand]=(c[p.brand]||0)+1); return Object.keys(c).sort((a,b)=>c[b]-c[a]).slice(0,n) };

/* ---------- storage ---------- */
const store={get(k,d){try{return JSON.parse(localStorage.getItem("vl_"+k))??d}catch(e){return d}},set(k,v){try{localStorage.setItem("vl_"+k,JSON.stringify(v))}catch(e){}}};
const ss={get(k){try{return sessionStorage.getItem("vl_"+k)}catch(e){return null}},set(k,v){try{sessionStorage.setItem("vl_"+k,v)}catch(e){}}};
let cart=SSR?[]:store.get("cart",[]), wish=SSR?[]:store.get("wish",[]), coupon=SSR?null:store.get("coupon",null);
cart=cart.filter(i=>bySlug(i.s)); if(coupon&&!STORE.coupons[coupon]) coupon=null;

/* ---------- analytics (GA4 + Google Ads) ---------- */
function loadTags(){
  const ids=[CFG.ga4,CFG.adsId].filter(Boolean); if(!ids.length) return;
  G.dataLayer=G.dataLayer||[]; G.gtag=function(){G.dataLayer.push(arguments)};
  const s=document.createElement("script"); s.async=true; s.src="https://www.googletagmanager.com/gtag/js?id="+ids[0]; document.head.appendChild(s);
  gtag("js",new Date()); ids.forEach(id=>gtag("config",id));
}
const gItem=(p,q=1)=>({item_id:p.slug,item_name:p.name,item_brand:p.brand,item_category:(catOf(p.cat)||{}).n,price:p.price,quantity:q});
function track(ev,data){ try{ if(G.gtag) gtag("event",ev,Object.assign({currency:"PKR"},data)) }catch(e){} }
function adsConversion(label,data){ if(G.gtag&&CFG.adsId&&label) gtag("event","conversion",Object.assign({send_to:CFG.adsId+"/"+label,currency:"PKR"},data)) }

/* ---------- cart ---------- */
const saveCart=()=>{store.set("cart",cart);store.set("coupon",coupon);syncBadges();renderCart()};
function syncBadges(){
  const n=cart.reduce((a,i)=>a+i.q,0);
  $$("[data-cc]").forEach(b=>{b.textContent=n||"";b.dataset.n=n});
  $$("[data-wl]").forEach(b=>{b.textContent=wish.length||"";b.dataset.n=wish.length});
}
function totals(){
  const sub=cart.reduce((a,i)=>a+bySlug(i.s).price*i.q,0);
  const pct=coupon?STORE.coupons[coupon]||0:0;
  const disc=Math.round(sub*pct/100), after=sub-disc;
  const ship=sub===0||after>=STORE.freeShip?0:STORE.shipFee;
  return {sub,disc,ship,total:after+ship,left:Math.max(0,STORE.freeShip-after),pct:Math.min(100,after/STORE.freeShip*100)};
}
function addToCart(slug,q=1,fromEl){
  const p=bySlug(slug); if(!p||!p.stock) return;
  const it=cart.find(i=>i.s===slug); it?it.q+=q:cart.push({s:slug,q});
  saveCart(); fly(fromEl);
  toast(`Added to bag · <a href="#" data-open="cart">View bag</a>`);
  track("add_to_cart",{value:p.price*q,items:[gItem(p,q)]}); adsConversion(CFG.adsAddToCartLabel,{value:p.price*q});
}
function toggleWish(slug){
  const i=wish.indexOf(slug); i>-1?wish.splice(i,1):wish.push(slug); store.set("wish",wish); syncBadges();
  $$(`.heart[data-w="${slug}"]`).forEach(b=>{b.classList.toggle("on",wish.includes(slug));b.classList.remove("pop");void b.offsetWidth;b.classList.add("pop")});
  toast(i>-1?"Removed from wishlist":"Saved to wishlist");
}
function fly(el){
  const box=el&&el.closest(".card,.pd,.step,.qv");const src=box&&box.querySelector(".ph img"); const target=$("#cartIcon").offsetParent?$("#cartIcon"):$('.bnav [data-open="cart"]');
  if(!src||!target||matchMedia("(prefers-reduced-motion:reduce)").matches){bumpCart();return}
  const a=src.getBoundingClientRect(), b=target.getBoundingClientRect();
  const c=src.cloneNode(true); c.className="flyer"; Object.assign(c.style,{left:a.left+"px",top:a.top+"px",width:a.width+"px",height:a.height+"px"});
  document.body.appendChild(c);
  requestAnimationFrame(()=>{c.style.transform=`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(.1)`;c.style.opacity=".2"});
  setTimeout(()=>{c.remove();bumpCart()},760);
}
function bumpCart(){$$("[data-cc]").forEach(b=>{b.classList.remove("bump");void b.offsetWidth;b.classList.add("bump")})}
let tt; function toast(h){const t=$("#toast");t.innerHTML=h;t.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>t.classList.remove("on"),2600)}

/* ---------- components ---------- */
function pic(p,eager){
  return `<span class="ph" data-i="${esc(initials(p.brand||p.n||"V"))}">${p.img?`<img src="${p.img}" alt="${esc(p.name||p.n)}" width="600" height="600" loading="${eager?"eager":"lazy"}" decoding="async" onload="this.parentNode.classList.add('ok')" onerror="this.parentNode.classList.add('err');this.remove()">`:""}</span>`;
}
const heartSvg=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>`;
const eyeSvg=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const plusSvg=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
function card(p,eager){
  const o=off(p), w=wish.includes(p.slug);
  return `<article class="card rv">
    <div class="art">
      <a href="${U.p(p.slug)}" class="art-link" aria-label="${esc(p.name)}">${pic(p,eager)}</a>
      ${!p.stock?`<span class="soldout">Sold out</span>`:o>=10?`<span class="off">−${o}%</span>`:""}
      <button class="heart ${w?"on":""}" data-w="${p.slug}" aria-label="Save to wishlist">${heartSvg}</button>
      <button class="eye" data-qv="${p.slug}" aria-label="Quick view">${eyeSvg}</button>
      ${p.stock?`<button class="quick" data-add="${p.slug}">${plusSvg}Add to bag</button>`:`<button class="quick" data-notify="${p.slug}">Notify me</button>`}
    </div>
    <div class="info">
      <a class="brand" href="${BRANDS.includes(p.brand)?U.brand(p.brand):U.shop(p.cat)}">${esc(p.brand)}${p.shades?` <em class="shd">· ${p.shades} shades</em>`:""}</a>
      <a href="${U.p(p.slug)}" class="name">${esc(p.name)}</a>
      <div class="price num"><span class="now">${rs(p.price)}</span>${o>=10?`<span class="was">${rs(p.compare)}</span>`:""}</div>
    </div>
  </article>`;
}
function decorateCards(root){ $$(".heart[data-w]",root).forEach(h=>h.classList.toggle("on",wish.includes(h.dataset.w))) }
const icon={
  truck:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>`,
  cash:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v.01M18 15v.01" stroke-linecap="round" stroke-width="2.2"/></svg>`,
  ret:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h11a5 5 0 0 1 0 10H8"/><path d="m8 5-4 4 4 4"/></svg>`,
  chat:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4Z"/><path d="M8 10h8M8 13h5" stroke-linecap="round"/></svg>`,
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z"/><path d="m9 12 2 2 4-4" stroke-linecap="round"/></svg>`,
  cal:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4" stroke-linecap="round"/></svg>`,
  spark:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19.5 9.5l-5.7 1.9L12 17l-1.8-5.6L4.5 9.5l5.7-1.9z"/></svg>`
};
const arrow=`<svg class="arr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const crumbs=(items)=>`<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${items.map(([n,h])=>`<span>/</span>${h?`<a href="${h}">${n}</a>`:`<span>${n}</span>`}`).join("")}</nav>`;


/* ---------- promo banners (light, fast, mobile friendly) ---------- */
const minPrice=k=>rs(Math.min(...P.filter(p=>p.stock&&(!k||p.cat===k)).map(p=>p.price)));
const BANNER_SET=[
 {n:1,lay:"center",bg:"#F6D6D3,#FBEDEA",ink:"#3A1A1F",ac:"#B23A48",eb:"",t:()=>`Ready for the <em>big sale</em>`,d:"Anua, CeraVe, La Roche-Posay, Mielle, MAC, Medicube and more. Cash on Delivery all over Pakistan.",cta:["Shop the sale",U.sale],badge:()=>{const m=Math.max(...P.filter(p=>p.stock).map(off));return m>=10?["Up to",m+"%","OFF"]:null},wa:1},
 {n:2,lay:"split",bg:"#DDEFE6,#F3FAF6",ink:"#12352A",ac:"#2F8F6B",eb:"K-Beauty edit",t:()=>`Glass skin <em>starts here</em>`,d:"Anua, COSRX, Medicube, Purito and Laneige. Seoul's cult favourites for Pakistani weather.",cta:["Shop Korean skincare",U.shop("korean")],badge:()=>["From",minPrice("korean"),""]},
 {n:3,lay:"center",dark:1,bg:"#2B1F18,#120D0A",ink:"#F6EBDD",ac:"#D4AF6A",eb:"Fragrance house",t:()=>`Scents that <em>stay with you</em>`,d:"Long-lasting perfumes for weddings, Eid and every day, from fresh to rich and woody.",cta:["Explore perfumes",U.shop("perfume")],badge:()=>["From",minPrice("perfume"),""]},
 {n:4,lay:"split",bg:"#F3D9E4,#FBEFF4",ink:"#3B1029",ac:"#B5306B",eb:"Makeup studio",t:()=>`Glam that <em>lasts all day</em>`,d:"Foundation, blush, gloss and lipstick from NARS, Fenty Beauty, Estée Lauder, MAC and YSL.",cta:["Shop makeup",U.shop("makeup")],badge:()=>["From",minPrice("makeup"),""]},
 {n:5,lay:"center",bg:"#DCEBF7,#F4F9FD",ink:"#0F2A44",ac:"#1F6FB2",eb:"Derm favourites",t:()=>`Skincare that <em>actually works</em>`,d:"CeraVe, La Roche-Posay, Cetaphil and Paula's Choice for acne, dark spots and dry skin.",cta:["Shop skincare",U.shop("skincare")],badge:()=>["Derm","approved","picks"]},
 {n:6,lay:"split",bg:"#F5E6CC,#FBF4E8",ink:"#3A2A12",ac:"#A8742A",eb:"Hair care",t:()=>`Stronger, <em>shinier hair</em>`,d:"Mielle rosemary, keratin masks, serums and styling tools for salon results at home.",cta:["Shop hair care",U.shop("hair")],badge:()=>["From",minPrice("hair"),""]},
 {n:7,lay:"center",bg:"#FFE9B8,#FFF6DF",ink:"#4A2E00",ac:"#C97700",eb:"Sun care",t:()=>`Your SPF, <em>sorted</em>`,d:"La Roche-Posay, CeraVe, Bioderma and Medicube sunscreens. Light, no white cast, made for daily wear.",cta:["Shop sunscreens",U.shop("skincare")],badge:()=>["SPF","50+","daily"]},
 {n:8,lay:"split",bg:"#EADCF7,#F7F0FC",ink:"#2E1A47",ac:"#8B4FC4",eb:"Body care",t:()=>`Smell good, <em>feel softer</em>`,d:"Sol de Janeiro creams and mists, plus Vaseline body oils for soft, glowing skin.",cta:["Shop body care",U.shop("body")],badge:()=>["From",minPrice("body"),""]},
 {n:9,lay:"center",bg:"#F6D1CF,#FDEDEC",ink:"#4A0E12",ac:"#C8202F",eb:"Lip edit",t:()=>`Lips worth <em>talking about</em>`,d:"Glosses, tints, balms and lipsticks from YSL, Fenty Beauty, NYX, Benefit and Laneige.",cta:["Shop lips",U.shop("makeup")],badge:()=>["From",minPrice("makeup"),""]},
 {n:10,lay:"split",bg:"#F4E7D3,#FBF5EC",ink:"#33261A",ac:"#B08A4E",eb:"Gift sets",t:()=>`Gifts she'll <em>actually love</em>`,d:"Makeup kits, mini sets and brush sets. Perfect for weddings, Eid and birthdays.",cta:["Shop gift sets",U.shop()],badge:()=>["Gift","ready",""]}
];
function bannerHTML(b,first){
  const [c1,c2]=b.bg.split(","), bd=b.badge&&b.badge();
  const wa="+"+STORE.wa.replace(/^92/,"92 ").replace(/(\d{3})(\d{7})$/,"$1 $2");
  const H=first?"h1":"h2";
  return `<section class="pbanner pb-${b.lay}${b.dark?" pb-dark":""}" data-bn="${b.n}" style="--pb1:${c1};--pb2:${c2};--pbi:${b.ink};--pba:${b.ac}" aria-label="${esc(b.eb||STORE.name)}">
    <i class="pb-orb a" aria-hidden="true"></i><i class="pb-orb b" aria-hidden="true"></i>
    <div class="wrap pb-top">
      ${b.n===1?`<div class="pb-brand"><img src="assets/logo-mark.svg" alt="" width="56" height="56"><span><b>VELORA</b><small>BEAUTY</small></span></div>`:`<span class="pb-eb">${b.eb}</span>`}
      <${H} class="pb-title">${b.t()}</${H}>
      <p class="pb-sub">${b.d}</p>
      <div class="pb-pills">${b.wa?`<a href="#" data-wa class="pb-pill">${icon.chat}<span class="num">${wa}</span></a>`:`<span class="pb-pill">${icon.cash}Cash on Delivery</span>`}<span class="pb-pill">${icon.truck}Free delivery over ${rs(STORE.freeShip)}</span></div>
      <div class="pb-ctas"><a class="btn pb-btn" href="${b.cta[1]}">${b.cta[0]} ${arrow}</a></div>
      ${bd?`<div class="pb-badge${String(bd[1]).length>4?" sm":""}"><span>${bd[0]?`<small>${bd[0]}</small>`:""}<b>${bd[1]}</b>${bd[2]?`<small>${bd[2]}</small>`:""}</span></div>`:""}
    </div>
    <picture class="pb-line">
      <source media="(max-width:700px)" srcset="assets/banner/b${b.n}-m.webp" width="1200" height="520">
      <img src="assets/banner/b${b.n}-d.webp" ${b.lay==="split"?'width="1500" height="760"':'width="2600" height="660"'} alt="${esc(b.eb||"Featured")} products" ${first?'fetchpriority="high"':'loading="lazy"'} decoding="async">
    </picture>
    <div class="pb-shelf" aria-hidden="true"></div>
  </section>`;
}
function homeBanners(){ const ids=(CFG.banners&&CFG.banners.length?CFG.banners:[1]); return BANNER_SET.filter(b=>ids.includes(b.n)).sort((x,y)=>ids.indexOf(x.n)-ids.indexOf(y.n)) }
function vBanner(){
  const list=homeBanners();
  if(list.length===1) return bannerHTML(list[0],true);
  return `<div class="pbs" aria-roledescription="carousel" aria-label="Featured offers">
    <div class="pbs-track">${list.map((b,i)=>`<div class="pbs-slide${i?"":" on"}" ${i?'aria-hidden="true"':""}>${bannerHTML(b,i===0)}</div>`).join("")}</div>
    <div class="pbs-ui"><button class="pbs-arrow" data-pbs="-1" aria-label="Previous banner">‹</button><div class="pbs-dots">${list.map((b,i)=>`<button class="pbs-dot${i?"":" on"}" data-pbsgo="${i}" aria-label="Banner ${i+1}"></button>`).join("")}</div><button class="pbs-arrow" data-pbs="1" aria-label="Next banner">›</button></div>
  </div>`;
}
function bannerSlider(){
  const root=$(".pbs"); if(!root) return;
  const s=$$(".pbs-slide",root), d=$$(".pbs-dot",root); let cur=0,t;
  const show=n=>{cur=(n+s.length)%s.length;s.forEach((x,i)=>{x.classList.toggle("on",i===cur);x.toggleAttribute("aria-hidden",i!==cur)});d.forEach((x,i)=>x.classList.toggle("on",i===cur));$(".pbs-track",root).style.height=s[cur].offsetHeight+"px";restart()};
  const restart=()=>{clearInterval(t);if(!matchMedia("(prefers-reduced-motion:reduce)").matches)t=setInterval(()=>{if(!document.hidden&&root.isConnected)show(cur+1);else if(!root.isConnected)clearInterval(t)},6000)};
  $$("[data-pbs]",root).forEach(b=>b.onclick=()=>show(cur+ +b.dataset.pbs));
  $$("[data-pbsgo]",root).forEach(b=>b.onclick=()=>show(+b.dataset.pbsgo));
  let x0=null; root.addEventListener("touchstart",e=>x0=e.touches[0].clientX,{passive:true});
  root.addEventListener("touchend",e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50)show(cur+(dx<0?1:-1));x0=null},{passive:true});
  root.addEventListener("mouseenter",()=>clearInterval(t)); root.addEventListener("mouseleave",restart);
  const fit=()=>$(".pbs-track",root).style.height=s[cur].offsetHeight+"px";
  addEventListener("resize",fit); $$("img",root).forEach(im=>im.addEventListener("load",fit)); fit(); restart();
}
function vBannerGallery(){
  return `<div class="wrap">${crumbs([["Banner options"]])}<div class="shop-head"><h1>Banner options</h1><p>10 designs. Tell us the numbers of the 5 you like.</p></div></div>
  ${BANNER_SET.map(b=>`<div class="bg-item"><div class="wrap bg-lab"><b>Banner ${b.n}</b><span>${b.eb||"Big sale"}</span></div>${bannerHTML(b,false)}</div>`).join("")}`;
}

/* ---------- views ---------- */
const HOME_HERO=["his-confession-lattafa-100ml", "lattafa-khamrah-eau-de-parfum-100ml", "afnan-9pm-perfume-for-men-100ml"];
const ROUTINE=[["Cleanse","anua-heartleaf-quercetinol-pore-deep-cleansing-foam-korea150ml-1"],["Tone","anua-heartleaf-77-soothing-toner-korea-1"],["Treat","anua-niacinamide-10-txa-4-dark-spot-correcting-serum-korea"],["Protect","beauty-of-joseon-relief-sun-rice-probiotics-spf50-50ml-korea"]];
function vHome(){
  const picks=[...P].filter(p=>p.stock&&off(p)>=10).sort((a,b)=>off(b)-off(a)||b.price-a.price).slice(0,10);
  const hero=HOME_HERO.map(bySlug);
  const rTotal=ROUTINE.reduce((a,[,s])=>a+bySlug(s).price,0);
  const nBrands=Object.keys(BRAND_COUNT).length-1;
  return `
  ${vBanner()}




  <div class="bigtype" aria-hidden="true"><div class="bt-row o" data-sp="mq" data-dir="-1">Skincare<span>✦</span>K-Beauty<span>✦</span>Makeup<span>✦</span>Fragrance<span>✦</span>Skincare<span>✦</span>K-Beauty<span>✦</span>Makeup<span>✦</span>Fragrance</div><div class="r2"><div class="bt-row f" data-sp="mq" data-dir="1">Cash on Delivery<span>✦</span>All over Pakistan<span>✦</span>Cash on Delivery<span>✦</span>All over Pakistan<span>✦</span>Cash on Delivery</div></div></div>
  <section class="sec"><div class="wrap">
    <div class="sec-head"><h2 data-split>Shop by <em>category</em></h2><a class="more" href="${U.shop()}">View all ${arrow}</a></div>
    <div class="cats">${CATS.map((c,i)=>{const n=P.filter(p=>p.cat===c.k).length;const rep=P.find(p=>p.cat===c.k&&p.stock);return `<a class="cat rv" style="--d:${i*70}ms" href="${U.shop(c.k)}"><span class="disc">${pic({...rep,name:c.n,brand:c.n})}</span><span>${c.n}<small>${n} products</small></span></a>`}).join("")}</div>
  </div></section>

  <section class="wrap"><div class="flash rv">
    <div class="sec-head"><div><span class="eyebrow" style="color:var(--gold)">This week</span><h2 style="margin-top:8px" data-split>Best <em style="color:var(--gold)">value</em> picks</h2></div>
      <a class="more" href="${U.sale}">See all offers ${arrow}</a></div>
    <div class="rail">${picks.map(p=>card(p)).join("")}</div>
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="sec-head"><h2 data-split>Trending <em>now</em></h2>
      <div class="tabs" role="tablist">${[["all","All"],["korean","Korean"],["makeup","Makeup"],["perfume","Perfumes"],["hair","Hair"]].map(([k,n],i)=>`<button class="tab ${i?"":"on"}" data-tab="${k}" role="tab">${n}</button>`).join("")}</div></div>
    <div class="grid" id="trend">${trendList("all").map(p=>card(p)).join("")}</div>
    <div style="text-align:center;margin-top:28px"><a class="btn ghost" href="${U.shop()}">Browse all products ${arrow}</a></div>
  </div></section>

  <section class="sec" style="padding-top:0"><div class="wrap promos">
    <div class="promo k rv clip"><div class="deco" data-sp="y" data-amt="-30">${pic(bySlug("anua-heartleaf-77-soothing-toner-korea-1"))}</div><span class="eyebrow" style="color:var(--sage)">K-Beauty edit</span><h3>Your <em>glass-skin</em> routine starts here</h3><p>Anua, Axis-Y, Beauty of Joseon and Medicube, picked for Pakistani weather.</p><a class="btn primary" href="${U.shop("korean")}">Shop Korean skincare ${arrow}</a></div>
    <div class="promo f rv clip" style="--d:120ms"><div class="deco" data-sp="y" data-amt="-30">${pic(bySlug("lattafa-khamrah-eau-de-parfum-100ml") || bySlug("tom-ford-black-orchid-perfume"))}</div><span class="eyebrow" style="color:var(--gold)">Fragrance house</span><h3>Scents that <em>linger</em> from ${rs(Math.min(...P.filter(p=>p.cat==="perfume").map(p=>p.price)))}</h3><p>Fresh daytime scents to rich evening perfumes for weddings and Eid.</p><a class="btn ghost" href="${U.shop("perfume")}">Explore perfumes ${arrow}</a></div>
  </div></section>

  <section class="sec" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">4 steps · AM routine</span><h2 style="margin-top:8px" data-split>Build your <em>routine</em></h2></div></div>
    <div class="routine">${ROUTINE.map(([st,s],i)=>{const p=bySlug(s);return `<div class="step rv" style="--d:${i*90}ms"><span class="n">0${i+1}</span><h4>${st}</h4><a class="art" href="${U.p(s)}">${pic(p)}</a><a class="pname" href="${U.p(s)}">${esc(p.name)}</a><div class="price num"><span class="now">${rs(p.price)}</span></div></div>`}).join("")}</div>
    <div class="routine-total rv"><span>Complete routine · <b class="num">${rs(rTotal)}</b>${rTotal>=STORE.freeShip?` &nbsp;<span style="color:var(--ok);font-weight:700">Free delivery included</span>`:""}</span><button class="btn rose" data-routine="${ROUTINE.map(r=>r[1]).join(",")}">Add all 4 to bag</button></div>
  </div></section>

  <div class="brands" aria-label="Brands"><div class="brands-track">${[...BRANDS.slice(0,26),...BRANDS.slice(0,26)].map((b,i)=>`<a href="${U.brand(b)}"${i>=26?' tabindex="-1" aria-hidden="true"':""}>${esc(b)}</a>`).join("")}</div></div>


  <div class="bigtype" aria-hidden="true"><div class="bt-row o" data-sp="mq" data-dir="-1">Velora<span>✦</span>Beauty<span>✦</span>Velora<span>✦</span>Beauty<span>✦</span>Velora<span>✦</span>Beauty<span>✦</span>Velora<span>✦</span>Beauty</div><div class="r2"><div class="bt-row f" data-sp="mq" data-dir="1">Signature scents<span>✦</span>Glass skin<span>✦</span>Signature scents<span>✦</span>Glass skin<span>✦</span>Cash on Delivery</div></div></div>
  <section class="sec"><div class="wrap">
    <div class="sec-head"><h2 data-split>Signature <em>fragrances</em></h2><a class="more" href="${U.shop("perfume")}">All perfumes ${arrow}</a></div>
    <div class="grid">${P.filter(p=>p.cat==="perfume"&&p.stock).slice(0,8).map(p=>card(p)).join("")}</div>
  </div></section>

  <section class="stats" style="padding:0 0 34px"><div class="wrap stats-in">
    <div class="rv"><b class="num" data-count="${P.length}">${P.length}</b><span>products to choose from</span></div>
    <div class="rv"><b class="num" data-count="${nBrands}" data-suffix="+">${nBrands}+</b><span>brands under one roof</span></div>
    <div class="rv"><b class="num">3–5</b><span>working days to your door</span></div>
    <div class="rv"><b class="num">COD</b><span>pay only when it arrives</span></div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap trust">
    <div class="rv">${icon.cash}<b>Cash on Delivery</b><span>Pay when your parcel arrives, anywhere in Pakistan.</span></div>
    <div class="rv" style="--d:80ms">${icon.truck}<b>Free delivery over ${rs(STORE.freeShip)}</b><span>Dispatched within 24 hours, delivered in 3–5 working days.</span></div>
    <div class="rv" style="--d:160ms">${icon.ret}<b>Easy 5-day returns</b><span>Damaged or wrong item? We'll replace it or refund you.</span></div>
    <div class="rv" style="--d:240ms">${icon.chat}<b>WhatsApp support</b><span>Real people to help you pick the right product.</span></div>
  </div></section>

  <section class="sec seo-copy" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><h2 data-split>Online beauty store <em>in Pakistan</em></h2></div>
    <div class="seo-cols rv">
      <p>${esc(STORE.name)} brings skincare, Korean beauty, makeup, perfumes, body care and hair care together in one place, with Cash on Delivery to every major city including Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Multan and Peshawar.</p>
      <p>Shop by concern with serums for dark spots and acne marks, gentle cleansers, barrier-repair moisturisers and daily SPF, or build a complete Korean routine. Every order is checked before dispatch and delivered in 3–5 working days.</p>
      <p>Not sure what suits your skin? Message us on WhatsApp and a real person will help you choose. Delivery is ${rs(STORE.shipFee)}, and free on orders over ${rs(STORE.freeShip)}.</p>
    </div>
  </div></section>

  <section class="wrap"><div class="news rv">
    <div><span class="eyebrow">New here?</span><h2 style="margin-top:8px">10% off your first order</h2><p style="color:var(--muted);margin-top:6px">Use the code at checkout. Join our WhatsApp list for restock and new-launch alerts.</p></div>
    <div class="news-act"><button class="codebox" data-copy="WELCOME10" type="button"><span>WELCOME10</span><small>Copy code</small></button><a class="btn wa" href="#" data-wa-join>Join on WhatsApp</a></div>
  </div></section>`;
}
function trendList(k){return P.filter(p=>(k==="all"||p.cat===k)&&p.stock).slice(k==="all"?20:0).slice(0,8)}
function afterHome(){
  const tr=$("#trend");
  const fill=k=>{tr.classList.add("swap");setTimeout(()=>{tr.innerHTML=trendList(k).map(p=>card(p)).join("");decorateCards(tr);tr.classList.remove("swap");reveal(tr,true);scrollMotion()},220)};
  $$("[data-tab]").forEach(b=>b.onclick=()=>{$$("[data-tab]").forEach(x=>x.classList.toggle("on",x===b));fill(b.dataset.tab)});
  heroMotion(); counters(); bannerSlider();
}

let shopState={};
function shopFilter(st){
  let r=P.filter(p=>(!st.cats.length||st.cats.includes(p.cat))&&(!st.brands.length||st.brands.includes(p.brand))&&(!st.max||p.price<st.max)&&(!st.stock||p.stock)&&(!st.sale||off(p)>=10));
  const s=st.sort;
  return [...r].sort((a,b)=>s==="low"?a.price-b.price:s==="high"?b.price-a.price:s==="off"?off(b)-off(a):s==="az"?a.name.localeCompare(b.name):(b.stock-a.stock));
}
function vShop(o={}){
  shopState={cats:o.cat?[o.cat]:[],brands:o.brand?[o.brand]:[],max:0,sort:o.sale?"off":"featured",stock:!!o.sale,sale:!!o.sale};
  const c=catOf(o.cat);
  const title=o.sale?"Offers":o.brand?o.brand:c?c.n:"Shop all";
  const sub=o.sale?"Genuine price drops on selected products. No inflated “was” prices.":o.brand?`${BRAND_COUNT[o.brand]} ${esc(o.brand)} products with Cash on Delivery across Pakistan.`:c?CAT_INTRO[c.k]:"Every product, every brand, in one place.";
  const bl=Object.keys(BRAND_COUNT).filter(b=>b!=="Essentials").sort((a,b)=>BRAND_COUNT[b]-BRAND_COUNT[a]).slice(0,40).sort();
  if(o.brand&&!bl.includes(o.brand)) bl.unshift(o.brand);
  const first=shopFilter(shopState).slice(0,24);
  return `<div class="wrap">
    ${crumbs(o.brand?[["Brands",U.shop()],[esc(o.brand)]]:[[title]])}
    <div class="shop-head"><h1 data-split>${esc(title)}${o.brand?` <em>in Pakistan</em>`:""}</h1><p class="ld" style="--d:300ms">${sub}</p></div>
    <div class="shop-bar"><button class="btn ghost fbtn" style="height:40px;padding:0 16px" id="openF">Filters</button><span class="count" id="count"></span>
      <label for="sort" class="sr">Sort</label><select class="sel" id="sort">${[["featured","Featured"],["off","Best offers"],["low","Price: low to high"],["high","Price: high to low"],["az","Name: A–Z"]].map(([v,n])=>`<option value="${v}" ${shopState.sort===v?"selected":""}>${n}</option>`).join("")}</select></div>
    <div class="shop-layout">
      <aside class="filters" id="filters">
        <div class="fbtn fhead"><h3 style="font-size:26px">Filters</h3><button class="ib" id="closeF" aria-label="Close filters">✕</button></div>
        <div class="fgroup"><h6>Category</h6>${CATS.map(x=>`<label><input type="checkbox" name="cat" value="${x.k}" ${x.k===o.cat?"checked":""}>${x.n}</label>`).join("")}</div>
        <div class="fgroup"><h6>Price</h6>${[[0,"Any price"],[3000,"Under Rs 3,000"],[5000,"Under Rs 5,000"],[10000,"Under Rs 10,000"]].map(([v,n])=>`<label><input type="radio" name="max" value="${v}" ${v===0?"checked":""}>${n}</label>`).join("")}</div>
        <div class="fgroup"><h6>Availability</h6><label><input type="checkbox" id="instock" ${shopState.stock?"checked":""}>In stock only</label><label><input type="checkbox" id="onsale" ${shopState.sale?"checked":""}>On offer</label></div>
        <div class="fgroup"><h6>Brand</h6><div style="max-height:260px;overflow:auto">${bl.map(b=>`<label><input type="checkbox" name="brand" value="${esc(b)}" ${shopState.brands.includes(b)?"checked":""}>${esc(b)}</label>`).join("")}</div></div>
        <button class="btn primary fbtn" id="applyF">Show results</button>
      </aside>
      <div><div class="grid" id="sgrid">${first.map(p=>card(p)).join("")}</div><div class="morewrap"><p class="m" id="moreTxt"></p><button class="btn ghost" id="more" hidden>Load more products</button></div></div>
    </div>
    ${c?`<div class="cat-brands"><h2>Popular ${esc(c.n.toLowerCase())} brands</h2><div>${topBrands(c.k,10).filter(b=>BRANDS.includes(b)).map(b=>`<a class="tab" href="${U.brand(b)}">${esc(b)}</a>`).join("")}</div></div>`:""}
    </div>`;
}
function afterShop(){
  const f=$("#filters");
  const apply=(initial)=>{
    shopState.cats=$$('input[name=cat]:checked',f).map(i=>i.value);
    shopState.brands=$$('input[name=brand]:checked',f).map(i=>i.value);
    shopState.max=+($('input[name=max]:checked',f)||{}).value||0;
    shopState.stock=$("#instock").checked; shopState.sale=$("#onsale").checked; shopState.sort=$("#sort").value;
    const r=shopFilter(shopState);
    const g=$("#sgrid"); $("#count").textContent=`${r.length} product${r.length===1?"":"s"}`;
    let shown=0; const PAGE=24, more=$("#more");
    const page=()=>{const chunk=r.slice(shown,shown+PAGE);shown+=chunk.length;const tmp=document.createElement("div");tmp.innerHTML=chunk.map(p=>card(p)).join("");decorateCards(tmp);[...tmp.children].forEach((c,i)=>{c.style.setProperty("--d",(i%12)*45+"ms");g.appendChild(c)});reveal(g);scrollMotion();more.hidden=shown>=r.length;$("#moreTxt").textContent=`Showing ${shown} of ${r.length}`};
    if(initial===true){shown=Math.min(PAGE,r.length);more.hidden=shown>=r.length;$("#moreTxt").textContent=r.length?`Showing ${shown} of ${r.length}`:"";more.onclick=page;return}
    g.innerHTML=r.length?"":`<div class="empty" style="grid-column:1/-1"><h3>No products match</h3><p>Try removing a filter.</p></div>`;
    more.hidden=true; if(r.length)page(); more.onclick=page;
  };
  f.addEventListener("change",()=>apply()); $("#sort").onchange=()=>apply();
  $("#openF").onclick=()=>f.classList.add("open"); $("#closeF").onclick=$("#applyF").onclick=()=>f.classList.remove("open");
  apply(true);
  track("view_item_list",{item_list_name:document.title,items:shopFilter(shopState).slice(0,12).map(p=>gItem(p))});
}

let pdQty=1;
const USE={perfume:"Spray on pulse points: wrists, neck and behind the ears, from 15 cm away. Do not rub.",body:"Massage generously into clean skin, focusing on dry areas. Use daily after a shower.",skincare:"Apply a small amount to clean, dry skin morning and night. Follow with sunscreen in the day.",makeup:"Dot onto skin and blend with fingertips, a brush or a damp sponge. Build up for more intensity.",korean:"After cleansing, pat a few drops into skin until absorbed. Follow with moisturiser and SPF.",hair:"Apply to damp or dry hair from mid-lengths to ends. Style as usual.",tools:"Follow the instructions in the box. Clean after each use."};
function deliveryText(){
  if(SSR) return `Delivered in <b>3–5 working days</b>`;
  const add=n=>{const d=new Date();while(n>0){d.setDate(d.getDate()+1);if(d.getDay()!==0)n--}return d};
  const d1=add(3), d2=add(5);
  const fmt=d=>d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
  return `Order now, get it between <b>${fmt(d1)}</b> and <b>${fmt(d2)}</b>`;
}
function vProduct(p){
  pdQty=1;
  const o=off(p), c=catOf(p.cat);
  const rel=P.filter(x=>x.cat===p.cat&&x.slug!==p.slug&&x.stock).sort((a,b)=>(b.brand===p.brand)-(a.brand===p.brand)).slice(0,4);
  const t=totals();
  return `<div class="wrap">
    ${crumbs([[c.n,U.shop(p.cat)],...(BRANDS.includes(p.brand)?[[esc(p.brand),U.brand(p.brand)]]:[]),[esc(p.name)]])}
    <div class="pd">
      <div class="gallery"><div class="gmain rv clip" id="gmain">${pic(p,1)}${o>=10&&p.stock?`<span class="off" style="font-size:13px">−${o}%</span>`:""}</div></div>
      <div class="pinfo">
        <a class="brand ld" style="--d:60ms" href="${BRANDS.includes(p.brand)?U.brand(p.brand):U.shop(p.cat)}">${esc(p.brand)}</a>
        <h1 class="ld" style="--d:120ms">${esc(p.name)}</h1>
        <div class="price num ld" style="--d:200ms"><span class="now">${rs(p.price)}</span>${o>=10?`<span class="was">${rs(p.compare)}</span><span class="save">Save ${rs(p.compare-p.price)}</span>`:""}</div>
        <div class="pmeta ld" style="--d:260ms"><span class="pill ${p.stock?"":"out"}">${p.stock?"In stock, ready to ship":"Sold out"}</span><span style="font-size:13px;color:var(--muted)">Price includes tax</span></div>
        <p class="pdesc ld" style="--d:320ms">${esc(p.desc)}</p>${p.shades?`<p class="shnote">Available in <b>${p.shades} shades</b>. Mention your shade in the order note or on WhatsApp.</p>`:""}
        <div class="buy ld" style="--d:380ms">
          ${p.stock?`<div class="row"><div class="qty"><button data-q="-1" aria-label="Decrease">−</button><span id="pq">1</span><button data-q="1" aria-label="Increase">+</button></div><button class="btn primary" data-addq="${p.slug}">Add to bag · <span id="pt" class="num">${rs(p.price)}</span></button></div>
          <button class="btn rose block" data-buynow="${p.slug}">Buy now · Cash on Delivery</button>
          <a class="btn wa block" href="#" data-wa-p="${p.slug}">Order on WhatsApp</a>`:`<button class="btn primary block" data-notify="${p.slug}">Notify me when available</button>`}
        </div>
        <div class="ship-box ld" style="--d:440ms">
          <div class="line">${icon.cal}<span id="dlv">${deliveryText()}</span></div>
          <div class="line">${icon.cash}<span>Cash on Delivery available all over Pakistan</span></div>
          <div class="line">${icon.ret}<span>Easy 5-day returns on damaged or wrong items</span></div>
          <div class="prog"><span>${t.left?`Add <b class="num">${rs(t.left)}</b> more to your bag for free delivery`:`<b style="color:var(--ok)">Your bag qualifies for free delivery</b>`}</span><div class="bar"><i style="width:${t.pct}%"></i></div></div>
        </div>
        <div class="acc">
          <details open><summary>Description</summary><p>${esc(p.desc)}</p></details>
          <details><summary>How to use</summary><p>${USE[p.cat]}</p></details>
          <details><summary>Delivery &amp; returns</summary><ul><li>Dispatched within 24 hours</li><li>Delivered in 3–5 working days</li><li>Delivery ${rs(STORE.shipFee)}, free over ${rs(STORE.freeShip)}</li><li>Report damaged or wrong items within 5 days</li></ul></details>
        </div>
        <button class="btn ghost" style="margin-top:18px;height:42px" data-wbig="${p.slug}">${wish.includes(p.slug)?"♥ Saved":"♡ Save to wishlist"}</button>
      </div>
    </div>
    ${rel.length?`<section class="sec"><div class="sec-head"><h2 data-split>You may <em>also love</em></h2></div><div class="grid">${rel.map(x=>card(x)).join("")}</div></section>`:""}
  </div>
  ${p.stock?`<div class="sticky-buy" id="stickyBuy"><div class="wrap"><span class="sb-n">${esc(p.name)}</span><b class="num">${rs(p.price)}</b><button class="btn rose" data-buynow="${p.slug}">Buy now</button></div></div>`:""}`;
}
function afterProduct(p){
  $$("[data-q]").forEach(b=>b.onclick=()=>{pdQty=Math.max(1,Math.min(10,pdQty+ +b.dataset.q));$("#pq").textContent=pdQty;$("#pt").textContent=rs(p.price*pdQty)});
  const d=$("#dlv"); if(d) d.innerHTML=deliveryText();
  const sb=$("#stickyBuy"), buy=$(".buy");
  if(sb&&buy&&"IntersectionObserver" in G){new IntersectionObserver(([e])=>sb.classList.toggle("on",!e.isIntersecting&&e.boundingClientRect.top<0)).observe(buy)}
  track("view_item",{value:p.price,items:[gItem(p)]});
}

function vWish(){
  const items=wish.map(bySlug).filter(Boolean);
  return `<div class="wrap">${crumbs([["Wishlist"]])}
  <div class="shop-head" style="margin-bottom:24px"><h1>Your wishlist</h1><p>${items.length} saved item${items.length===1?"":"s"}</p></div>
  ${items.length?`<div class="grid">${items.map(p=>card(p)).join("")}</div>`:`<div class="empty"><h3>Nothing saved yet</h3><p>Tap the heart on any product to save it here.</p><a class="btn primary" style="margin-top:18px" href="${U.shop()}">Start shopping</a></div>`}</div>`;
}

const CITIES=["Lahore","Karachi","Islamabad","Rawalpindi","Faisalabad","Multan","Gujranwala","Sialkot","Peshawar","Quetta","Hyderabad","Bahawalpur","Sargodha","Sukkur","Abbottabad","Other"];
function vCheckout(){
  if(SSR||!cart.length) return `<div class="wrap"><div class="empty"><h3>Your bag is empty</h3><p>Add a few favourites before checking out.</p><a class="btn primary" style="margin-top:18px" href="${U.shop()}">Shop now</a></div></div>`;
  return `<div class="wrap">${crumbs([["Checkout"]])}
  <div class="co">
    <form id="coForm" novalidate>
      <h1>Checkout</h1>
      <h2>Delivery details</h2>
      <div class="fields">
        <div class="fld full" data-f><label for="cname">Full name</label><input id="cname" autocomplete="name" required><span class="err">Please enter your name</span></div>
        <div class="fld" data-f><label for="cphone">Mobile number</label><input id="cphone" inputmode="tel" placeholder="03XX XXXXXXX" autocomplete="tel" required pattern="^(\\+92|0)3\\d{2}[\\s\\-]?\\d{7}$"><span class="err">Enter a valid number, e.g. 0300 1234567</span></div>
        <div class="fld" data-f><label for="ccity">City</label><select id="ccity" required><option value="">Select city</option>${CITIES.map(c=>`<option>${c}</option>`).join("")}</select><span class="err">Please select your city</span></div>
        <div class="fld full" data-f><label for="caddr">Complete address</label><textarea id="caddr" rows="2" placeholder="House no, street, area, landmark" required></textarea><span class="err">Please enter your address</span></div>
        <div class="fld full"><label for="cemail">Email (optional, for order updates)</label><input id="cemail" type="email" autocomplete="email"></div>
        <div class="fld full"><label for="cnote">Order note (optional: shade, gift message)</label><input id="cnote"></div>
      </div>
      <h2>Payment</h2>
      <div class="pays">
        <label class="payopt"><input type="radio" name="pay" value="cod" checked><span><b>Cash on Delivery</b><small>Pay in cash when your order arrives</small></span></label>
        <label class="payopt"><input type="radio" name="pay" value="wallet"><span><b>JazzCash / Easypaisa</b><small>We'll send payment details on WhatsApp</small></span></label>
        <label class="payopt"><input type="radio" name="pay" value="bank"><span><b>Bank transfer</b><small>We'll send account details on WhatsApp</small></span></label>
      </div>
      <button class="btn rose block" style="margin-top:22px;height:54px;font-size:16px" id="placeBtn">Place order</button>
      <p class="m" style="font-size:12.5px;margin-top:10px">By placing an order you agree to our <a href="/terms/" style="text-decoration:underline">terms</a> and <a href="/returns-refunds/" style="text-decoration:underline">returns policy</a>.</p>
    </form>
    <aside class="summary" id="coSum"></aside>
  </div></div>`;
}
function summaryHTML(){
  const t=totals();
  return `<h3 style="font-size:22px;font-weight:600">Order summary</h3>
  ${cart.map(i=>{const p=bySlug(i.s);return `<div class="li" style="grid-template-columns:56px 1fr auto"><div class="art">${pic(p)}</div><div><div class="nm">${esc(p.name)}</div><div class="sm">Qty ${i.q}</div></div><b class="num" style="font-size:13.5px">${rs(p.price*i.q)}</b></div>`}).join("")}
  <div style="border-top:1px solid var(--line);padding-top:12px;display:grid;gap:8px">
  <div class="tot num"><span>Subtotal</span><span>${rs(t.sub)}</span></div>
  ${t.disc?`<div class="tot num" style="color:var(--ok)"><span>Discount (${coupon})</span><span>−${rs(t.disc)}</span></div>`:""}
  <div class="tot num"><span>Delivery</span><span>${t.ship?rs(t.ship):"Free"}</span></div>
  <div class="tot big num"><span>Total</span><span>${rs(t.total)}</span></div></div>`;
}
function orderText(o){
  return `New order #${o.no}\n${o.items.map(i=>`• ${i.name} x ${i.q} = ${rs(i.price*i.q)}`).join("\n")}\nSubtotal: ${rs(o.sub)}${o.disc?`\nDiscount (${o.coupon}): -${rs(o.disc)}`:""}\nDelivery: ${o.ship?rs(o.ship):"Free"}\nTotal: ${rs(o.total)}\nPayment: ${{cod:"Cash on Delivery",wallet:"JazzCash/Easypaisa",bank:"Bank transfer"}[o.pay]}\n\nName: ${o.name}\nPhone: ${o.phone}\nCity: ${o.city}\nAddress: ${o.address}${o.note?`\nNote: ${o.note}`:""}`;
}
function afterCheckout(){
  if(!$("#coForm")) return;
  $("#coSum").innerHTML=summaryHTML();
  track("begin_checkout",{value:totals().total,items:cart.map(i=>gItem(bySlug(i.s),i.q))});
  $("#coForm").onsubmit=e=>{
    e.preventDefault(); let ok=true;
    $$("[data-f]").forEach(f=>{const i=$("input,select,textarea",f);const bad=!i.checkValidity()||!i.value.trim();f.classList.toggle("bad",bad);if(bad)ok=false});
    if(!ok){$(".fld.bad input,.fld.bad select,.fld.bad textarea").focus();return}
    const t=totals(); const no="VB"+String(Date.now()).slice(-7);
    const o={no,name:$("#cname").value.trim(),phone:$("#cphone").value.trim(),city:$("#ccity").value,address:$("#caddr").value.trim(),email:$("#cemail").value.trim(),note:$("#cnote").value.trim(),pay:$('input[name=pay]:checked').value,coupon,
      items:cart.map(i=>{const p=bySlug(i.s);return {slug:p.slug,name:p.name,price:p.price,q:i.q}}),...t,at:new Date().toISOString(),tracked:false};
    store.set("last",o);
    if(CFG.orderEndpoint){try{fetch(CFG.orderEndpoint,{method:"POST",mode:"no-cors",keepalive:true,headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(o)})}catch(err){}}
    cart=[];coupon=null;saveCart(); go("/order-placed/");
  };
  $$("[data-f] input,[data-f] select,[data-f] textarea").forEach(i=>i.addEventListener("input",()=>i.closest("[data-f]").classList.remove("bad")));
}
function vDone(){
  const o=SSR?null:store.get("last",null);
  return `<div class="wrap done">
    <div class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
    <h1>Thank you${o?", "+esc(o.name.split(" ")[0]):""}!</h1>
    ${o?`<p style="color:var(--muted);max-width:32em">Order <b>#${o.no}</b> for <b class="num">${rs(o.total)}</b>${o.pay==="cod"?" (payable on delivery)":""} has been received.</p>
    ${CFG.orderEndpoint?`<p style="color:var(--muted);max-width:32em">We'll call you on <b>${esc(o.phone)}</b> to confirm, then ship to ${esc(o.city)} within 24 hours. For faster confirmation, send it on WhatsApp too.</p>`:`<p style="max-width:32em"><b>Final step:</b> tap below to send your order to us on WhatsApp. We confirm every order there before dispatch.</p>`}
    <a class="btn wa" href="#" data-wa-order style="min-width:280px">Confirm order on WhatsApp</a>`:`<p style="color:var(--muted)">Your order has been received.</p>`}
    <a class="btn ghost" href="${U.shop()}">Continue shopping</a>
  </div>`;
}
function afterDone(){
  const o=store.get("last",null); if(!o||o.tracked) return;
  const items=o.items.map(i=>({item_id:i.slug,item_name:i.name,price:i.price,quantity:i.q}));
  if(G.gtag){ const ud={}; if(o.email)ud.email=o.email.toLowerCase(); if(o.phone)ud.phone_number="+92"+o.phone.replace(/\D/g,"").replace(/^(92|0)/,""); gtag("set","user_data",ud) }
  track("purchase",{transaction_id:o.no,value:o.total,shipping:o.ship,coupon:o.coupon||undefined,items});
  adsConversion(CFG.adsPurchaseLabel,{value:o.total,transaction_id:o.no});
  o.tracked=true; store.set("last",o);
}

/* ---------- info pages ---------- */
function contactBlock(){
  return `<div class="contact-card">
    <div><b>WhatsApp</b><a href="#" data-wa>+${STORE.wa.replace(/^92/,"92 ")}</a></div>
    ${STORE.phone?`<div><b>Phone</b><a href="tel:${esc(STORE.phone.replace(/\s/g,""))}">${esc(STORE.phone)}</a></div>`:""}
    ${STORE.email?`<div><b>Email</b><a href="mailto:${esc(STORE.email)}">${esc(STORE.email)}</a></div>`:""}
    <div><b>Address</b><span>${esc(STORE.address)}</span></div>
    <div><b>Hours</b><span>${esc(STORE.hours)}</span></div>
  </div>`;
}
const PAGES={
  "about":{t:"About us",d:`${STORE.name} is an online beauty store in Pakistan for skincare, Korean beauty, makeup, perfumes and hair care, with Cash on Delivery nationwide.`,b:()=>`
    <p>${esc(STORE.name)} started with a simple idea: make the skincare and beauty products people actually use easy to buy in Pakistan, without the guesswork.</p>
    <p>We stock ${P.length}+ products across skincare, Korean beauty, makeup, fragrance, body and hair care. Every order is checked by hand before it leaves us, packed securely, and delivered in 3–5 working days with Cash on Delivery available in every city we serve.</p>
    <p>If something isn't right, a real person answers on WhatsApp. That's our promise.</p>${contactBlock()}`},
  "contact":{t:"Contact us",d:`Contact ${STORE.name} on WhatsApp, phone or email. Order help, product advice, returns and delivery questions.`,b:()=>`<p>Questions about an order, a product or a return? Message us and we'll reply during business hours.</p>${contactBlock()}`},
  "shipping-policy":{t:"Shipping policy",d:`Delivery times and charges for ${STORE.name} orders across Pakistan.`,b:()=>`
    <h3>Delivery time</h3><p>Orders are dispatched within 24 hours (excluding Sundays and public holidays) and delivered in 3–5 working days across Pakistan. Remote areas may take longer.</p>
    <h3>Delivery charges</h3><p>Delivery is ${rs(STORE.shipFee)} per order and free on orders over ${rs(STORE.freeShip)} after discounts.</p>
    <h3>Cash on Delivery</h3><p>Available in every city we deliver to. Please keep the exact amount ready. We confirm every order by phone or WhatsApp before dispatch.</p>
    <h3>Tracking</h3><p>Once shipped, we send your courier tracking number on WhatsApp or SMS.</p>`},
  "returns-refunds":{t:"Returns & refunds",d:`Return and refund policy for ${STORE.name}: report damaged or wrong items within 5 days for a replacement or refund.`,b:()=>`
    <h3>Damaged, leaking or wrong items</h3><p>Contact us on WhatsApp within 5 days of delivery with your order number and a photo or unboxing video. We'll arrange a replacement or a full refund, including delivery charges.</p>
    <h3>Change of mind</h3><p>For hygiene reasons, opened or used beauty products can't be returned. Unopened products in original sealed packaging can be returned within 5 days; return delivery is paid by the customer.</p>
    <h3>Refunds</h3><p>Approved refunds are sent by bank transfer, JazzCash or Easypaisa within 5 working days of receiving the return.</p>`},
  "privacy-policy":{t:"Privacy policy",d:`How ${STORE.name} collects, uses and protects your personal information.`,b:()=>`
    <h3>What we collect</h3><p>When you place an order we collect your name, phone number, delivery address and, optionally, your email. We use these only to process, deliver and support your order.</p>
    <h3>Cookies and analytics</h3><p>We use cookies and similar technologies, including Google Analytics and Google Ads, to understand how our site is used and to measure our advertising. These services may collect information such as pages visited and device type. You can opt out of personalised Google ads at adssettings.google.com.</p>
    <h3>Sharing</h3><p>We share your delivery details only with our courier partners to deliver your order. We never sell your information.</p>
    <h3>Your choices</h3><p>You can ask us to update or delete your information at any time by contacting us.</p>${contactBlock()}`},
  "terms":{t:"Terms of service",d:`Terms and conditions for shopping at ${STORE.name}.`,b:()=>`
    <h3>Orders</h3><p>All orders are subject to confirmation and availability. We may contact you to confirm an order before dispatch and may cancel orders we cannot verify.</p>
    <h3>Prices</h3><p>Prices are in Pakistani Rupees (PKR) and include applicable taxes. Delivery charges are shown at checkout. Where a previous price is shown, it is the price at which the product was sold on this site before the current offer.</p>
    <h3>Product information</h3><p>We try to show products as accurately as possible. Packaging may vary slightly from photos as brands update their designs.</p>
    <h3>Returns</h3><p>Please see our <a href="/returns-refunds/" style="text-decoration:underline">returns &amp; refunds policy</a>.</p>${contactBlock()}`},
  "track-order":{t:"Track your order",d:`Track your ${STORE.name} order.`,b:()=>`<p>Enter your order number and we'll send you the latest status on WhatsApp.</p><form id="trk" style="display:grid;gap:10px;max-width:420px"><div class="fld"><label for="tno">Order number</label><input id="tno" placeholder="e.g. VB1234567" required></div><button class="btn primary">Get status on WhatsApp</button></form>`}
};
function vInfo(k){const pg=PAGES[k];return `<div class="wrap info-page">${crumbs([[pg.t]])}<div class="shop-head"><h1 data-split>${pg.t}</h1></div><div class="prose ld" style="--d:200ms">${pg.b()}</div></div>`}
function v404(){return `<div class="wrap done"><h1>Page not found</h1><p style="color:var(--muted)">The page you're looking for has moved or doesn't exist.</p><a class="btn primary" href="/">Back to home</a></div>`}

/* ---------- router ---------- */
function parse(path){
  const seg=String(path).replace(/index\.html$/,"").replace(/^\/+|\/+$/g,"").split("/").filter(Boolean);
  const [a,b]=seg;
  if(!a) return {name:"home"};
  if(a==="shop"&&!b) return {name:"shop"};
  if(a==="shop"&&catOf(b)&&seg.length===2) return {name:"cat",cat:b};
  if(a==="sale"&&!b) return {name:"sale"};
  if(a==="brand"&&brandBySlug(b)) return {name:"brand",brand:brandBySlug(b)};
  if(a==="product"&&bySlug(b)) return {name:"product",p:bySlug(b)};
  if(["wishlist","checkout","order-placed","banners"].includes(a)&&!b) return {name:a};
  if(PAGES[a]&&!b) return {name:"info",k:a};
  return {name:"404"};
}
function meta(r){
  const n=STORE.name;
  switch(r.name){
    case "home": return {title:`${n} | Skincare, Korean Beauty, Makeup & Perfumes in Pakistan`,desc:`Shop ${P.length}+ skincare, Korean beauty, makeup, perfume and hair care products online in Pakistan. Cash on Delivery nationwide, delivery in 3–5 days.`};
    case "shop": return {title:`Shop All Beauty Products in Pakistan | ${n}`,desc:`Browse ${P.length}+ beauty products: skincare, Korean skincare, makeup, perfumes, body and hair care. Cash on Delivery across Pakistan.`};
    case "sale": return {title:`Beauty Offers & Price Drops in Pakistan | ${n}`,desc:`Current offers on skincare, makeup and fragrance. Genuine price drops with Cash on Delivery across Pakistan.`};
    case "cat": {const c=catOf(r.cat);return {title:`${c.n} in Pakistan – ${topBrands(r.cat,3).join(", ")} | ${n}`,desc:`${CAT_INTRO[r.cat]} Cash on Delivery nationwide.`.slice(0,300)}}
    case "brand": return {title:`${r.brand} Price in Pakistan – ${BRAND_COUNT[r.brand]} Products | ${n}`,desc:`Buy ${r.brand} products online in Pakistan at ${n}. ${BRAND_COUNT[r.brand]} products with Cash on Delivery and 3–5 day delivery.`};
    case "product": {const p=r.p;return {title:`${p.name} Price in Pakistan | ${n}`,desc:`Buy ${p.name} in Pakistan for ${rs(p.price)}. ${p.stock?"In stock. ":""}Cash on Delivery nationwide, delivered in 3–5 working days.`}}
    case "info": return {title:`${PAGES[r.k].t} | ${n}`,desc:PAGES[r.k].d};
    case "wishlist": return {title:`Wishlist | ${n}`,desc:"",noindex:true};
    case "checkout": return {title:`Checkout | ${n}`,desc:"",noindex:true};
    case "order-placed": return {title:`Order received | ${n}`,desc:"",noindex:true};
    case "banners": return {title:`Banner options | ${n}`,desc:"",noindex:true};
    default: return {title:`Page not found | ${n}`,desc:"",noindex:true};
  }
}
function view(r){
  switch(r.name){
    case "home": return [vHome(),afterHome];
    case "shop": return [vShop(),afterShop];
    case "sale": return [vShop({sale:true}),afterShop];
    case "cat": return [vShop({cat:r.cat}),afterShop];
    case "brand": return [vShop({brand:r.brand}),afterShop];
    case "product": return [vProduct(r.p),()=>afterProduct(r.p)];
    case "wishlist": return [vWish(),null];
    case "checkout": return [vCheckout(),afterCheckout];
    case "order-placed": return [vDone(),afterDone];
    case "banners": return [vBannerGallery(),null];
    case "info": return [vInfo(r.k),r.k==="track-order"?()=>{$("#trk").onsubmit=e=>{e.preventDefault();const n=$("#tno").value.trim();if(!n)return;waOpen(`Hi! Please share the status of my order #${n}.`)}}:null];
    default: return [v404(),null];
  }
}
function navActive(path){
  $$("nav.main a").forEach(a=>a.classList.toggle("on",a.getAttribute("href")===path));
  $$(".bnav [data-bn]").forEach(a=>{const k=a.dataset.bn;a.classList.toggle("on",(k==="home"&&path==="/")||(k==="shop"&&/^\/(shop|sale|brand)/.test(path))||(k==="wishlist"&&path==="/wishlist/"))});
}
function route(first){
  const path=curPath().replace(/index\.html$/,""); const r=parse(path); const v=$("#view");
  const [html,after]=view(r);
  const m=meta(r); document.title=m.title;
  const md=$('meta[name="description"]'); if(md&&m.desc) md.setAttribute("content",m.desc);
  const reuse=!PV&&first&&v.dataset.pre===path&&!["wishlist","checkout","order-placed"].includes(r.name);
  if(!reuse){ v.innerHTML=html; v.dataset.pre=path; }
  decorateCards(v); splitAll(v); reveal(v);
  if(!first){ v.classList.remove("enter");void v.offsetWidth;v.classList.add("enter"); }
  after&&after();
  navActive(path);
  scrollMotion(v);
}
function go(href,replace){
  if(PV){closePanels();closeModal();if(location.hash.slice(1)===href)route();else location.hash=href;return}
  if(replace) history.replaceState({},"",href); else history.pushState({},"",href);
  closePanels(); closeModal();
  const v=$("#view");
  if(matchMedia("(prefers-reduced-motion:reduce)").matches){window.scrollTo(0,0);route();return}
  v.classList.add("leave");
  setTimeout(()=>{window.scrollTo({top:0,behavior:"instant"});v.classList.remove("leave");route()},180);
}

/* ---------- motion ---------- */
let io;
function reveal(root,force){
  if(!("IntersectionObserver" in G)){ $$(".rv,[data-split]",root).forEach(e=>e.classList.add("in")); return }
  io=io||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{rootMargin:"0px 0px -8% 0px",threshold:.08});
  $$(".grid,.rail",root).forEach(g=>[...g.children].forEach((c,i)=>{if(!c.style.getPropertyValue("--d"))c.style.setProperty("--d",(i%4)*80+"ms")}));
  $$(".rv,[data-split]",root).forEach(el=>{ if(force) el.classList.remove("in"); if(!el.classList.contains("in")) io.observe(el) });
}
function splitAll(root){
  $$("[data-split]",root).forEach(el=>{
    if(el.dataset.done) return; el.dataset.done=1; let i=0;
    const walk=n=>{[...n.childNodes].forEach(c=>{
      if(c.nodeType===3){const parts=c.textContent.split(/(\s+)/);const f=document.createDocumentFragment();parts.forEach(t=>{if(!t)return;if(/^\s+$/.test(t)){f.appendChild(document.createTextNode(t));return}const w=document.createElement("span");w.className="w";const s=document.createElement("span");s.textContent=t;s.style.setProperty("--i",i++);w.appendChild(s);f.appendChild(w)});c.replaceWith(f)}
      else if(c.nodeType===1&&!c.classList.contains("w")) walk(c);
    })};
    walk(el);
  });
}
function heroMotion(){
  const st=$("#stage"); if(!st) return;
  requestAnimationFrame(()=>document.body.classList.add("loaded"));
  if(matchMedia("(prefers-reduced-motion:reduce)").matches||!matchMedia("(hover:hover)").matches) return;
  const fl=$$("[data-depth]",st); let tx=0,ty=0,cx=0,cy=0,raf;
  const loop=()=>{cx+=(tx-cx)*.08;cy+=(ty-cy)*.08;fl.forEach(f=>{const d=+f.dataset.depth;f.style.translate=`${cx*d}px ${cy*d}px`});if(Math.abs(tx-cx)>.001||Math.abs(ty-cy)>.001)raf=requestAnimationFrame(loop);else raf=null};
  $(".hero").onpointermove=e=>{const r=st.getBoundingClientRect();tx=(e.clientX-r.left-r.width/2)/r.width;ty=(e.clientY-r.top-r.height/2)/r.height;if(!raf)raf=requestAnimationFrame(loop)};
  $(".hero").onpointerleave=()=>{tx=ty=0;if(!raf)raf=requestAnimationFrame(loop)};
}
function counters(){
  $$("[data-count]").forEach(el=>{
    const end=+el.dataset.count, suf=el.dataset.suffix||"";
    if(matchMedia("(prefers-reduced-motion:reduce)").matches||!("IntersectionObserver" in G)) return;
    el.textContent="0"+suf;
    const ob=new IntersectionObserver(([e])=>{if(!e.isIntersecting)return;ob.disconnect();const t0=performance.now(),D=1400;
      const step=t=>{const k=Math.min(1,(t-t0)/D),v=Math.round(end*(1-Math.pow(1-k,3)));el.textContent=v.toLocaleString("en-PK")+suf;if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)},{threshold:.6});
    ob.observe(el);
  });
}
function scrollFx(){
  const hd=$("#top"), bar=$("#progress"); let last=scrollY, ticking=false;
  const upd=()=>{
    const y=scrollY, max=document.documentElement.scrollHeight-innerHeight;
    hd.classList.toggle("scrolled",y>10);
    hd.classList.toggle("hide",y>last&&y>420&&!document.body.style.overflow);
    last=y; if(bar) bar.style.transform=`scaleX(${max>0?y/max:0})`;
    ticking=false;
  };
  addEventListener("scroll",()=>{if(!ticking){ticking=true;requestAnimationFrame(upd)}},{passive:true}); upd();
}


/* scroll-linked motion: elements keep moving while the page scrolls */
let spItems=[], spTick=false;
function scrollMotion(root){
  if(matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  spItems=[];
  $$("[data-sp]").forEach(el=>spItems.push({el,k:el.dataset.sp,amt:+el.dataset.amt||0,dir:+el.dataset.dir||1}));
  $$(".sec-head h2").forEach((el,i)=>spItems.push({el,k:"x",amt:i%2?40:-40}));
  $$(".rail").forEach(el=>spItems.push({el,k:"x",amt:-90}));
  $$(".cat .disc").forEach((el,i)=>spItems.push({el,k:"rot",amt:i%2?14:-14}));
  $$(".grid").forEach(g=>{const cols=getComputedStyle(g).gridTemplateColumns.split(" ").length||1;[...g.children].forEach((c,i)=>{const col=i%cols;if(cols>1&&col%2===1)spItems.push({el:c,k:"y",amt:-46})})});
  $$(".stats-in>div").forEach((el,i)=>spItems.push({el,k:"y",amt:(i%2?-1:1)*18}));
  $$(".step").forEach((el,i)=>spItems.push({el,k:"y",amt:[-20,20,-20,20][i%4]}));
  spRun();
}
function spRun(){
  const vh=innerHeight, y=scrollY;
  for(const it of spItems){
    const el=it.el; if(!el.isConnected) continue;
    if(it.k==="hero-stage"){ if(y<vh*1.2) el.style.translate=`0 ${y*.28}px`; continue }
    if(it.k==="hero-copy"){ if(y<vh*1.2){el.style.translate=`0 ${y*.12}px`;el.style.opacity=Math.max(0,1-y/(vh*.85))} continue }
    const r=el.getBoundingClientRect(); if(r.bottom<-200||r.top>vh+200) continue;
    const p=Math.max(-1.2,Math.min(1.2,((r.top+r.height/2)-vh/2)/vh));
    if(it.k==="y") el.style.translate=`0 ${p*it.amt}px`;
    else if(it.k==="x") el.style.translate=`${p*it.amt}px 0`;
    else if(it.k==="rot") el.style.rotate=`${p*it.amt}deg`;
    else if(it.k==="mq") el.style.translate=`${(p*it.dir*28)-(it.dir>0?30:0)}% 0`;
  }
  spTick=false;
}
function spInit(){ addEventListener("scroll",()=>{if(!spTick){spTick=true;requestAnimationFrame(spRun)}},{passive:true}); addEventListener("resize",()=>scrollMotion()) }

/* ---------- cart drawer ---------- */
function renderCart(){
  const b=$("#cartBody"),f=$("#cartFoot"),t=totals();
  if(!cart.length){b.innerHTML=`<div class="empty"><h3>Your bag is empty</h3><p>Let's find something you'll love.</p><a class="btn primary" style="margin-top:18px" href="${U.shop()}">Start shopping</a></div>`;f.innerHTML="";f.style.display="none";return}
  f.style.display="";
  b.innerHTML=`<div class="prog"><span>${t.left?`You're <b class="num">${rs(t.left)}</b> away from free delivery`:`<b style="color:var(--ok)">You've unlocked free delivery</b>`}</span><div class="bar"><i style="width:${t.pct}%"></i></div></div>`+
  cart.map(i=>{const p=bySlug(i.s);return `<div class="li"><a class="art" href="${U.p(p.slug)}">${pic(p)}</a><div><a class="nm" href="${U.p(p.slug)}">${esc(p.name)}</a><div class="sm num">${rs(p.price)}</div><div class="qty"><button data-cq="${p.slug}" data-d="-1" aria-label="Decrease">−</button><span class="num">${i.q}</span><button data-cq="${p.slug}" data-d="1" aria-label="Increase">+</button></div></div><div style="display:grid;justify-items:end;gap:8px"><b class="num" style="font-size:14px">${rs(p.price*i.q)}</b><button class="rm" data-rm="${p.slug}">Remove</button></div></div>`}).join("");
  f.innerHTML=`<div class="coupon"><label for="cc" class="sr">Coupon</label><input id="cc" placeholder="Coupon code" value="${coupon||""}"><button class="btn ghost" id="ccBtn">${coupon?"Remove":"Apply"}</button></div><p class="note" id="ccNote">${coupon?`${coupon} applied, ${STORE.coupons[coupon]}% off`:""}</p>
  <div class="tot num"><span>Subtotal</span><span>${rs(t.sub)}</span></div>${t.disc?`<div class="tot num" style="color:var(--ok)"><span>Discount</span><span>−${rs(t.disc)}</span></div>`:""}<div class="tot num"><span>Delivery</span><span>${t.ship?rs(t.ship):"Free"}</span></div><div class="tot big num"><span>Total</span><span>${rs(t.total)}</span></div>
  <a class="btn rose block" href="/checkout/">Checkout · Cash on Delivery</a>`;
  $("#ccBtn").onclick=()=>{ if(coupon){coupon=null;saveCart();return} const v=$("#cc").value.trim().toUpperCase(); if(STORE.coupons[v]){coupon=v;saveCart()}else{const n=$("#ccNote");n.textContent="That code isn't valid.";n.classList.add("err")} };
}

/* ---------- overlays ---------- */
function openPanel(id){closePanels(); if(id==="search"){$("#search").classList.add("on");setTimeout(()=>$("#q").focus(),50);runSearch();return} if(id==="cart")renderCart(); $("#"+id).classList.add("on");$("#scrim").classList.add("on"); document.body.style.overflow="hidden"}
function closePanels(){$$(".drawer.on,.search.on,.scrim.on").forEach(e=>e.classList.remove("on"));document.body.style.overflow=""}
let sT;
function runSearch(){
  const q=$("#q").value.trim().toLowerCase();
  $("#sugg").innerHTML=["Serum","Sunscreen","Blush","Anua","Niacinamide","Hair oil","Body butter"].map(s=>`<button class="tab" data-sq="${s}">${s}</button>`).join("");
  const r=q?P.filter(p=>(p.name+" "+p.brand+" "+((catOf(p.cat)||{}).n||"")).toLowerCase().includes(q)).slice(0,10):P.filter(p=>p.stock).slice(20,25);
  $("#sres").innerHTML=(q?"":`<h6 style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Popular right now</h6>`)+(r.length?r.map((p,i)=>`<a href="${U.p(p.slug)}" style="--d:${i*35}ms"><span class="art">${pic(p)}</span><span><b style="font-size:11px;letter-spacing:.12em;color:var(--gold);text-transform:uppercase">${esc(p.brand)}</b><br>${esc(p.name)}</span><b class="num">${rs(p.price)}</b></a>`).join(""):`<p class="empty">No results for “${esc(q)}”. Try another word.</p>`);
  clearTimeout(sT); if(q.length>2) sT=setTimeout(()=>track("search",{search_term:q}),900);
}
function openModal(html,size){closePanels();$("#mbody").innerHTML=html;$("#mbox").className="mbox"+(size?" "+size:"");$("#modal").classList.add("on");document.body.style.overflow="hidden"}
function closeModal(){const m=$("#modal");if(!m||!m.classList.contains("on"))return;m.classList.remove("on");document.body.style.overflow=""}
async function copyCode(code,btn){
  let ok=false;try{await navigator.clipboard.writeText(code);ok=true}catch(e){}
  if(!ok){try{const r=document.createRange();r.selectNodeContents(btn);const s=getSelection();s.removeAllRanges();s.addRange(r);ok=document.execCommand("copy");s.removeAllRanges()}catch(e){}}
  const sm=btn.querySelector("small");if(sm){const o=sm.textContent;sm.textContent=ok?"Copied!":"Code: "+code;btn.classList.add("done");setTimeout(()=>{sm.textContent=o;btn.classList.remove("done")},2200)}
  toast(ok?`Code <b>${code}</b> copied, paste it in your bag`:`Use code <b>${code}</b> in your bag`);
}
function welcomeNudge(){
  if(ss.get("nudge")||store.get("last",null)||/gclid|gbraid|wbraid/.test(location.search)) return;
  setTimeout(()=>{
    if($("#modal").classList.contains("on")||$(".drawer.on")||/checkout|order-placed/.test(location.pathname)) return;
    ss.set("nudge","1"); const el=$("#nudge");
    el.innerHTML=`<img src="assets/logo-mark.svg" alt="" width="40" height="40"><div><b>New here? 10% off your first order</b><small>Use code <button class="lnk" data-copy="WELCOME10"><small>WELCOME10</small></button> in your bag.</small></div><button class="x" aria-label="Dismiss">×</button>`;
    el.classList.add("on"); $(".x",el).onclick=()=>el.classList.remove("on"); setTimeout(()=>el.classList.remove("on"),12000);
  },20000);
}
function quickView(p){
  if(!p)return; let q=1; const o=off(p);
  openModal(`<div class="qv"><div class="gmain">${pic(p,1)}${o>=10&&p.stock?`<span class="off">−${o}%</span>`:""}</div>
  <div class="qi"><span class="brand" style="font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)">${esc(p.brand)}</span><h3>${esc(p.name)}</h3>
  <div class="price num"><span class="now" style="font-size:22px">${rs(p.price)}</span>${o>=10?`<span class="was">${rs(p.compare)}</span><span class="save">Save ${rs(p.compare-p.price)}</span>`:""}</div>
  <span class="pill ${p.stock?"":"out"}">${p.stock?"In stock, ready to ship":"Sold out"}</span>
  <p style="color:var(--muted);font-size:14px">${esc(p.desc)}</p>
  ${p.stock?`<div class="buy" style="margin:6px 0 0"><div class="row"><div class="qty"><button data-qq="-1" aria-label="Decrease">−</button><span id="qvq">1</span><button data-qq="1" aria-label="Increase">+</button></div><button class="btn primary" id="qvAdd">Add to bag</button></div></div>`:`<button class="btn primary block" data-notify="${p.slug}">Notify me when available</button>`}
  <a href="${U.p(p.slug)}" style="font-weight:600;font-size:14px;text-decoration:underline">View full details</a></div></div>`);
  $$("[data-qq]").forEach(b=>b.onclick=()=>{q=Math.max(1,Math.min(10,q+ +b.dataset.qq));$("#qvq").textContent=q});
  const a=$("#qvAdd"); if(a)a.onclick=()=>{addToCart(p.slug,q,a);setTimeout(closeModal,500)};
}
function notifyModal(p){
  openModal(`<div class="sform"><span class="eyebrow">Back in stock alert</span><h3>${esc(p.name)}</h3><p class="m">We'll message you on WhatsApp the moment it's back.</p><a class="btn wa block" href="#" data-wa-notify="${p.slug}">Notify me on WhatsApp</a></div>`,"sm");
}
function waOpen(msg){ track("generate_lead",{method:"whatsapp"}); adsConversion(CFG.adsWhatsappLabel,{}); window.open(`https://wa.me/${STORE.wa}?text=${encodeURIComponent(msg)}`,"_blank","noopener") }


/* theme picker (preview builds only) */
const THEMES=[["","Nude Luxe","Ivory, espresso, rose gold",["#FBF7F2","#2B201C","#9C5F52","#B8935E"]],
["maison","Maison","White and black, Chanel/Sephora style",["#FFFFFF","#111111","#C8102E","#D8C7A3"]],
["blush","Blush Couture","Soft pink and black, Glossier style",["#FCF4F2","#1F1517","#B65F6B","#EBB8BC"]],
["champagne","Champagne","Ivory and gold, Sulwhasoo/Dior style",["#F8F3E9","#26221C","#9C7A38","#E3CB92"]],
["emerald","Emerald Atelier","Deep green and gold, perfume house",["#F6F3EC","#0F3B30","#B08A45","#E2C78E"]],
["bordeaux","Bordeaux","Burgundy and gold, Charlotte Tilbury style",["#FAF4F2","#4E1427","#7A1E36","#E4C894"]],
["lilac","Seoul Lilac","Lilac and navy, Laneige/K-beauty",["#F6F5FC","#1C2147","#5C63C7","#C9CBF3"]],
["peach","Peach Glow","Peach and coral, Glow Recipe style",["#FFF7F2","#2B1C17","#D9643F","#F8BFA6"]],
["mocha","Mocha Mousse","Warm mocha, Pantone colour of the year",["#F7F1EB","#3B2C25","#8F6552","#D6B7A6"]],
["sage","Sage Apothecary","Clean white and sage, Aesop style",["#F5F4EE","#263028","#4F6E57","#BFD0C0"]]];
function themePicker(){
  if(!CFG.themePicker) return;
  const cur=store.get("theme","");
  const w=document.createElement("div"); w.className="tpick";
  w.innerHTML=`<button type="button" aria-expanded="false"><i></i>Theme</button><div class="tpanel"><b>Choose a colour theme</b>${THEMES.map(([k,n,d,c],i)=>`<button type="button" class="topt${k===cur?" on":""}" data-th="${k}"><span class="sw">${c.map(x=>`<span style="background:${x}"></span>`).join("")}</span><span><strong>${i+1}. ${n}</strong><small>${d}</small></span></button>`).join("")}</div>`;
  document.body.appendChild(w);
  const btn=w.firstElementChild; btn.onclick=()=>{w.classList.toggle("open");btn.setAttribute("aria-expanded",w.classList.contains("open"))};
  $$(".topt",w).forEach(o=>o.onclick=()=>{const k=o.dataset.th; if(k)document.documentElement.dataset.theme=k; else delete document.documentElement.dataset.theme; store.set("theme",k); $$(".topt",w).forEach(x=>x.classList.toggle("on",x===o)); toast(`Theme: <b>${o.querySelector("strong").textContent}</b>`)});
}

/* ---------- boot ---------- */
function boot(){
  document.documentElement.classList.add("js");
  // old #hash links → real URLs
  const h=PV?"":location.hash.slice(1);
  if(h){ const m=h.match(/^p-(.+)$/), s=h.match(/^shop-(.+)$/);
    const to=m&&bySlug(m[1])?U.p(m[1]):s&&catOf(s[1])?U.shop(s[1]):({home:"/",shop:"/shop/",sale:"/sale/",wishlist:"/wishlist/",checkout:"/checkout/",track:"/track-order/",policy:"/shipping-policy/"})[h];
    if(to) history.replaceState({},"",to); }
  document.addEventListener("click",e=>{
    if(e.target===$("#modal")||e.target.closest("[data-mclose]")){closeModal();return}
    const t=e.target.closest("[data-qv],[data-copy],[data-open],[data-close],[data-add],[data-addq],[data-buynow],[data-w],[data-wbig],[data-cq],[data-rm],[data-sq],[data-routine],[data-notify],[data-wa],[data-wa-p],[data-wa-join],[data-wa-order],[data-wa-notify]");
    if(t){
      if(t.dataset.qv){e.preventDefault();quickView(bySlug(t.dataset.qv))}
      else if(t.dataset.copy){e.preventDefault();copyCode(t.dataset.copy,t)}
      else if(t.dataset.open){e.preventDefault();openPanel(t.dataset.open)}
      else if(t.hasAttribute("data-close")){closePanels()}
      else if(t.dataset.add){e.preventDefault();addToCart(t.dataset.add,1,t)}
      else if(t.dataset.addq){addToCart(t.dataset.addq,pdQty,t)}
      else if(t.dataset.buynow){const s=t.dataset.buynow;const it=cart.find(i=>i.s===s);it?it.q=Math.max(it.q,pdQty):cart.push({s,q:pdQty});saveCart();go("/checkout/")}
      else if(t.dataset.w){e.preventDefault();toggleWish(t.dataset.w)}
      else if(t.dataset.wbig){toggleWish(t.dataset.wbig);t.textContent=wish.includes(t.dataset.wbig)?"♥ Saved":"♡ Save to wishlist"}
      else if(t.dataset.cq){const it=cart.find(i=>i.s===t.dataset.cq);it.q+= +t.dataset.d;if(it.q<1)cart=cart.filter(i=>i!==it);saveCart()}
      else if(t.dataset.rm){cart=cart.filter(i=>i.s!==t.dataset.rm);saveCart()}
      else if(t.dataset.sq){$("#q").value=t.dataset.sq;runSearch()}
      else if(t.dataset.routine){t.dataset.routine.split(",").forEach(s=>{const it=cart.find(i=>i.s===s);it?it.q++:cart.push({s,q:1})});saveCart();bumpCart();toast(`Routine added · <a href="#" data-open="cart">View bag</a>`)}
      else if(t.dataset.notify){e.preventDefault();notifyModal(bySlug(t.dataset.notify))}
      else if(t.dataset.waNotify){e.preventDefault();const p=bySlug(t.dataset.waNotify);waOpen(`Hi! Please let me know when ${p.name} is back in stock.`);closeModal()}
      else if(t.hasAttribute("data-wa-join")){e.preventDefault();waOpen("Hi! Please add me to your WhatsApp list for new launches and restocks.")}
      else if(t.hasAttribute("data-wa-order")){e.preventDefault();const o=store.get("last",null);if(o)waOpen(orderText(o))}
      else if(t.hasAttribute("data-wa")||t.dataset.waP){e.preventDefault();const p=t.dataset.waP&&bySlug(t.dataset.waP);waOpen(p?`Hi! I'd like to order: ${p.name} (${rs(p.price)}) x ${pdQty}\n${location.origin+U.p(p.slug)}`:"Hi! I need help choosing a product.")}
      return;
    }
    const a=e.target.closest("a[href]");
    if(a&&!e.defaultPrevented&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&!a.target&&!a.hasAttribute("download")){
      const u=new URL(a.href,location.href);
      if(u.origin===location.origin&&!/\.(xml|txt|svg|png|webp|jpg)$/.test(u.pathname)){
        if(a.getAttribute("href")==="#"){e.preventDefault();return}
        e.preventDefault(); if(u.pathname===curPath()&&!u.search){closePanels();closeModal();window.scrollTo({top:0,behavior:"smooth"});return}
        go(u.pathname+u.search);
      }
    }
  });
  $("#scrim").onclick=closePanels;
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closePanels();closeModal()}});
  $("#q").addEventListener("input",runSearch);
  addEventListener("popstate",()=>{if(PV)return;closePanels();closeModal();route()});
  if(PV) addEventListener("hashchange",()=>{const v=$("#view");v.classList.add("leave");setTimeout(()=>{window.scrollTo({top:0,behavior:"instant"});v.classList.remove("leave");route()},180)});
  $("#menuBtn").onclick=()=>openPanel("menu");
  $("#yr").textContent=new Date().getFullYear();
  syncBadges(); renderCart(); scrollFx(); spInit(); route(true); welcomeNudge(); loadTags(); themePicker();
  document.body.classList.add("ready");
}
if(typeof document!=="undefined"&&!SSR){ document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot() }
if(typeof module!=="undefined") module.exports={P,CATS,BRANDS,BRAND_COUNT,U,PAGES,parse,meta,view,vHome,vShop,vProduct,vInfo,v404,vWish,vCheckout,vDone,rs,off,esc,slugify,catOf,STORE,CAT_INTRO};
