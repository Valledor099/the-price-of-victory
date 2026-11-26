import {rowCount,seatHeight,seatRadius} from './stands.js';
const T=AFRAME.THREE;

// One camera-facing surface for both stereo and desktop. Redraw only on cue changes.
export function centerCard(camera) {
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=336;
  const ctx=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,fog:false});
  const panel=new T.Mesh(new T.PlaneGeometry(1.55,.407),mat);
  panel.position.set(0,.035,-1.9);panel.renderOrder=25;panel.visible=false;camera.add(panel);
  panel.name='Guía central';
  const shade=new T.Mesh(new T.SphereGeometry(2.5,12,8),new T.MeshBasicMaterial({
    color:0x030606,side:T.BackSide,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,fog:false
  }));
  shade.name='Oscuridad del estadio';shade.visible=false;shade.renderOrder=24;camera.add(shade);
  let last='';
  return {
    darken(alpha){shade.material.opacity=alpha;shade.visible=alpha>.001;},
    show(key,action,alpha=1,style='lesson') {
      if(key!==last){
        last=key;panel.userData.cue=key;
        ctx.clearRect(0,0,1280,336);
        panel.scale.setScalar(style==='question'?1.48:1);
        panel.position.y=style==='question'?0:.035;
        ctx.save();
        if(style==='question'){
          const vignette=ctx.createRadialGradient(640,168,48,640,168,624);
          vignette.addColorStop(0,'rgba(5,12,15,.81)');vignette.addColorStop(1,'rgba(5,12,15,0)');
          ctx.fillStyle=vignette;ctx.fillRect(0,0,1280,336);ctx.textAlign='center';
          ctx.shadowColor='#020809';ctx.shadowBlur=9;ctx.fillStyle='#ffd04e';
          ctx.font='bold 108px Georgia';ctx.fillText(key,640,182,1200);
          ctx.font='bold 30px Arial';ctx.fillStyle='#edc878';ctx.fillText(action,640,252);
        }else{
          ctx.fillStyle='rgba(5,16,20,.93)';
          ctx.beginPath();ctx.roundRect(60,26,1160,284,18);ctx.fill();
          ctx.fillStyle='#aac5b5';ctx.fillRect(594,61,92,4);ctx.textAlign='center';
          ctx.font='bold 66px Arial';ctx.fillStyle='#fcf7e9';ctx.fillText(key,640,157,1050);
          ctx.font='40px Arial';ctx.fillStyle='#d0dbd3';ctx.fillText(action,640,241,1090);
        }
        ctx.restore();texture.needsUpdate=true;
        document.querySelector('#spoken').textContent=key+'. '+action;
      }
      mat.opacity=Math.min(1,Math.max(0,alpha));panel.visible=mat.opacity>.015;
    },
    hide(){if(!last)return;panel.visible=false;last='';delete panel.userData.cue;document.querySelector('#spoken').textContent='';}
  };
}

// Local bursts from individual seats and ringside photographers, with no camera-wide flash.
export function photographers(world) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const c=canvas.getContext('2d'),g=c.createRadialGradient(48,48,0,48,48,47);
  g.addColorStop(0,'#ffffff');g.addColorStop(.18,'#fffff5');g.addColorStop(.39,'rgba(211,235,255,.93)');g.addColorStop(1,'rgba(127,180,229,0)');
  c.fillStyle=g;c.fillRect(0,0,96,96);c.fillStyle='rgba(255,255,251,.80)';c.fillRect(46,12,4,72);c.fillRect(14,46,68,4);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const group=new T.Group();group.name='Flashes de tribuna';world.add(group);
  const sprites=Array.from({length:32},()=>{
    const sprite=new T.Sprite(new T.SpriteMaterial({map,fog:false,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
    group.add(sprite);sprite.visible=false;return sprite;
  });
  let until=0,sequence=0;
  return {
    tick(dt,stage,reduced) {
      group.visible=stage<=2&&!reduced;
      if(!group.visible)return;
      until-=dt;
      if(until<=0){
        sequence++;
        until=.46+Math.random()*.31;
        const burst=16+Math.floor(Math.random()*13);
        for(let i=0;i<burst;i++){
          const s=sprites[i],row=Math.floor(Math.random()*rowCount),a=(i+Math.random())*2*Math.PI/burst,r=seatRadius(row)-.40;
          s.position.set(Math.cos(a)*r,seatHeight(row)+1.03,Math.sin(a)*r);
          if(stage===0&&i===0)s.position.set((sequence%2?1:-1)*(.85+Math.random()*.65),1.45,3.9+Math.random()*2);
          s.scale.setScalar((stage===0&&i===0?.63:1.85)+Math.random()*1.05);s.userData.age=-Math.random()*.26;s.visible=false;
        }
      }
      for(const s of sprites){
        if(s.userData.age===undefined)continue;s.userData.age+=dt;
        const age=s.userData.age;s.visible=age>=0&&age<.24;
        if(s.visible)s.material.opacity=Math.min(1,1.55*Math.exp(-age*10));
      }
    }
  };
}
