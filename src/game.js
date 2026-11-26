import {createWorld} from './world.js';
import {archive} from './archive.js';
import {Sound} from './audio.js';

const $=s=>document.querySelector(s), T=globalThis.AFRAME?.THREE;
const sound=new Sound(), keys=new Set(), grips=new Set();
const names=['La entrada','El combate','La victoria','El silencio','Lo que no viste','Reflexión final'];
const round=38,cardTime=12,lessonTime=6;
const lessons=[
  [['Mouse','Mirá alrededor del estadio'],['Mirá alrededor','Girando la cabeza podés explorar el estadio']],
  [['W A S D','Probá dar unos pasos por el túnel'],['Stick izquierdo','Probá dar unos pasos por el túnel']],
  [['Clic izquierdo','Probá lanzar un golpe al aire'],['Gatillo','Probá un golpe al aire con cualquiera de los mandos']],
  [['Espacio','Mantenelo apretado para subir la guardia'],['Agarre','Mantenelo apretado o acercá los guantes a la cara']],
  [['P','Pausá la partida cuando lo necesites'],['Esquivá con el cuerpo','Cuando el rival cargue el golpe, inclinate o agachate']]
];
const invitation=lessons.length*lessonTime;
const beltRise=t=>smooth((t-1.5)/2.8);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n,0,1);return n*n*(3-2*n);};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let w,stage=-1,time=0,running=false,paused=false,immersive=false,finished=false;
let dodges=0,lockedCycle=-1;
let strikeStart,strikeEnd,strikeAxis,relativeHead,otherEye;
let hits=0,blocks=0,attempt=-1,lastPunch=-1,activeHand=0,lastCard=-1,noticeUntil=0,finStep=-1;
let attacks=[-10,-10], axis=[0,0], snapReady=true, lastHit=-10, boardState='';
let head,forward,target,handPos,prevHands,velocity,headOrientation;
const guide='WASD para moverte, mouse para mirar, clic izquierdo para golpear y espacio para bloquear. P pausa la partida. Si el navegador libera el mouse, hacé clic en el ring para recuperarlo.';
const vrGuide='En VR, mirá alrededor y usá el stick izquierdo para moverte. El derecho gira por pasos. Golpeá acercando un guante al rival o usá el gatillo. Levantá ambos guantes o mantené el agarre para bloquear. Cuando el rival prepare un golpe, inclinate a un lado o agachate. Al terminar el tutorial podés acercarte al ring con el stick o usar el gatillo cuando aparezca la invitación.';
function modal(title,body,buttons){
  const dialog=$('#modal');if(dialog.open)dialog.close();
  $('#modal-title').textContent=title;$('#modal-body').replaceChildren(...body);
  $('#modal-buttons').replaceChildren(...buttons.map(([label,fn],i)=>{const b=document.createElement('button');b.className=i?'secondary':'primary';b.textContent=label;b.onclick=()=>{dialog.close();fn?.();};return b;}));dialog.showModal();
}
function paragraph(text){const p=document.createElement('p');p.textContent=text;return p;}
function volumeControl(){
  const label=document.createElement('label'),slider=document.createElement('input'),value=document.createElement('output');
  label.className='volume-control';label.append('Volumen',slider,value);
  slider.type='range';slider.min=0;slider.max=100;slider.value=Math.round(100*sound.level);
  value.value=slider.value+' %';
  slider.oninput=()=>{sound.level=Number(slider.value)/100;value.value=slider.value+' %';sound.volume();};
  return label;
}
$('#help').onclick=()=>modal('Controles',[paragraph(guide),paragraph(vrGuide),volumeControl()],[['Entendido']]);
$('#audio').onclick=()=>{sound.enabled=!sound.enabled;sound.volume();$('#audio').setAttribute('aria-pressed',sound.enabled);$('#audio span:last-child').textContent=sound.enabled?'Sonido activado':'Sonido apagado';};
function lock(){if(!immersive&&w?.scene.canvas.requestPointerLock){try{w.scene.canvas.requestPointerLock()?.catch(()=>{});}catch{}}}
function clearInput(){keys.clear();grips.clear();axis=[0,0];}
function tell(text,seconds=2){$('#cue').textContent=text;noticeUntil=time+seconds;}
function updateStats(){$('#stats').textContent=stage===1?'Conectados '+hits+'   ·   Bloqueos '+blocks+'   ·   Esquivas '+dodges:'';}
function transition(n){
  stage=n;time=0;noticeUntil=0;w.card.hide();$('#cue').textContent='';$('#stage').textContent=names[n];$('#clock').textContent='';$('#aim').hidden=n!==1;updateStats();
  if(n===0){
    hits=blocks=dodges=0;lockedCycle=-1;finished=false;attempt=-1;lastPunch=-1;lastHit=-10;boardState='';attacks=[-10,-10];lastCard=-1;finStep=-1;
    w.crowd.visible=true;w.rig.position.set(0,0,12);w.rig.rotation.y=0;const look=w.camera.components['look-controls'];
    look.yawObject.rotation.y=0;look.pitchObject.rotation.x=0;
    w.opponent.position.set(0,0,-.26);w.opponent.visible=true;w.ref.position.set(1.58,0,-1.45);w.ref.rotation.y=-.45;w.ref.visible=true;w.refArm(0,true);
    w.belt.visible=false;w.badge.visible=false;w.gate.visible=false;w.confetti.visible=false;w.light(0);w.display.set('EN VIVO   /   FINAL','The Price of Victory','Ingresá al ring');
    sound.ambience(.23);
  }else if(n===1){
    w.rig.position.set(0,0,1.05);w.opponent.position.set(0,0,-.2);w.gate.visible=true;
    lastPunch=-1;attacks=[-10,-10];sound.ambience(.31);sound.bell();w.display.set('ROUND 01','La gran final','Gatillo o clic para golpear · Agarre o espacio para bloquear');
    tell('Acercate al rival · Clic para golpear · Espacio para bloquear',4);
  }else if(n===2){
    w.display.set('DECISIÓN DEL JURADO','¡Victoria!','Campeón de la final');sound.bell();sound.ambience(.55);
    w.opponent.visible=false;w.confetti.visible=!reduced;w.belt.visible=true;
    // Keep the presentation in front of the player's current heading.
    w.camera.object3D.getWorldDirection(forward);forward.negate();forward.y=0;forward.normalize();
    const side=new T.Vector3(-forward.z,0,forward.x);
    w.ref.position.copy(w.rig.position).addScaledVector(forward,1.20).addScaledVector(side,.72);
    w.ref.rotation.y=Math.atan2(-forward.x,-forward.z);
    tell('El árbitro te entrega el cinturón',3);
  }else if(n===3){
    w.crowd.visible=false;w.flashes.tick(0,3,reduced);w.ref.visible=false;w.confetti.visible=false;
    sound.ambience(0);w.display.off();w.light(1);
    w.card.show('Ganaste. ¿Pero a qué costo?','YOU WON. BUT AT WHAT COST?',1,'question');
  }else if(n===4){lastCard=-1;
  }else if(n===5){w.display.off();finStep=-1;}
}
function begin(){
  $('#modal').close();$('#lobby').hidden=true;$('#hud').hidden=false;paused=false;running=true;
  clearInput();sound.start().catch(()=>{});transition(0);if(!immersive)lock();w.scene.resize();
}
function finish(){
  finished=true;running=false;clearInput();if(document.pointerLockElement)document.exitPointerLock();
  if(immersive){w.display.set('FAIR PLAY','The Price of Victory','Gatillo para volver a jugar');return;}
  const list=document.createElement('ul');
  for(const c of archive){const li=document.createElement('li'),a=document.createElement('a');a.href=c.url;a.target='_blank';a.rel='noopener';a.textContent=c.title+' · '+c.source;li.append(a,document.createTextNode(' — '+c.body));list.append(li);}
  modal('¿Qué quedó fuera de cámara?',[paragraph('El sportswashing usa el prestigio del deporte para mejorar una imagen pública. Estas investigaciones documentan los casos que viste en el estadio.'),list],[['Volver a jugar',begin],['Ir a portada',home]]);
}
function home(){running=false;finished=false;paused=false;sound.ambience(0);$('#hud').hidden=true;$('#lobby').hidden=false;clearInput();if(document.pointerLockElement)document.exitPointerLock();}
function togglePause(){
  if(!running||immersive)return;
  if(paused){paused=false;$('#modal').close();sound.ctx?.resume();lock();return;}
  paused=true;clearInput();sound.ctx?.suspend();if(document.pointerLockElement)document.exitPointerLock();
  modal('Pausa',[paragraph(guide),volumeControl()],[['Seguir jugando',togglePause],['Ir a portada',home]]);
}
$('#pause').onclick=togglePause;
$('#modal').addEventListener('cancel',e=>{if(paused||finished){e.preventDefault();if(paused)togglePause();else{e.target.close();home();}}});
function viewerPosition(out){
  const eyes=immersive ? w.scene.renderer.xr.getCamera().cameras : null;
  if(eyes?.length){
    out.setFromMatrixPosition(eyes[0].matrixWorld);
    if(eyes[1])out.lerp(otherEye.setFromMatrixPosition(eyes[1].matrixWorld),.5);
  }else w.scene.camera.getWorldPosition(out);
  return out;
}
function clearsStrike(position){
  // Distance to the committed punch segment, including its finite reach.
  strikeAxis.subVectors(strikeEnd,strikeStart);
  relativeHead.subVectors(position,strikeStart);
  const fraction=clamp(relativeHead.dot(strikeAxis)/Math.max(.001,strikeAxis.lengthSq()),0,1);
  relativeHead.addScaledVector(strikeAxis,-fraction);
  return relativeHead.lengthSq()>.18*.18;
}
function punch(i,physical=false){
  if(!running||paused||(stage!==1&&stage!==0)||time-lastPunch<.27)return;
  lastPunch=time;attacks[i]=time;activeHand=i;
  if(stage===0)return;
  viewerPosition(head);w.opponent.getWorldPosition(target);target.y=head.y-.13;
  w.scene.camera.getWorldDirection(forward);
  const range=target.distanceTo(head),aim=target.sub(head).normalize().dot(forward);
  if(physical||(range<1.7&&aim>.59)){
    hits++;lastHit=time;sound.contact();tell('Golpe conectado',.65);updateStats();
    w.hands[i].components['tracked-controls']?.controller?.gamepad?.hapticActuators?.[0]?.pulse(.25,70);
  }else{tell(range>=1.7?'Acercate un paso':'Mirá al rival',.7);}
}
function guard(){
  if(keys.has('Space')||grips.size)return true;
  if(!immersive)return false;
  viewerPosition(head);
  return w.hands.every(hand=>{hand.object3D.getWorldPosition(handPos);return handPos.distanceTo(head)<.48&&handPos.y>head.y-.32;});
}
function move(dt){
  let x=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+axis[0],z=Number(keys.has('KeyS'))-Number(keys.has('KeyW'))+axis[1];
  const norm=Math.max(1,Math.hypot(x,z));x/=norm;z/=norm;
  w.scene.camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  w.rig.position.x+=(-forward.z*x-forward.x*z)*1.55*dt;w.rig.position.z+=(forward.x*x-forward.z*z)*1.55*dt;
  const bound=stage===0?1.05:2.68;
  w.rig.position.x=clamp(w.rig.position.x,-bound,bound);w.rig.position.z=clamp(w.rig.position.z,stage===0?(time<invitation?7.62:.88):-2.68,stage===0?13.3:2.68);
}
function tick(dt){
  if(!w||!running||paused||document.hidden)return;
  time+=dt;if(time>noticeUntil)$('#cue').textContent='';
  w.flashes.tick(dt,stage,reduced);
  const blocked=stage<=1&&guard();
  for(let i=0;i<2;i++){
    w.desk[i].visible=!immersive;w.xr[i].visible=immersive;
    const sign=i===0?-1:1,age=time-attacks[i],extend=stage<=1&&age>=0&&age<.32?Math.sin(age/.32*Math.PI):0;
    const lift=stage===2 ? beltRise(time) : 0;
    w.desk[i].position.set(sign*((blocked?.13:.245)+lift*.105),-.29+(blocked?.18:0)+lift*.40,-.44-.43*extend-lift*.36);
    w.desk[i].rotation.x=-.43-.49*extend;w.xr[i].rotation.x=-.8;
  }
  if(stage===0){
    const opening=smooth((time-1.5)/3);
    w.doors.forEach((door,i)=>door.position.x=(i?1:-1)*1.5*opening);
    move(dt);
    if(time<invitation){
      const index=Math.floor(time/lessonTime),local=time%lessonTime;
      const alpha=Math.min(smooth(local/.65),smooth((lessonTime-local)/.85));
      const [key,action]=lessons[index][immersive?1:0];
      w.card.show(key,action,alpha);
    }else{
      const age=time-invitation;
      if(age<4.5)w.card.show('Avanzá al ring',immersive?'Usá el stick izquierdo o pulsá el gatillo para entrar':'Caminá hacia el ring con W',Math.min(smooth(age/.6),smooth((4.5-age)/.8)));
      else if(immersive&&age%14<4){
        w.card.show('Avanzá al ring','Stick izquierdo o gatillo',smooth((4-age%14)/.7));
      }else {
        w.card.hide();
        if(!$('#cue').textContent)tell('Avanzá por el pasillo hasta el ring',4);
      }
      if(w.rig.position.z<=1.14)transition(1);
    }
  }else if(stage===1){
    move(dt);
    const cycle=Math.floor(time/3.4),phase=time%3.4,i=cycle%2;
    const p=viewerPosition(head),o=w.opponent.position;
    let dx=p.x-o.x,dz=p.z-o.z;const dist=Math.hypot(dx,dz)||.001;
    const committing=phase>=1.55&&phase<2.81;
    const speed=committing?0:clamp(dist-1.13,-.9,1.1)*dt;
    o.x=clamp(o.x+dx/dist*speed+(committing?0:Math.cos(time*2.1)*dt*.16),-2.6,2.6);o.z=clamp(o.z+dz/dist*speed,-2.6,2.6);
    if(!committing||lockedCycle!==cycle)w.opponent.rotation.y=Math.atan2(dx,dz);o.y=.025*Math.sin(time*5);
    const reaction=clamp((time-lastHit)/.32,0,1);
    w.opponent.rotation.x=-.13*Math.sin(reaction*Math.PI);
    if(phase>=1.55&&lockedCycle!==cycle){
      lockedCycle=cycle;
      strikeStart.copy(o);strikeStart.y+=1.44;
      strikeAxis.subVectors(head,strikeStart);
      const reach=Math.min(1.56,strikeAxis.length());
      strikeEnd.copy(strikeStart).addScaledVector(strikeAxis.normalize(),reach);
    }
    const swing=phase>2.15&&phase<2.81?Math.sin((phase-2.15)/.66*Math.PI):0;
    const windup=phase>=1.55&&phase<2.15?Math.sin((phase-1.55)/.6*Math.PI):0;
    w.fists.forEach((arm,n)=>{
      arm.upper(n===i ? windup*.22-swing*1.15 : .035*Math.sin(time*4));
      arm.fore(n===i ? swing*1.87-windup*.26 : 0);
    });
    if(phase>1.55&&phase<2.14)tell('El rival prepara un golpe',.32);
    if(phase>=2.48&&attempt!==cycle){attempt=cycle;
      if(clearsStrike(head)){dodges++;tell('Esquivaste',.8);}
      else if(blocked){blocks++;tell('Bloqueo',.8);sound.contact(true);}
      else{tell('El rival conecta',.8);sound.contact();}updateStats();
    }
    if(immersive){
      for(let j=0;j<2;j++){w.hands[j].object3D.getWorldPosition(handPos);
        velocity.copy(handPos).sub(prevHands[j]);const speed=velocity.length()/Math.max(.008,dt);
        target.copy(o);target.y+=1.46;
        if(speed>1.05&&handPos.distanceTo(target)<.42&&velocity.dot(target.sub(handPos))>0)punch(j,true);
        prevHands[j].copy(handPos);
      }
    }
    $('#clock').textContent='0:'+String(Math.max(0,Math.ceil(round-time))).padStart(2,'0');
    const score=$('#clock').textContent+'   /   '+hits+' conectados   ·   '+blocks+' bloqueos   ·   '+dodges+' esquivas';
    if(immersive){
      const alert=phase>=1.55&&phase<2.15?'El rival carga el golpe':($('#cue').textContent==='Esquivaste'?'¡Esquivaste!':'La gran final');
      const broadcast=alert+score;
      if(broadcast!==boardState){w.display.set('ROUND 01',alert,score);boardState=broadcast;}
    }
    if(time>=round)transition(2);
  }else if(stage===2||stage===3){
    if(stage===2){
      w.refArm(-beltRise(time)*2.35,true);w.confetti.position.y=-((time*.45)%1.5);
      if(time>=8)transition(3);
    }else{
      if(time<4)w.card.show('Ganaste. ¿Pero a qué costo?','YOU WON. BUT AT WHAT COST?',smooth((4-time)/.8),'question');
      else w.card.hide();
      if(time>=11.5)transition(4);
    }
  }else if(stage===4){
    const i=Math.floor(time/cardTime);if(i>=archive.length){transition(5);return;}
    if(i!==lastCard){const c=archive[i];w.display.set(c.place,c.title,'',c);lastCard=i;}
  }else if(stage===5){
    if(time>=1.5&&finStep<0){finStep=1;w.display.set('FAIR PLAY','The Price of Victory');w.badge.visible=true;}
    if(time>=9)finish();
  }
  if(w.belt.visible){
    const cam=w.scene.camera;cam.getWorldPosition(head);cam.getWorldQuaternion(headOrientation);
    if(stage===2){
      // Both modalities see the trophy handed forward, then raised above eye level.
      const lift=beltRise(time);
      target.set(0,-.44+.62*lift,-.88).applyQuaternion(headOrientation);
      w.belt.position.copy(head).add(target);w.belt.quaternion.copy(headOrientation);w.belt.rotateX(-.18);
    }else if(immersive){
      w.hands[0].object3D.getWorldPosition(w.belt.position);w.hands[0].object3D.getWorldQuaternion(w.belt.quaternion);
      w.belt.translateY(-.10);w.belt.translateZ(-.10);
    }else{
      target.set(-.13,-.43,-.62).applyQuaternion(headOrientation);w.belt.position.copy(head).add(target);w.belt.quaternion.copy(headOrientation);w.belt.rotateX(-.3);
    }
    if(w.badge.visible){w.badge.position.copy(head).add(target.set(0,.17,-2.7).applyQuaternion(headOrientation));w.badge.quaternion.copy(headOrientation);}
  }
}
function bind(){
  window.addEventListener('keydown',e=>{if(!running)return;if(e.code==='KeyP'&&!e.repeat){togglePause();return;}if(paused)return;
    if(['Space','KeyA','KeyS','KeyW','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);}});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!immersive&&!paused)togglePause();});
  document.addEventListener('mousemove',e=>{if(!running||paused||immersive||!document.pointerLockElement)return;
    const look=w.camera.components['look-controls'];look.yawObject.rotation.y-=e.movementX*.002;look.pitchObject.rotation.x=clamp(look.pitchObject.rotation.x-e.movementY*.002,-1.4,1.4);});
  w.scene.canvas.addEventListener('mousedown',e=>{if(e.button===0&&running&&!paused&&!immersive){lock();punch(1-activeHand);}});
  w.hands.forEach((h,i)=>{
    h.addEventListener('triggerdown',()=>{if(finished){begin();return;}if(running&&!paused&&stage===0&&time>=invitation){transition(1);return;}punch(i);});
    h.addEventListener('gripdown',()=>grips.add(i));h.addEventListener('gripup',()=>grips.delete(i));
    h.addEventListener('thumbstickmoved',e=>{const {x,y}=e.detail;if(!i)axis=[Math.abs(x)>.16?x:0,Math.abs(y)>.16?y:0];else if(Math.abs(x)<.3)snapReady=true;else if(Math.abs(x)>.75&&snapReady){w.rig.rotation.y-=Math.sign(x)*Math.PI/6;snapReady=false;}});
  });
  w.scene.addEventListener('exit-vr',()=>{immersive=false;clearInput();if(finished)finish();else if(running&&!paused)togglePause();});
  $('#start').onclick=begin;
  $('#vr').onclick=async()=>{try{await w.scene.enterVR();immersive=!!w.scene.renderer.xr.isPresenting;if(!immersive)throw Error();begin();}catch{modal('El casco no inició la sesión',[paragraph('Comprobá la conexión del visor y el permiso de realidad virtual del navegador.')],[['Entendido']]);}};
}
async function init(){
  // Keep a working cover and instructions even when the device cannot create WebGL.
  try{
    if(!T)throw Error('Falta el motor 3D.');
    strikeStart=new T.Vector3();strikeEnd=new T.Vector3();strikeAxis=new T.Vector3();relativeHead=new T.Vector3();otherEye=new T.Vector3();
    head=new T.Vector3();forward=new T.Vector3();target=new T.Vector3();handPos=new T.Vector3();prevHands=[new T.Vector3(),new T.Vector3()];velocity=new T.Vector3();headOrientation=new T.Quaternion();
    [w]=await Promise.all([createWorld(tick),sound.prepare()]);bind();
    $('#start').disabled=false;$('#start span').textContent='Entrar al ring';
    const headsetSupported=!!(navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false));$('#vr').hidden=!headsetSupported;
  }catch(error){console.error(error);$('#start').disabled=false;$('#start span').textContent='Reintentar carga';$('#start').onclick=()=>location.reload();$('.hero-copy p').textContent='No se pudo preparar el estadio. Abrí el juego en un navegador con WebGL y volvé a intentar.';}
}
init();
