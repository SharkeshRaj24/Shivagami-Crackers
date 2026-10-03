"use strict";
/* ===== Storage (LocalStorage for data, IndexedDB for images) =====
   NOTE: Admin login below uses LocalStorage and is NOT secure. It is suitable only for a
   local/demo POS application. Production deployment should use a secure backend authentication system. */
const K={products:"shivagami_products",bills:"shivagami_bills",settings:"shivagami_settings",counter:"shivagami_bill_counter",admin:"shivagami_admin",cart:"shivagami_cart"};
const LS={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{toast("Storage is full or blocked","err")}}};
const DEF_SET={name:"Shivagami Crackers",address:"Main Road, Sivakasi, Tamil Nadu",phone:"+91 98765 43210",email:"info@shivagami.example",gstin:"",footer:"Thank you for shopping with Shivagami Crackers!"};
const DEF_CATS=["Sparklers","Flower Pots","Ground Chakkars","Rockets","Bombs","Fancy Crackers","Gift Boxes","Kids Crackers","Other"];
let db,images={};
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open("shivagami_db",1);r.onupgradeneeded=()=>r.result.createObjectStore("images");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const idb=(mode,fn)=>new Promise((res,rej)=>{const t=db.transaction("images",mode),s=t.objectStore("images"),q=fn(s);t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)});
async function loadImages(){images={};if(!db)return;const keys=await idb("readonly",s=>s.getAllKeys()),vals=await idb("readonly",s=>s.getAll());keys.forEach((k,i)=>images[k]=vals[i])}
const imgPut=(id,d)=>{images[id]=d;return db?idb("readwrite",s=>s.put(d,id)):0};
const imgDel=id=>{delete images[id];return db?idb("readwrite",s=>s.delete(id)):0};
function seed(){ // only when nothing exists
  if(LS.get(K.products,null)===null){const s=[["Classic Sparklers","Sparklers",100,50],["Deluxe Flower Pot","Flower Pots",150,30],["Flower Pot Special","Flower Pots",220,20],["Ground Chakkar Big","Ground Chakkars",90,40],["Sky Rocket Pack","Rockets",260,25],["Fancy Fountain Show","Fancy Crackers",480,12],["Kids Fun Box","Kids Crackers",199,35],["Family Gift Box","Gift Boxes",999,10]];
    LS.set(K.products,s.map((p,i)=>({id:i+1,name:p[0],category:p[1],price:p[2],gst:18,stock:p[3]})))}
  if(LS.get(K.settings,null)===null)LS.set(K.settings,{...DEF_SET,categories:DEF_CATS});
  if(LS.get(K.counter,null)===null)LS.set(K.counter,0);
  if(LS.get(K.bills,null)===null)LS.set(K.bills,[]);
  if(LS.get(K.admin,null)===null)LS.set(K.admin,{user:"admin",pass:"admin123"});
}
const P=()=>LS.get(K.products,[]),B=()=>LS.get(K.bills,[]),S=()=>({...DEF_SET,categories:DEF_CATS,...LS.get(K.settings,{})}),cart=()=>LS.get(K.cart,[]);

/* ===== Helpers ===== */
const $=s=>document.querySelector(s),r2=n=>Math.round((n+Number.EPSILON)*100)/100;
const inr=n=>"₹"+Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const inrPdf=n=>"Rs. "+Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}); // jsPDF base fonts lack the ₹ glyph
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
function toast(msg,type){const t=document.createElement("div");t.className="toast "+(type||"");t.textContent=msg;$("#toasts").append(t);setTimeout(()=>t.remove(),2600)}
function modal(html,cls){$("#modal").innerHTML=`<div class="ov ${cls||""}" id="ov"><div class="md" role="dialog" aria-modal="true">${html}</div></div>`;$("#ov").onclick=e=>{if(e.target.id==="ov")closeModal()}}
const closeModal=()=>$("#modal").innerHTML="";
function confirmBox(msg,okText,cb){modal(`<h2>Please confirm</h2><p>${esc(msg)}</p><div class="acts"><button class="btn sec" onclick="closeModal()">Cancel</button><button class="btn red" id="okBtn">${okText}</button></div>`);$("#okBtn").onclick=()=>{closeModal();cb()}}
function line(price,qty,gst){const base=r2(price*qty),g=r2(base*gst/100);return{base,gst:g,total:r2(base+g)}}
function totals(items){const subtotal=r2(items.reduce((s,i)=>s+i.base,0)),totalGST=r2(items.reduce((s,i)=>s+i.gstAmt,0));return{subtotal,totalGST,grand:r2(subtotal+totalGST)}}

