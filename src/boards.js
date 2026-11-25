const T = AFRAME.THREE;
function wrap(ctx, text, x, y, width, lineHeight) {
  let line='';
  for (const word of text.split(' ')) {
    const next=line ? line+' '+word : word;
    if (line && ctx.measureText(next).width>width) {ctx.fillText(line,x,y); y+=lineHeight;line=word;}
    else line=next;
  }
  ctx.fillText(line,x,y);
}
function drawIcon(c,kind) {
  c.save();c.translate(100,237);c.strokeStyle='#afc4b5';c.lineWidth=7;c.lineJoin='round';c.lineCap='round';c.beginPath();
  if(kind==='helmet'){c.arc(0,0,48,Math.PI,2*Math.PI);c.lineTo(54,8);c.lineTo(-54,8);c.closePath();c.moveTo(-9,-45);c.lineTo(-9,-17);c.moveTo(9,-45);c.lineTo(9,-17);}
  if(kind==='house'){c.moveTo(-56,1);c.lineTo(0,-47);c.lineTo(56,1);c.moveTo(-38,-9);c.lineTo(-38,44);c.lineTo(37,44);c.lineTo(37,-9);c.moveTo(-8,44);c.lineTo(-8,15);c.lineTo(10,15);c.lineTo(10,44);}
  if(kind==='microphone'){c.roundRect(-19,-55,38,73,18);c.moveTo(-35,-10);c.arc(0,-10,35,Math.PI,0,true);c.moveTo(0,26);c.lineTo(0,47);c.moveTo(-18,47);c.lineTo(18,47);}
  if(kind==='voice'){for(let i=-3;i<=3;i++){const h=[12,23,38,53,31,24,10][i+3];c.moveTo(i*15,-h);c.lineTo(i*15,h);}}
  c.stroke();c.restore();
}
export function boards(world) {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=440;
  const c=canvas.getContext('2d'), tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  const group=new T.Group(),mat=new T.MeshBasicMaterial({map:tex,toneMapped:false});
  for(let n=0;n<4;n++){
    const a=n*Math.PI/2,screen=new T.Mesh(new T.BoxGeometry(7.1,3.06,.13),mat);
    screen.position.set(Math.sin(a)*8.2,3.32,-Math.cos(a)*8.2);screen.rotation.y=-a;group.add(screen);
  }
  world.add(group);
  return {
    set(label,headline,sub='',card=null){group.visible=true;c.fillStyle=card?'#122326':'#132724';c.fillRect(0,0,1024,440);
      c.fillStyle=card?'#9bb5a5':'#e1b26a';c.fillRect(0,0,1024,9);c.font='bold 29px Arial';c.fillText(label,44,66);
      if(card){drawIcon(c,card.icon);c.fillStyle='#f1f2e8';c.font='bold 52px Georgia';c.fillText(headline,187,145);c.font='32px Arial';wrap(c,card.body,187,205,790,40);c.font='bold 24px Arial';c.fillStyle='#a9c6b5';c.fillText(card.source,187,404);}
      else{c.fillStyle='#f3eee2';c.font='bold 76px Georgia';wrap(c,headline,44,207,937,81);c.fillStyle='#c6d6c9';c.font='32px Arial';c.fillText(sub,47,376);}
      tex.needsUpdate=true;
    }, off(){group.visible=false;}
  };
}
