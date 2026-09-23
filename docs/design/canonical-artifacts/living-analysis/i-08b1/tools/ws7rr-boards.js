/* WS7R-R board + verification harness. Loaded INTO the prototype page from
   the board server (`/I-08B1-WS7R/ws7rr-boards.js`) AFTER ws7rq-measure.js;
   it touches nothing in the prototype and adds only window.__r*.
     __rBoard(name,spec)        REFERENCE 01 (ws7rr-reference-01.png) beside
                                the MID frame at the same height
     __rDetail(name,spec,crops) REFERENCE 02 (the 132x147 micro patch) at 3.2x
                                beside 1:1 crops of the MID frame at the same
                                size - the local-pattern comparison
     __rSweep(a0,a1,step,w,h)   frame mean along the path, for the steepest
                                step per 0.01 of A (notes §22.5 method)
     __rParity(spec)            reduced motion vs full motion at the same
                                settled frame, in differing pixels
     __rStrata(spec,keys)       one render per schedule term zeroed - the
                                stratum toggle table (§22.1 method)         */
(function(){
  const loadPng=async url=>{ const im=new Image(); im.src=url; await im.decode(); return im; };
  const save=async(name,c)=>{ const r=await fetch('/save/'+name,{method:'POST',body:c.toDataURL('image/png')}); return r.text(); };
  const cap=(g,txt,x,y,px)=>{
    g.fillStyle='rgba(232,238,244,0.92)'; g.textBaseline='middle'; g.direction='rtl'; g.textAlign='right';
    g.font=`600 ${px||24}px "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif`; g.fillText(txt,x,y);
  };
  const LUMA=(r,g,b)=>0.2126*r+0.7152*g+0.0722*b;
  window.__rBoard=async(name,spec)=>{
    if(document.fonts&&document.fonts.ready) await document.fonts.ready;
    const im=await loadPng('/I-08B1-WS7R/ws7rr-reference-01.png');
    const {O,cw,ch}=mkFrame(Object.assign({A:0.5,w:2100,h:1181,now:0},spec||{}));
    const H=ch, refW=Math.round(im.naturalWidth*(H/im.naturalHeight)), gap=24, capH=58;
    const c=document.createElement('canvas'); c.width=refW+gap+cw; c.height=H+capH;
    const g=c.getContext('2d'); g.fillStyle='#05070c'; g.fillRect(0,0,c.width,c.height);
    g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';
    g.drawImage(im,0,capH,refW,H); g.drawImage(O,refW+gap,capH);
    cap(g,'REFERENCE 01 — المرجع العام',refW-18,capH/2);
    cap(g,'WS7R-R — MID',refW+gap+cw-18,capH/2);
    return save(name,c);
  };
  window.__rDetail=async(name,spec,crops)=>{
    if(document.fonts&&document.fonts.ready) await document.fonts.ready;
    const im=await loadPng('/I-08B1-WS7R/ws7rr-reference-02-micro.png');
    const K=3.2, W=Math.round(im.naturalWidth*K), H=Math.round(im.naturalHeight*K);
    const {O}=mkFrame(Object.assign({A:0.5,w:2100,h:1181,now:0},spec||{}));
    const gap=20, capH=54, n=crops.length;
    const c=document.createElement('canvas'); c.width=(n+1)*W+n*gap; c.height=H+capH;
    const g=c.getContext('2d'); g.fillStyle='#05070c'; g.fillRect(0,0,c.width,c.height);
    g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';
    g.drawImage(im,0,capH,W,H);
    cap(g,'REFERENCE 02 — النمط المحلي',W-12,capH/2,20);
    crops.forEach((cr,i)=>{
      const x=(i+1)*(W+gap);
      g.drawImage(O,cr.x,cr.y,W,H,x,capH,W,H);
      cap(g,cr.n,x+W-12,capH/2,20);
    });
    return save(name,c);
  };
  window.__rSweep=(a0,a1,step,w,h)=>{
    const out=[]; w=w||1050; h=h||591;
    for(let A=a0;A<=a1+1e-9;A+=step){
      const {Oc,cw,ch}=mkFrame({A:+A.toFixed(4),w,h,now:0});
      const d=Oc.getImageData(0,0,cw,ch).data; let s=0,n=0;
      for(let i=0;i<d.length;i+=8){ s+=LUMA(d[i],d[i+1],d[i+2]); n++; }
      out.push([+A.toFixed(2),+(s/n).toFixed(3)]);
    }
    return out;
  };
  window.__rParity=(spec)=>{
    const sp=Object.assign({A:0.5,w:1050,h:591,now:0},spec||{});
    const was=RMFORCE;
    RMFORCE=false; const a=mkFrame(sp).Oc.getImageData(0,0,sp.w,sp.h).data;
    RMFORCE=true;  const b=mkFrame(sp).Oc.getImageData(0,0,sp.w,sp.h).data;
    RMFORCE=was;
    let diff=0,mx=0;
    for(let i=0;i<a.length;i+=4){ const dd=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2])); if(dd){diff++; if(dd>mx)mx=dd;} }
    return {differing:diff,total:sp.w*sp.h,maxChannelDiff:mx};
  };
  window.__rStrata=(spec,keys)=>{
    const sp=Object.assign({A:0.5,w:1050,h:591,now:0},spec||{});
    const orig=schedule; const out={};
    const stat=()=>{ const {Oc,cw,ch}=mkFrame(sp); return window.__qStats(Oc.getImageData(0,0,cw,ch).data,cw,ch,1); };
    out.nothing=stat();
    for(const k of keys){
      window.schedule=A=>{ const S=orig(A); const parts=k.split('.'); if(parts.length===1) S[k]=typeof S[k]==='object'?S[k]:0; else S[parts[0]][parts[1]]=0; return S; };
      try{ out[k]=stat(); } finally { window.schedule=orig; }
    }
    return out;
  };
})();