/* ===== Navigation ===== */
let view="pos",cat="All",q="",bq="",bdate="",adminQ="",dq={};
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>go(b.dataset.v));
function go(v){view=v;document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.v===v));$("#cartBtn").classList.toggle("hide",v!=="pos");render()}
function render(){({pos:renderPOS,bills:renderBills,admin:renderAdmin})[view]();updateCount()}
function updateCount(){$("#cartCount").textContent=cart().reduce((s,i)=>s+i.qty,0)}

/* ===== POS ===== */
function renderPOS(){
  const cats=["All",...S().categories];
  $("#main").innerHTML=`<input class="search" id="q" placeholder="Search crackers by name..." value="${esc(q)}" aria-label="Search crackers">
  <div class="chips">${cats.map(c=>`<button class="chip ${c===cat?"on":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div><div class="grid" id="grid"></div>`;
  $("#q").oninput=e=>{q=e.target.value;drawGrid()};
  document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{cat=b.dataset.c;renderPOS()});
  drawGrid();
}
function drawGrid(){
  const all=P(),t=q.trim().toLowerCase();
  const list=all.filter(p=>(cat==="All"||p.category===cat)&&(!t||p.name.toLowerCase().includes(t)||p.category.toLowerCase().includes(t)));
  $("#grid").innerHTML=!all.length?`<div class="empty" style="grid-column:1/-1">No crackers available. Add products from Admin.</div>`:!list.length?`<div class="empty" style="grid-column:1/-1">No crackers found.</div>`:
  list.map(p=>{const out=p.stock<=0,n=dq[p.id]||1;return`<article class="pc"><div class="im">${images[p.id]?`<img src="${images[p.id]}" alt="${esc(p.name)}">`:"🎆"}${out?'<span class="tag">OUT OF STOCK</span>':""}</div>
  <div class="bd"><h3>${esc(p.name)}</h3><span class="mu">${esc(p.category)}</span><span class="price">${inr(p.price)}</span><span class="mu">GST: ${p.gst}% · Stock: ${p.stock}</span>
  <div class="qty"><button data-a="dec" data-id="${p.id}" aria-label="Decrease" ${out?"disabled":""}>−</button><span>${out?0:n}</span><button data-a="inc" data-id="${p.id}" aria-label="Increase" ${out?"disabled":""}>+</button></div>
  <button class="btn" data-a="add" data-id="${p.id}" ${out?"disabled":""}>${out?"Out of Stock":"Add to Cart"}</button></div></article>`}).join("");
}
$("#main").addEventListener("click",e=>{const b=e.target.closest("[data-a]");if(!b||view!=="pos")return;const id=+b.dataset.id,p=P().find(x=>x.id===id);if(!p)return;
  let n=dq[id]||1;
  if(b.dataset.a==="inc")dq[id]=Math.min(n+1,p.stock);
  if(b.dataset.a==="dec")dq[id]=Math.max(n-1,1);
  if(b.dataset.a==="add")addToCart(id,n);
  drawGrid()});
function addToCart(id,n){const p=P().find(x=>x.id===id),c=cart(),ex=c.find(i=>i.id===id),have=ex?ex.qty:0;
  if(have+n>p.stock){toast(`Only ${p.stock} in stock`,"err");return}
  ex?ex.qty+=n:c.push({id,qty:n});LS.set(K.cart,c);dq[id]=1;updateCount();toast("Product added to cart")}

