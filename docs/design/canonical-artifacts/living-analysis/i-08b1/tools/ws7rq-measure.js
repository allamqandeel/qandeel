/* WS7R-Q measurement harness. Loaded INTO the prototype page from the board
   server (`/I-08B1-WS7R/ws7rq-measure.js`); it touches nothing in the
   prototype and adds only window.__q*. Every number in notes §22 comes from
   these functions, so the section is reproducible from the archive alone:
     __qStats(d,w,h,step)      frame statistics of an RGBA buffer
     __qStruct(d,w,h,cx,cy,R)  fine-structure metrics inside an annulus
     __qProf(d,w,h,cx,cy,R)    angle-averaged radial luminance/saturation
     __qDiff(url,spec)         pixel diff of a fresh render against a PNG
     __qSettle()               one throwaway render so the page's initial
                               focus transition is over (a fresh page reports
                               a spurious diff for ~1 s after load)
     __qReport()               the MID report used throughout §22
     __qBoard(name,spec)       the reference-vs-MID board
     __qRefStats()             the same statistics on the reference image  */
(function(){
  const LUMA=(r,g,b)=>0.2126*r+0.7152*g+0.0722*b;
  window.__qStats=(d,w,h,step=1)=>{
    const N=w*h; let n=0,sumL=0,sumS=0,sumC=0,dark=0,v200=0,brightN=0,brightS=0;
    const Ls=new Float32Array(Math.ceil(N/step)); let dr=0,dg=0,db=0,dn=0;
    for(let i=0,k=0;i<N;i+=step,k++){
      const r=d[i*4],g=d[i*4+1],b=d[i*4+2]; const L=LUMA(r,g,b); Ls[k]=L; n++; sumL+=L;
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),c=mx-mn; sumC+=c; const s=mx>0?c/mx:0; sumS+=s;
      if(L<18)dark++; if(L>200)v200++; if(L>120){brightN++;brightS+=s;}
    }
    const sorted=Array.from(Ls.subarray(0,n)).sort((a,b)=>a-b);
    const q=p=>sorted[Math.min(n-1,Math.floor(p*n))]; const dc=q(0.40);
    for(let i=0;i<N;i+=step){ const r=d[i*4],g=d[i*4+1],b=d[i*4+2]; if(LUMA(r,g,b)<=dc){dr+=r;dg+=g;db+=b;dn++;} }
    return {mean:+(sumL/n).toFixed(2),p50:+q(0.5).toFixed(1),p90:+q(0.9).toFixed(1),p95:+q(0.95).toFixed(1),
            p99:+q(0.99).toFixed(1),darkShare:+(dark/n*100).toFixed(1),over200:+(v200/n*100).toFixed(2),
            meanSat:+(sumS/n*100).toFixed(1),meanChroma:+(sumC/n).toFixed(1),
            brightMeanSat:+(brightS/Math.max(1,brightN)*100).toFixed(1),
            groundRGB:[Math.round(dr/dn),Math.round(dg/dn),Math.round(db/dn)]};
  };
  window.__qStruct=(d,w,h,cx,cy,R,f0=0.25,f1=0.82,prom=22)=>{
    const L=new Float32Array(w*h); for(let i=0;i<w*h;i++){const k=i*4; L[i]=LUMA(d[k],d[k+1],d[k+2]);}
    let peaks=0,area=0,hf=0,mid=0,lo=0; const r0=(R*f0)**2,r1=(R*f1)**2;
    for(let y=3;y<h-3;y++) for(let x=3;x<w-3;x++){
      const dd=(x-cx)**2+(y-cy)**2; if(dd<r0||dd>r1) continue; area++;
      const v=L[y*w+x]; let s=0,n=0;
      for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){ if(Math.abs(dx)<2&&Math.abs(dy)<2) continue; s+=L[(y+dy)*w+x+dx]; n++; }
      const ring=s/n; hf+=Math.abs(v-ring);
      if(v-ring>prom){ let mx=true; for(let dy=-1;dy<=1&&mx;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; if(L[(y+dy)*w+x+dx]>v){mx=false;break;} } if(mx) peaks++; }
      if(v>=36&&v<100) mid++; if(v<22) lo++;
    }
    return {peaksPer10kPx:+(peaks/area*1e4).toFixed(1),localContrast:+(hf/area).toFixed(2),
            midToneShare:+(mid/area*100).toFixed(1),floorShare:+(lo/area*100).toFixed(1)};
  };
  window.__qProf=(d,w,h,cx,cy,R,f0=0.3,f1=1.6,steps=14,angles=180)=>{
    const out=[];
    for(let s=0;s<steps;s++){
      const f=f0+(f1-f0)*s/(steps-1); let Ls=0,S=0,n=0;
      for(let a=0;a<angles;a++){
        const th=a/angles*Math.PI*2; const x=Math.round(cx+Math.cos(th)*R*f), y=Math.round(cy+Math.sin(th)*R*f);
        if(x<0||y<0||x>=w||y>=h) continue; const k=(y*w+x)*4,r=d[k],g=d[k+1],b=d[k+2];
        Ls+=LUMA(r,g,b); const mx=Math.max(r,g,b),mn=Math.min(r,g,b); S+=mx>0?(mx-mn)/mx:0; n++;
      }
      out.push([+f.toFixed(2),+(Ls/n).toFixed(1),+(S/n*100).toFixed(0)]);
    }
    return out;
  };
  const loadPng=async url=>{ const im=new Image(); im.src=url; await im.decode();
    const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
    const g=c.getContext('2d'); g.drawImage(im,0,0); return {c,d:g.getImageData(0,0,c.width,c.height).data,im}; };
  window.__qDiff=async(url,spec)=>{
    const {c,d:a}=await loadPng(url);
    const {Oc,cw,ch}=mkFrame(Object.assign({w:c.width,h:c.height},spec)); const b=Oc.getImageData(0,0,cw,ch).data;
    let diff=0,maxd=0;
    for(let i=0;i<a.length;i+=4){ const dd=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2])); if(dd){diff++; if(dd>maxd)maxd=dd;} }
    return {url,differing:diff,total:c.width*c.height,maxChannelDiff:maxd};
  };
  window.__qSettle=()=>{ mkFrame({A:0.5,w:64,h:36}); return {focus:WORK.focus,pendingTransfer:!!WORK.from}; };
  window.__qReport=(spec)=>{
    const {Oc,cw,ch,cam}=mkFrame(Object.assign({A:0.5,w:2100,h:1181,now:0},spec||{}));
    const d=Oc.getImageData(0,0,cw,ch).data;
    const T=(x,y)=>[(x-cam.cx)*cam.z+cw/2,(y-cam.cy)*cam.z+ch/2];
    const [wx,wy]=T(1205,682),[hx,hy]=T(742,941),[gx,gy]=T(1180,1180),[mx,my]=T(1874,892);
    return {frame:window.__qStats(d,cw,ch,2),
            work:window.__qStruct(d,cw,ch,Math.round(wx),Math.round(wy),Math.round(338*cam.z)),
            health:window.__qStruct(d,cw,ch,Math.round(hx),Math.round(hy),Math.round(224*cam.z)),
            money:window.__qStruct(d,cw,ch,Math.round(mx),Math.round(my),Math.round(192*cam.z)),
            gap:window.__qStruct(d,cw,ch,Math.round(gx),Math.round(gy),120,0,1),
            workProfile:window.__qProf(d,cw,ch,Math.round(wx),Math.round(wy),338*cam.z)};
  };
  window.__qRefStats=async()=>{
    const {c,d}=await loadPng('/I-08B1-WS7R/ws7rm-reference-target.png');
    return {w:c.width,h:c.height,frame:window.__qStats(d,c.width,c.height,1),
            work:window.__qStruct(d,c.width,c.height,282,195,156),
            health:window.__qStruct(d,c.width,c.height,82,58,52),
            gap:window.__qStruct(d,c.width,c.height,560,300,60,0,1),
            workProfile:window.__qProf(d,c.width,c.height,282,195,156)};
  };
  window.__qBoard=async(name,spec)=>{
    if(document.fonts&&document.fonts.ready) await document.fonts.ready;
    const {im}=await loadPng('/I-08B1-WS7R/ws7rm-reference-target.png');
    const {O,cw,ch}=mkFrame(Object.assign({A:0.5,w:2100,h:1181,now:0},spec||{}));
    const H=ch, refW=Math.round(im.naturalWidth*(H/im.naturalHeight)), gap=24, capH=58;
    const c=document.createElement('canvas'); c.width=refW+gap+cw; c.height=H+capH;
    const g=c.getContext('2d'); g.fillStyle='#05070c'; g.fillRect(0,0,c.width,c.height);
    g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';
    g.drawImage(im,0,capH,refW,H); g.drawImage(O,refW+gap,capH);
    g.fillStyle='rgba(232,238,244,0.92)'; g.textBaseline='middle'; g.direction='rtl'; g.textAlign='right';
    g.font='600 24px "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif';
    g.fillText('01 — الصورة المرجعية',refW-18,capH/2);
    g.fillText('WS7R-Q — MID',refW+gap+cw-18,capH/2);
    const r=await fetch('/save/'+name,{method:'POST',body:c.toDataURL('image/png')}); return r.text();
  };
})();
