const T = AFRAME.THREE;

function lines(ctx,text,x,y,width,leading) {
  let line='';
  for(const word of text.split(' ')){
    const next=line ? line+' '+word : word;
    if(line && ctx.measureText(next).width>width){ctx.fillText(line,x,y);y+=leading;line=word;}
    else line=next;
  }
  ctx.fillText(line,x,y);
}

export async function boards(world) {
  const art=new Image();art.src='assets/archive.webp';await art.decode();
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=660;
  const c=canvas.getContext('2d'),tex=new T.CanvasTexture(canvas);
  tex.colorSpace=T.SRGBColorSpace;
  const group=new T.Group();group.name='Marcadores';
  const front=new T.MeshBasicMaterial({map:tex,toneMapped:false});
  const housing=new T.MeshBasicMaterial({color:0x192526});
  const emitters=[],white=new T.Color('#d6e5ef'),tint=new T.Color();
  const sample=document.createElement('canvas');sample.width=sample.height=1;
  const sampler=sample.getContext('2d',{willReadFrequently:true});
  for(let n=0;n<4;n++){
    const a=n*Math.PI/2;
    const screen=new T.Mesh(new T.BoxGeometry(7.1,3.06,.13),[housing,housing,housing,housing,front,housing]);
    // South board hangs above the 3.16 m tunnel roof, on shorter hangers.
    screen.position.set(Math.sin(a)*8.2,n===2?5.02:3.32,-Math.cos(a)*8.2);
    screen.rotation.y=-a;group.add(screen);
    const spill=new T.PointLight(white,0,15,2);spill.name='Luz de televisor';spill.visible=false;
    spill.position.set(0,-.18,.52);screen.add(spill);emitters.push(spill);
  }
  world.add(group);
  let brightness=7;
  return {
    glow(level){for(const light of emitters){light.intensity=level*brightness;light.visible=level>0;}},
    set(label,headline,sub='',card=null) {
      group.visible=true;
      c.fillStyle=card?'#0b1b1e':'#132724';c.fillRect(0,0,1536,660);
      if(card){
        const sw=art.naturalWidth/2,sh=art.naturalHeight/2;
        c.drawImage(art,(card.art%2)*sw,Math.floor(card.art/2)*sh,sw,sh,0,0,945,660);
        c.fillStyle='#afc6b6';c.font='bold 34px Arial';c.fillText(card.place,980,90);
        c.fillStyle='#f5f0e2';c.font='bold 58px Georgia';lines(c,card.caption,980,216,518,69);
        c.font='29px Arial';c.fillStyle='#b8c7bf';
        if(card.credit)lines(c,card.credit,980,476,512,35);
        c.fillText(card.source,980,613);
      }else{
        c.fillStyle='#dcb472';c.fillRect(0,0,1536,13);c.font='bold 40px Arial';c.fillText(label,65,101);
        c.fillStyle='#f3eee2';c.font='bold 116px Georgia';lines(c,headline,62,330,1410,120);
        c.fillStyle='#c6d6c9';c.font='46px Arial';c.fillText(sub,65,573);
      }
      sampler.drawImage(canvas,0,0,1,1);
      const [r,g,b]=sampler.getImageData(0,0,1,1).data;
      tint.setRGB(r/255,g/255,b/255,T.SRGBColorSpace).lerp(white,.48);
      brightness=6+(r*.21+g*.72+b*.07)/24;
      for(const light of emitters)light.color.copy(tint);
      tex.needsUpdate=true;
    },off(){group.visible=false;for(const light of emitters){light.intensity=0;light.visible=false;}}
  };
}