/* ===== Cart drawer ===== */
$("#cartBtn").onclick=openCart;
function cartLines(){const prods=P();return cart().map(i=>{const p=prods.find(x=>x.id===i.id);return p?{...i,p,...line(p.price,i.qty,p.gst)}:null}).filter(Boolean)}
function openCart(){
  const L=cartLines(),T=totals(L.map(l=>({base:l.base,gstAmt:l.gst})));
  modal(`<h2>Your cart</h2>${!L.length?'<div class="empty">Your cart is empty.</div>':`<div class="tw"><table><tr><th>Product</th><th>Qty</th><th class="r">Price</th><th class="r">GST</th><th class="r">Total</th><th></th></tr>
  ${L.map(l=>`<tr><td>${esc(l.p.name)}</td><td><div class="qty"><button data-c="dec" data-id="${l.id}" aria-label="Decrease">−</button><span>${l.qty}</span><button data-c="inc" data-id="${l.id}" aria-label="Increase">+</button></div></td><td class="r">${inr(l.p.price)}</td><td class="r">${l.p.gst}% (${inr(l.gst)})</td><td class="r">${inr(l.total)}</td><td><button class="btn sm sec" data-c="rm" data-id="${l.id}">Remove</button></td></tr>`).join("")}</table></div>
  <div class="tot"><span>Subtotal: ${inr(T.subtotal)}</span><span>GST: ${inr(T.totalGST)}</span><span class="g">Grand Total: ${inr(T.grand)}</span></div>`}
  <div class="acts"><button class="btn sec" onclick="closeModal()">Close</button>${L.length?'<button class="btn red sm" data-c="clear">Clear cart</button><button class="btn" data-c="checkout">Generate Bill</button>':""}</div>`,"side");
  $("#ov").onclick=e=>{if(e.target.id==="ov")closeModal();const b=e.target.closest("[data-c]");if(!b)return;const id=+b.dataset.id,c=cart(),it=c.find(i=>i.id===id),a=b.dataset.c;
    if(a==="inc"){const p=P().find(x=>x.id===id);if(it.qty+1>p.stock)return toast("Cannot exceed available stock","err");it.qty++}
    if(a==="dec"){it.qty=Math.max(1,it.qty-1)}
    if(a==="rm")c.splice(c.indexOf(it),1);
    if(a==="clear")c.length=0;
    if(a==="checkout")return checkout();
    LS.set(K.cart,c);updateCount();openCart()};
}

/* ===== Checkout & bill creation ===== */
function checkout(){
  if(!cartLines().length)return toast("Cart is empty","err");
  modal(`<h2>Checkout</h2><div class="row"><div><label for="cn">Customer name (optional)</label><input id="cn"></div><div><label for="cm">Mobile (optional)</label><input id="cm" inputmode="numeric" maxlength="10"></div>
  <div><label for="pm">Payment method</label><select id="pm"><option>Cash</option><option>UPI</option><option>Card</option><option>Other</option></select></div></div><p class="mu" id="err" style="color:var(--red)"></p>
  <div class="acts"><button class="btn sec" onclick="openCart()">Back</button><button class="btn" id="gen">Generate Bill</button></div>`);
  $("#gen").onclick=()=>{const m=$("#cm").value.trim();if(m&&!/^[6-9]\d{9}$/.test(m))return $("#err").textContent="Enter a valid 10-digit Indian mobile number or leave it blank.";
    const bill=createBill($("#cn").value.trim(),m,$("#pm").value);if(!bill)return;closeModal();updateCount();toast("Bill generated successfully");pdfBill(bill);showBill(bill);drawGrid&&view==="pos"&&renderPOS()}
}
function createBill(name,mobile,pay){
  const prods=P(),L=cartLines();
  for(const l of L){const p=prods.find(x=>x.id===l.id);if(l.qty>p.stock){toast(`${p.name}: only ${p.stock} left`,"err");return null}}
  const n=LS.get(K.counter,0)+1,items=L.map(l=>({name:l.p.name,qty:l.qty,price:l.p.price,gst:l.p.gst,base:l.base,gstAmt:l.gst,total:l.total})),T=totals(items),d=new Date();
  const bill={no:"SC-"+String(n).padStart(6,"0"),date:d.toISOString().slice(0,10),time:d.toLocaleTimeString("en-IN"),customer:name||"Walk-in Customer",mobile,payment:pay,items,...T,shop:S()};
  LS.set(K.counter,n);const b=B();b.unshift(bill);LS.set(K.bills,b);
  L.forEach(l=>prods.find(x=>x.id===l.id).stock-=l.qty); // stock reduced only after successful billing
  LS.set(K.products,prods);LS.set(K.cart,[]);return bill;
}

/* ===== PDF / view / print ===== */
function pdfBill(b){
  if(!window.jspdf)return toast("PDF library not loaded (check internet)","err");
  const doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"}),s=b.shop||S(),W=210;let y=16;
  doc.setFont("helvetica","bold");doc.setFontSize(20);doc.setTextColor(42,18,69);doc.text(s.name.toUpperCase(),W/2,y,{align:"center"});
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(80);
  [s.address,"Phone: "+s.phone+(s.email?"  |  "+s.email:""),s.gstin?"GSTIN: "+s.gstin:""].filter(Boolean).forEach(t=>{y+=5;doc.text(t,W/2,y,{align:"center"})});
  y+=5;doc.setDrawColor(245,165,36);doc.setLineWidth(.8);doc.line(14,y,W-14,y);y+=7;doc.setTextColor(0);doc.setFontSize(10);
  doc.text(`Bill No: ${b.no}`,14,y);doc.text(`Date: ${b.date.split("-").reverse().join("/")}   Time: ${b.time}`,W-14,y,{align:"right"});y+=6;
  doc.text(`Customer: ${b.customer}`,14,y);doc.text(`Mobile: ${b.mobile||"-"}`,W-14,y,{align:"right"});y+=6;
  const cols=[[14,"Product","l"],[96,"Qty","r"],[122,"Price","r"],[140,"GST","r"],[168,"GST Amt","r"],[196,"Total","r"]];
  const head=()=>{doc.setFillColor(42,18,69);doc.rect(14,y-5,182,8,"F");doc.setTextColor(255);doc.setFont("helvetica","bold");cols.forEach(c=>doc.text(c[1],c[0],y,{align:c[2]==="r"?"right":"left"}));doc.setTextColor(0);doc.setFont("helvetica","normal");y+=8};
  head();
  b.items.forEach(i=>{if(y>270){doc.addPage();y=20;head()}
    const v=[i.name.slice(0,40),String(i.qty),inrPdf(i.price),i.gst+"%",inrPdf(i.gstAmt),inrPdf(i.total)];
    cols.forEach((c,k)=>doc.text(v[k],c[0],y,{align:c[2]==="r"?"right":"left"}));y+=7;doc.setDrawColor(220);doc.setLineWidth(.2);doc.line(14,y-4.5,196,y-4.5)});
  if(y>240){doc.addPage();y=20}y+=4;doc.setFontSize(11);
  [["Subtotal",b.subtotal],["Total GST",b.totalGST]].forEach(r=>{doc.text(r[0],150,y);doc.text(inrPdf(r[1]),196,y,{align:"right"});y+=6});
  doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text("Grand Total",150,y+1);doc.text(inrPdf(b.grand),196,y+1,{align:"right"});y+=10;
  doc.setFontSize(10);doc.text("Payment Method: "+b.payment,14,y);y+=14;
  doc.setFont("helvetica","italic");doc.setTextColor(42,18,69);doc.text(s.footer||"Thank you for shopping with Shivagami Crackers!",W/2,y,{align:"center"});
  doc.save(b.no+".pdf");
}
function invHTML(b){const s=b.shop||S();return`<div class="inv" id="printArea"><h2>${esc(s.name.toUpperCase())}</h2><div class="c">${esc(s.address)}<br>Phone: ${esc(s.phone)}${s.gstin?" · GSTIN: "+esc(s.gstin):""}</div><hr>
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><span><b>${b.no}</b><br>${b.date.split("-").reverse().join("/")} ${esc(b.time)}</span><span style="text-align:right">${esc(b.customer)}<br>${esc(b.mobile||"")}</span></div>
  <div class="tw"><table><tr><th>Product</th><th>Qty</th><th class="r">Price</th><th class="r">GST</th><th class="r">GST Amt</th><th class="r">Total</th></tr>${b.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td class="r">${inr(i.price)}</td><td class="r">${i.gst}%</td><td class="r">${inr(i.gstAmt)}</td><td class="r">${inr(i.total)}</td></tr>`).join("")}</table></div>
  <div class="tot"><span>Subtotal: ${inr(b.subtotal)}</span><span>Total GST: ${inr(b.totalGST)}</span><span class="g">Grand Total: ${inr(b.grand)}</span><span>Payment: ${esc(b.payment)}</span></div><p class="c">${esc(s.footer)}</p></div>`}
function showBill(b){modal(invHTML(b)+`<div class="acts"><button class="btn sec" onclick="closeModal()">Close</button><button class="btn sec" onclick="window.print()">Print Bill</button><button class="btn" id="dl">Download PDF</button></div>`);$("#dl").onclick=()=>pdfBill(b)}

/* ===== Bill history ===== */
function renderBills(){
  $("#main").innerHTML=`<div class="panel"><div class="row"><input id="bq" placeholder="Search by bill no. or customer" value="${esc(bq)}" aria-label="Search bills"><input type="date" id="bd" value="${bdate}" aria-label="Filter by date"><button class="btn sec" id="bc">Clear filters</button></div></div><div class="panel tw" id="bl"></div>`;
  $("#bq").oninput=e=>{bq=e.target.value;drawBills()};$("#bd").onchange=e=>{bdate=e.target.value;drawBills()};$("#bc").onclick=()=>{bq=bdate="";renderBills()};drawBills();
}
function drawBills(){
  const t=bq.toLowerCase(),L=B().filter(b=>(!t||b.no.toLowerCase().includes(t)||b.customer.toLowerCase().includes(t))&&(!bdate||b.date===bdate));
  $("#bl").innerHTML=!L.length?'<div class="empty">No bills generated yet.</div>':`<table><tr><th>Bill No</th><th>Date</th><th>Customer</th><th class="r">Total</th><th>Payment</th><th></th></tr>${L.map(b=>`<tr><td>${b.no}</td><td>${b.date.split("-").reverse().join("/")}</td><td>${esc(b.customer)}</td><td class="r">${inr(b.grand)}</td><td>${esc(b.payment)}</td><td><button class="btn sm sec" data-b="v" data-n="${b.no}">View</button> <button class="btn sm" data-b="p" data-n="${b.no}">PDF</button> <button class="btn sm red" data-b="d" data-n="${b.no}">Delete</button></td></tr>`).join("")}</table>`;
}
$("#main").addEventListener("click",e=>{const x=e.target.closest("[data-b]");if(!x)return;const b=B().find(i=>i.no===x.dataset.n);if(!b)return;
  if(x.dataset.b==="v")showBill(b);if(x.dataset.b==="p")pdfBill(b);
  if(x.dataset.b==="d")confirmBox(`Delete bill ${b.no}? Stock will not be restored.`,"Delete",()=>{LS.set(K.bills,B().filter(i=>i.no!==b.no));toast("Bill deleted");drawBills()})});

/* ===== Admin ===== */
const logged=()=>sessionStorage.getItem("shivagami_session")==="1";
function renderAdmin(){
  if(!logged()){$("#main").innerHTML=`<div class="panel" style="max-width:380px;margin:30px auto"><h2>Admin login</h2><label for="u">Username</label><input id="u" autocomplete="username"><br><br><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password"><p class="mu">Demo login (admin / admin123). Not secure – local use only.</p><p id="le" style="color:var(--red)"></p><button class="btn" id="li">Login</button></div>`;
    $("#li").onclick=()=>{const a=LS.get(K.admin,{});if($("#u").value===a.user&&$("#pw").value===a.pass){sessionStorage.setItem("shivagami_session","1");renderAdmin()}else $("#le").textContent="Incorrect username or password."};return}
  const P_=P(),bills=B(),td=bills.filter(b=>b.date===today()),s=S();
  $("#main").innerHTML=`<div class="stats"><div class="stat"><b>${P_.length}</b>Products</div><div class="stat"><b>${P_.reduce((a,p)=>a+p.stock,0)}</b>Total stock</div><div class="stat"><b>${td.length}</b>Today's bills (${bills.length} total)</div><div class="stat"><b>${inr(td.reduce((a,b)=>a+b.grand,0))}</b>Today's sales</div></div>
  <div class="panel"><div class="acts" style="justify-content:flex-start;margin:0 0 12px"><button class="btn" id="np">Add New Cracker</button><button class="btn sec" id="st">Shop settings</button><button class="btn sec" id="bk">Backup Data</button><label class="btn sec" style="margin:0">Restore Data<input type="file" id="rs" accept=".json" hidden></label><button class="btn red" id="rst">Reset All Data</button><button class="btn sec" id="lo">Logout</button></div>
  <input id="aq" placeholder="Search products..." value="${esc(adminQ)}" aria-label="Search products"></div><div class="panel tw" id="at"></div>`;
  $("#np").onclick=()=>productForm();$("#st").onclick=settingsForm;$("#bk").onclick=backup;$("#rs").onchange=restore;$("#rst").onclick=resetAll;
  $("#lo").onclick=()=>{sessionStorage.removeItem("shivagami_session");renderAdmin()};$("#aq").oninput=e=>{adminQ=e.target.value;drawAdminTable()};drawAdminTable();
}
function drawAdminTable(){const t=adminQ.toLowerCase(),L=P().filter(p=>!t||p.name.toLowerCase().includes(t)||p.category.toLowerCase().includes(t));
  $("#at").innerHTML=!L.length?'<div class="empty">No crackers available. Add products from Admin.</div>':`<table><tr><th>Image</th><th>Product</th><th>Category</th><th>Stock</th><th class="r">Price</th><th>GST</th><th>Status</th><th></th></tr>${L.map(p=>`<tr><td>${images[p.id]?`<img class="thumb" src="${images[p.id]}" alt="">`:"🎆"}</td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${p.stock}</td><td class="r">${inr(p.price)}</td><td>${p.gst}%</td><td>${p.stock>0?"In stock":'<b style="color:var(--red)">OUT OF STOCK</b>'}</td><td><button class="btn sm sec" data-e="${p.id}">Edit</button> <button class="btn sm red" data-x="${p.id}">Delete</button></td></tr>`).join("")}</table>`;
  $("#at").querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>productForm(+b.dataset.e));
  $("#at").querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>confirmBox("Are you sure you want to delete this product?","Delete",async()=>{LS.set(K.products,P().filter(p=>p.id!==+b.dataset.x));LS.set(K.cart,cart().filter(i=>i.id!==+b.dataset.x));await imgDel(+b.dataset.x);toast("Product deleted successfully");renderAdmin()}))}
function resizeImage(file){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{const k=Math.min(1,500/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=im.width*k;c.height=im.height*k;c.getContext("2d").drawImage(im,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",.8))};im.src=r.result};r.readAsDataURL(file)})}
function productForm(id){
  const p=id?P().find(x=>x.id===id):{name:"",category:S().categories[0],price:"",gst:18,stock:""};
  modal(`<h2>${id?"Edit":"Add new"} cracker</h2><div class="row"><div><label for="fn">Product name</label><input id="fn" value="${esc(p.name)}"></div><div><label for="fc">Category</label><select id="fc">${S().categories.map(c=>`<option ${c===p.category?"selected":""}>${esc(c)}</option>`).join("")}</select></div>
  <div><label for="fs">Available quantity</label><input id="fs" type="number" min="0" value="${p.stock}"></div><div><label for="fp">Selling price (₹)</label><input id="fp" type="number" min="0" step="0.01" value="${p.price}"></div><div><label for="fg">GST %</label><input id="fg" type="number" min="0" max="100" step="0.01" value="${p.gst}"></div>
  <div><label for="fi">Product image (JPG, PNG, WEBP)</label><input id="fi" type="file" accept="image/jpeg,image/png,image/webp"></div></div><p id="fe" style="color:var(--red)"></p><div class="acts"><button class="btn sec" onclick="closeModal()">Cancel</button><button class="btn" id="sv">Save Product</button></div>`);
  $("#sv").onclick=async()=>{const name=$("#fn").value.trim(),price=parseFloat($("#fp").value),stock=parseInt($("#fs").value,10),gst=parseFloat($("#fg").value),f=$("#fi").files[0];
    if(!name)return $("#fe").textContent="Enter the product name.";if(!(price>=0))return $("#fe").textContent="Enter a valid price.";if(!(stock>=0))return $("#fe").textContent="Enter a valid stock quantity.";if(!(gst>=0&&gst<=100))return $("#fe").textContent="GST must be between 0 and 100.";
    if(f&&!/^image\/(jpeg|png|webp)$/.test(f.type))return $("#fe").textContent="Only JPG, PNG or WEBP images are allowed.";
    const L=P(),rec={name,category:$("#fc").value,price,gst,stock};let pid=id;
    if(id)Object.assign(L.find(x=>x.id===id),rec);else{pid=L.reduce((m,x)=>Math.max(m,x.id),0)+1;L.push({id:pid,...rec})}
    try{if(f)await imgPut(pid,await resizeImage(f))}catch{toast("Image could not be saved","err")}
    LS.set(K.products,L);closeModal();toast(id?"Product updated successfully":"Product added successfully");renderAdmin()};
}
function settingsForm(){const s=S(),f=[["name","Shop name"],["address","Address"],["phone","Phone"],["email","Email"],["gstin","GSTIN (optional)"],["footer","Invoice footer"],["categories","Categories (comma separated)"]];
  modal(`<h2>Shop settings</h2><div class="row">${f.map(([k,l])=>`<div><label for="s_${k}">${l}</label><input id="s_${k}" value="${esc(k==="categories"?s.categories.join(", "):s[k])}"></div>`).join("")}</div><div class="acts"><button class="btn sec" onclick="closeModal()">Cancel</button><button class="btn" id="ss">Save settings</button></div>`);
  $("#ss").onclick=()=>{const n={};f.forEach(([k])=>n[k]=$("#s_"+k).value.trim());n.categories=n.categories.split(",").map(x=>x.trim()).filter(Boolean);if(!n.name)return toast("Shop name is required","err");if(!n.categories.length)n.categories=DEF_CATS;LS.set(K.settings,n);closeModal();toast("Settings saved");renderAdmin()}}

/* ===== Backup / restore / reset ===== */
function backup(){const data={app:"shivagami-crackers",version:1,products:P(),bills:B(),settings:S(),counter:LS.get(K.counter,0),images};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"}));a.download=`shivagami-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Backup downloaded")}
function restore(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let d;try{d=JSON.parse(r.result)}catch{return toast("Invalid JSON file","err")}
  const ok=d&&d.app==="shivagami-crackers"&&Array.isArray(d.products)&&Array.isArray(d.bills)&&d.settings&&typeof d.settings==="object"&&Number.isFinite(d.counter)&&d.products.every(p=>p.id&&typeof p.name==="string"&&Number.isFinite(p.price)&&Number.isFinite(p.stock));
  if(!ok)return toast("This is not a valid Shivagami backup","err");
  confirmBox("Restoring will replace current products, bills and settings.","Restore",async()=>{LS.set(K.products,d.products);LS.set(K.bills,d.bills);LS.set(K.settings,d.settings);LS.set(K.counter,d.counter);LS.set(K.cart,[]);
    if(db){await idb("readwrite",s=>s.clear());for(const [k,v] of Object.entries(d.images||{}))await imgPut(+k,v)}else images=d.images||{};toast("Data restored successfully");renderAdmin()})};r.readAsText(f);e.target.value=""}
function resetAll(){confirmBox("This will permanently remove locally stored products, bills and settings.","Continue",()=>confirmBox("Final warning: this cannot be undone. Reset everything?","Yes, reset all",async()=>{
  Object.values(K).forEach(k=>localStorage.removeItem(k));if(db)await idb("readwrite",s=>s.clear());images={};seed();toast("All data has been reset");renderAdmin()}))}

/* ===== Boot ===== */
(async function(){seed();try{db=await openDB();await loadImages()}catch{toast("Images unavailable in this browser mode","err")}go("pos")})();