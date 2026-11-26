import {createWorld} from './world.js';
import {archive} from './archive.js';
import {strikes,glovePose,animatedWrist,trackedWrist} from './strikes.js';
import {Sound} from './audio.js';

const $=s=>document.querySelector(s), T=globalThis.AFRAME?.THREE;
const sound=new Sound(), keys=new Set(), grips=new Set();
const names=['La entrada','El combate','La victoria','El silencio','Lo que no viste','Reflexión final'];
const round=38,cardTime=8.5,lessonTime=6;
const lessons=[
  [['Mouse','Mirá alrededor del estadio'],['Mirá alrededor','Girando la cabeza podés explorar el estadio']],
  [['W A S D','Probá dar unos pasos por el túnel'],['Stick izquierdo','Probá dar unos pasos por el túnel']],
  [['Clic izquierdo / derecho','Izquierdo: jab · Derecho: uppercut. Combiná dos y recuperá.'],['Jab / Uppercut','Al frente o hacia arriba. Gatillos izq./der. Combiná dos y recuperá.']],
  [['Espacio','Mantenelo apretado para subir la guardia'],['Agarre','Mantenelo apretado o acercá los guantes a la cara']],
  [['P','Pausá la partida cuando lo necesites'],['Esquivá con el cuerpo','Cuando el rival cargue el golpe, inclinate o agachate']]
];
const invitation=lessons.length*lessonTime;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n,0,1);return n*n*(3-2*n);};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let w,stage=-1,time=0,running=false,paused=false,immersive=false,finished=false;
let entranceApplauded=false;
let dodges=0,lockedCycle=-1;
let strikeStart,strikeEnd,strikeAxis,relativeHead,otherEye;
let hits=0,blocks=0,attempt=-1,lastPunch=-1,lastCard=-1,noticeUntil=0;
let attacks=[null,null],lastType='jab',musicStarted=false,gestureReady=[false,false], axis=[0,0], snapReady=true, lastHit=-10, boardState='';
let head,forward,target,handPos,prevHands,velocity,headOrientation,offset,authoredQ,controllerQ,localHand;
let guardBlend=0,gripBlend=0,knuckle,delta;
let nextPunchAt=0,answerWeaveAt=-10;
const gestureArmed=[true,true];
function facePoint(i,out){
  out.set(i?.035:-.035,.097,.105);return w.impactTarget.localToWorld(out);
}
const guide='WASD para moverte, mouse para mirar, clic izquierdo para jab, clic derecho para uppercut y espacio para bloquear. P pausa la partida. Si el navegador libera el mouse, hacé clic en el ring para recuperarlo.';
const vrGuide='En VR, mirá alrededor y usá el stick izquierdo para moverte. El derecho gira por pasos. El juego reconoce el jab hacia adelante y el uppercut ascendente con cualquiera de las manos. También podés usar el gatillo izquierdo para jab o el derecho para uppercut. Levantá ambos guantes o mantené el agarre para bloquear. Cuando el rival prepare un golpe, inclinate a un lado o agachate. Al terminar el tutorial podés acercarte al ring con el stick o usar el gatillo cuando aparezca la invitación.';
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
function showVictoryQuestion(alpha){
  w.card.show('Ganaste. ¿Pero a qué costo?','YOU WON. BUT AT WHAT COST?',alpha,'question');
}
function transition(n){
  // The same question stays on screen across the blackout.
  if(n!==3)w.card.hide();
  stage=n;time=0;noticeUntil=0;$('#cue').textContent='';$('#stage').textContent=names[n];$('#clock').textContent='';$('#aim').hidden=n!==1;updateStats();
  $('#hud').classList.toggle('closing',n===5);$('#end-actions').hidden=true;
  if(n===0){
    musicStarted=false;sound.stopScore();sound.setApplause(null);guardBlend=gripBlend=0;gestureReady=[false,false];
    entranceApplauded=false;w.display.reset();w.card.darken(0);
    hits=blocks=dodges=0;nextPunchAt=0;answerWeaveAt=-10;lockedCycle=-1;finished=false;attempt=-1;lastPunch=-1;lastHit=-10;boardState='';attacks=[null,null];lastCard=-1;
    w.crowd.visible=true;w.rig.position.set(0,0,12);w.rig.rotation.y=0;const look=w.camera.components['look-controls'];
    look.yawObject.rotation.y=0;look.pitchObject.rotation.x=0;
    w.opponent.position.set(0,0,-.26);w.opponent.visible=true;w.opponent.rotation.set(0,0,0);w.ceremony.reset();
    w.belt.visible=false;w.credits.reset();w.gate.visible=false;w.confetti.visible=false;w.light(0);w.display.set('EN VIVO   /   CAMPEONATO MUNDIAL','El precio de la victoria','Dos esquinas. Un cinturón en juego.');
    sound.ambience(.23);
  }else if(n===1){
    if(!entranceApplauded){sound.setApplause('entry');entranceApplauded=true;}
    w.doors.forEach((door,i)=>door.position.x=(i?1:-1)*1.5);
    w.rig.position.set(0,0,1.05);w.opponent.position.set(0,0,-.2);w.gate.visible=true;
    lastPunch=-1;nextPunchAt=0;answerWeaveAt=-10;gestureArmed.fill(true);attacks=[null,null];sound.ambience(.41);sound.bell();w.display.set('TÍTULO MUNDIAL   /   ROUND FINAL','El cinturón está en juego','Jab · Uppercut · Bloqueo');
    tell('Round final por el título mundial',3);
  }else if(n===2){
    w.display.set('DECISIÓN DEL JURADO','¡Campeón del mundo!','El cinturón mundial es tuyo');sound.bell();sound.ambience(.44);sound.setApplause('title');
    w.opponent.visible=false;w.confetti.visible=!reduced;w.belt.visible=true;
    w.scene.camera.getWorldDirection(forward);w.ceremony.start(viewerPosition(head),forward);
    tell('Levantás el cinturón de campeón',3);
  }else if(n===3){
    w.crowd.visible=false;w.flashes.tick(0,3,reduced);w.confetti.visible=false;
    sound.setApplause(null);sound.ambience(0);w.display.off();w.light(1);w.card.darken(.28);
  }else if(n===4){lastCard=-1;
  }else if(n===5){
    w.scene.camera.getWorldDirection(forward);
    w.display.beginShutdown(viewerPosition(head),forward);
    sound.closeScore(9.15);
  }
}
function begin(){
  $('#modal').close();$('#lobby').hidden=true;$('#hud').hidden=false;paused=false;running=true;
  clearInput();sound.start().catch(()=>{});transition(0);if(!immersive)lock();w.scene.resize();
}
function finish(){
  sound.stopScore();finished=true;running=false;clearInput();if(document.pointerLockElement)document.exitPointerLock();
  if(immersive){w.credits.offerReplay();return;}
  w.credits.reset();$('#end-actions').hidden=false;$('#replay').focus({preventScroll:true});
}
function showSources(){
  const list=document.createElement('ul');
  for(const c of archive){const li=document.createElement('li'),a=document.createElement('a');a.href=c.url;a.target='_blank';a.rel='noopener';a.textContent=c.title+' · '+c.source;li.append(a,document.createTextNode(' — '+c.body));list.append(li);}
  modal('¿Qué quedó fuera de cámara?',[paragraph('El sportswashing usa el prestigio del deporte para mejorar una imagen pública. Estas investigaciones documentan los casos que viste en el estadio.'),list],[['Volver',()=>$('#sources').focus()]]);
}
function home(){sound.setApplause(null);sound.stopScore();running=false;finished=false;paused=false;sound.ambience(0);$('#hud').hidden=true;$('#lobby').hidden=false;clearInput();if(document.pointerLockElement)document.exitPointerLock();}
function togglePause(){
  if(!running||immersive)return;
  if(paused){paused=false;$('#modal').close();sound.ctx?.resume();lock();return;}
  paused=true;clearInput();sound.ctx?.suspend();if(document.pointerLockElement)document.exitPointerLock();
  modal('Pausa',[paragraph(guide),volumeControl()],[['Seguir jugando',togglePause],['Ir a portada',home]]);
}
$('#pause').onclick=togglePause;
$('#modal').addEventListener('cancel',e=>{if(paused||finished){e.preventDefault();if(paused)togglePause();else{e.target.close();$('#sources').focus();}}});
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
// Normalized position in one side-to-side evasion, shared by the animation and hit test.
function weaveProgress(){
  const phase=time%3.4,cycle=Math.floor(time/3.4);
  if((phase>=1.55&&phase<2.97)||time-lastHit<(lastType==='jab'?.34:.51))return -1;
  const reply=(time-answerWeaveAt)/.85;
  if(reply>=0&&reply<1)return reply;
  return cycle%3===1&&phase<1?phase:-1;
}
function connect(i,kind,physical,contactDistance=0){
  const reach=strikes[kind].range;
  viewerPosition(head);facePoint(i,target);
  w.scene.camera.getWorldDirection(forward);
  const weave=weaveProgress();
  if(weave>.18&&weave<.82){
    // A tracked glove can still catch the moving head if the player follows it precisely.
    if(!physical||w.hands[i].object3D.getWorldPosition(handPos).distanceTo(target)>.17)return;
  }
  const range=target.distanceTo(head),aim=target.sub(head).normalize().dot(forward);
  if(!physical&&(contactDistance>.175||range>reach+.04||aim<.72)){
    tell(range>reach?'Acercate un paso':aim<.72?'Mirá al rival':'El golpe pasó de largo',.55);return;
  }
  hits++;lastHit=time;lastType=kind;
  if(attacks[i].endsCombo)answerWeaveAt=time+(kind==='jab'?.34:.51);
  const phase=time%3.4;
  if(phase>=1.55&&phase<2.48)attempt=Math.floor(time/3.4);
  sound.contact(false,kind);updateStats();
  w.hands[i].components['tracked-controls']?.controller?.gamepad?.hapticActuators?.[0]?.pulse(kind==='jab'?.22:.37,65);
}
function punch(i,kind,physical=false){
  if(!running||paused||stage>1||stage<0||time<nextPunchAt)return;
  const previous=attacks[i];
  if(previous&&time-previous.start<strikes[previous.kind].recovery)return;
  const endsCombo=time-lastPunch<.80;
  nextPunchAt=time+(endsCombo?.94:.35);
  lastPunch=time;
  let goal=null;
  if(stage===1&&!physical){
    facePoint(i,target);viewerPosition(head);w.scene.camera.getWorldDirection(forward);
    delta.subVectors(target,head);
    if(delta.length()<=strikes[kind].range&&delta.normalize().dot(forward)>.75&&weaveProgress()<0)goal=target.clone();
  }
  attacks[i]={start:time,kind,goal,physical,endsCombo,resolved:physical||stage===0};
  if(physical&&stage===1)connect(i,kind,true);
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
  if(stage<=2&&!reduced){
    const energy=stage===2?1:stage===1?Math.max(.16,(time>round-10?.70:0),1-clamp((time-lastHit)/1.1,0,1)):entranceApplauded?.8:0;
    w.crowd.userData.animate(dt,energy);
  }
  const blocked=stage<=1&&guard();
  const blend=1-Math.exp(-dt*16);
  guardBlend+=((blocked?1:0)-guardBlend)*blend;
  gripBlend+=((blocked&&grips.size?1:0)-gripBlend)*blend;
  w.scene.camera.getWorldQuaternion(headOrientation);
  for(let i=0;i<2;i++){
    const tracked=stage!==5&&stage!==2&&!(stage===3&&time<.85);
    w.desk[i].visible=!immersive&&tracked;w.xr[i].visible=immersive&&tracked;
    const sign=i===0?-1:1,a=attacks[i],age=a?time-a.start:-1;
    const animated=stage<=1&&a&&!a.physical;
    const arrives=stage===1&&a&&!a.resolved&&age>=strikes[a.kind].contact;
    const poseAge=arrives?strikes[a.kind].contact:age;
    const kind=a?.kind||'jab',turn=glovePose(kind,animated?poseAge:-1,offset);
    offset.x*=sign;
    const desk=w.desk[i],xr=w.xr[i];
    desk.position.set(sign*(.235-.064*guardBlend),-.255+.164*guardBlend,-.407+.071*guardBlend).add(offset);
    animatedWrist(desk.quaternion,desk.position,sign,guardBlend,kind,turn);
    if(immersive){
      const controller=w.hands[i].object3D;
      controller.getWorldQuaternion(controllerQ).invert();
      xr.position.copy(offset).multiplyScalar(.67).applyQuaternion(headOrientation).applyQuaternion(controllerQ);
      trackedWrist(xr.quaternion,sign);
      if(gripBlend>.001){
        w.camera.object3D.localToWorld(localHand.copy(desk.position));
        xr.position.lerp(controller.worldToLocal(localHand),gripBlend);
      }
      authoredQ.copy(controllerQ).multiply(headOrientation).multiply(desk.quaternion);
      xr.quaternion.slerp(authoredQ,Math.max(turn,gripBlend));
    }
    const hand=immersive?xr:desk;
    if(animated&&a.goal&&poseAge<strikes[a.kind].keys.at(-1)[0]){
      const apex=strikes[a.kind].contact;
      const weight=poseAge<=apex?smooth((poseAge/apex-.30)/.70):1-smooth((poseAge-apex)/.15);
      hand.localToWorld(knuckle.set(0,.12,.012));
      hand.parent.worldToLocal(knuckle);
      hand.parent.worldToLocal(delta.copy(a.goal)).sub(knuckle).clampLength(0,immersive?.80:.55);
      hand.position.addScaledVector(delta,weight);
      if(!immersive)animatedWrist(hand.quaternion,hand.position,sign,guardBlend,kind,turn);
    }
    if(arrives){
      a.resolved=true;hand.localToWorld(knuckle.set(0,.12,.012));
      connect(i,a.kind,false,knuckle.distanceTo(facePoint(i,target)));
    }
  }
  w.poseArms(stage<=1,viewerPosition(head),headOrientation,immersive?w.xr:w.desk);
  if(stage===0){
    w.animateBoxer(dt,time%8>6.6?'Weave':'GuardFootwork',.86);
    const opening=smooth((time-invitation)/.90);
    w.doors.forEach((door,i)=>door.position.x=(i?1:-1)*1.5*opening);
    move(dt);
    if(time>=invitation&&!entranceApplauded&&w.rig.position.z<6.75){
      sound.setApplause('entry');entranceApplauded=true;
      w.display.set('EN VIVO   /   PRESENTACIÓN','¡Entra el aspirante!','Final por el campeonato mundial de boxeo');
    }
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
    if(time>=.85&&entranceApplauded){sound.setApplause(null,.65);entranceApplauded=false;}
    const cycle=Math.floor(time/3.4),phase=time%3.4;
    const p=viewerPosition(head),o=w.opponent.position;
    let dx=p.x-o.x,dz=p.z-o.z;const dist=Math.hypot(dx,dz)||.001;
    const committing=phase>=1.55&&phase<2.97;
    const weave=weaveProgress(),slipping=weave>=0;
    // Approach from outside, change angle beside the player, then step back to reset.
    const desiredRange=phase>=2.97?1.40:1.04;
    const radial=committing||slipping?0:clamp((dist-desiredRange)*1.85,-.68,1.14);
    const lateral=committing||slipping?0:(cycle%2?-.50:.50)*clamp(1.8-dist,.12,1);
    const speed=radial*dt,circle=lateral*dt;
    o.x=clamp(o.x+dx/dist*speed+dz/dist*circle,-2.6,2.6);
    o.z=clamp(o.z+dz/dist*speed-dx/dist*circle,-2.6,2.6);
    if(!committing||lockedCycle!==cycle)w.opponent.rotation.y=Math.atan2(dx,dz);o.y=0;
    const hitAge=time-lastHit,reactDuration=lastType==='jab'?.34:.51;

    if(phase>=1.55&&lockedCycle!==cycle){
      lockedCycle=cycle;
      strikeStart.copy(o);strikeStart.y+=1.44;
      strikeAxis.subVectors(head,strikeStart);
      const reach=Math.min(1.56,strikeAxis.length());
      strikeEnd.copy(strikeStart).addScaledVector(strikeAxis.normalize(),reach);
    }
    let motion,pace=1,strikeTime=null;
    if(committing){
      motion=cycle%2?'RearCross':cycle%4===2?'LeadArc':'LeadStraight';
      strikeTime=clamp((phase-1.55)/1.42,0,1);
    }else if(slipping){
      motion='Weave';strikeTime=(cycle%2?.5:0)+weave*.5;
    }else if(Math.abs(radial)>Math.abs(lateral)){
      motion=radial>0?'StepIn':'StepOut';pace=clamp(Math.abs(radial)/.64,.55,1.65);
    }else{
      motion=lateral>0?'CircleRight':'CircleLeft';pace=clamp(Math.abs(lateral)/.52,.55,1.4);
    }
    if(hitAge>=0&&hitAge<reactDuration){
      motion=lastType==='jab'?'ReactJab':'ReactUppercut';strikeTime=hitAge/reactDuration;
    }
    w.animateBoxer(dt,motion,pace,strikeTime);
    if(hitAge>.65&&phase>1.55&&phase<2.14)tell('El rival prepara un golpe',.32);
    if(phase>=2.48&&attempt!==cycle){attempt=cycle;
      if(clearsStrike(head)){dodges++;tell('Esquivaste',.8);}
      else if(blocked){blocks++;tell('Bloqueo',.8);sound.contact(true);}
      else{tell('El rival conecta',.8);sound.contact();}updateStats();
    }
    if(immersive){
      for(let j=0;j<2;j++){
        w.impactTarget.getWorldPosition(target);
        w.hands[j].object3D.getWorldPosition(handPos);
        const separation=handPos.distanceTo(target);
        if(separation>.43)gestureArmed[j]=true;
        localHand.copy(handPos);w.rig.worldToLocal(localHand);
        if(gestureReady[j]){
          velocity.copy(localHand).sub(prevHands[j]).divideScalar(Math.max(.008,dt)).applyQuaternion(w.rig.quaternion);
          const speed=velocity.length(),toward=forward.subVectors(target,handPos).normalize();
          const rising=velocity.y>.74&&velocity.y>Math.hypot(velocity.x,velocity.z)*.82;
          if(gestureArmed[j]&&speed>.95&&speed<10&&separation<.38&&velocity.dot(toward)>.20){
            gestureArmed[j]=false;punch(j,rising?'uppercut':'jab',true);
          }
        }
        prevHands[j].copy(localHand);gestureReady[j]=true;
      }
    }
    $('#clock').textContent='0:'+String(Math.max(0,Math.ceil(round-time))).padStart(2,'0');
    const clock=$('#clock').textContent;
    if(clock!==boardState){
      w.display.set('TÍTULO MUNDIAL   /   ROUND FINAL',time>=round-10?'Últimos diez segundos':'Campeonato mundial',clock);
      boardState=clock;
    }
    if(time>=round-10&&time-dt<round-10)tell('¡Diez segundos!',1);
    if(time>=round)transition(2);
  }else if(stage===2||stage===3){
    if(stage===2){
      w.ceremony.tick(time);w.confetti.position.y=-((time*.45)%1.5);
      if(time>=4.1)showVictoryQuestion(smooth((time-4.1)/.4));
      if(time>=8)transition(3);
    }else{
      w.ceremony.tick(time,true);
      if(time<4)showVictoryQuestion(smooth((4-time)/.8));
      else w.card.hide();
      if(time>=6.6&&!musicStarted){musicStarted=true;sound.startScore();}
      if(time>=11.5)transition(4);
    }
  }else if(stage===4){
    w.card.darken(0);
    w.display.glow(smooth(time/.55));
    const i=Math.floor(time/cardTime);if(i>=archive.length){transition(5);return;}
    if(i!==lastCard){if(i===0)sound.screensOn();const c=archive[i];w.display.set(c.place,c.title,'',c);lastCard=i;}
  }else if(stage===5){
    const lastLight=1-smooth((time-7.3)/1.5);
    const ink=1-smooth((time-7.85)/1.05);
    w.display.shutdown(time,lastLight);
    w.card.darken(.32*smooth(time/2.7)+.68*(1-lastLight),true);
    w.credits.show(smooth((time-2.65)/.95)*ink,smooth((time-4.25)/1.2),smooth((time-5.48)/.95)*ink,immersive);
    if(time>=5.48&&!$('#spoken').textContent)$('#spoken').textContent='Fair Play. El precio de la victoria.';
    if(time>=10)finish();
  }
}
function bind(){
  window.addEventListener('keydown',e=>{if(!running)return;if(e.code==='KeyP'&&!e.repeat){togglePause();return;}if(paused)return;
    if(['Space','KeyA','KeyS','KeyW','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);}});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!immersive&&!paused)togglePause();});
  document.addEventListener('mousemove',e=>{if(!running||paused||immersive||!document.pointerLockElement)return;
    const look=w.camera.components['look-controls'];look.yawObject.rotation.y-=e.movementX*.002;look.pitchObject.rotation.x=clamp(look.pitchObject.rotation.x-e.movementY*.002,-1.4,1.4);});
  w.scene.canvas.addEventListener('contextmenu',e=>{if(running)e.preventDefault();});
  w.scene.canvas.addEventListener('mousedown',e=>{if((e.button===0||e.button===2)&&running&&!paused&&!immersive){
    lock();punch(e.button===2?1:0,e.button===2?'uppercut':'jab');
  }});
  w.hands.forEach((h,i)=>{
    h.addEventListener('triggerdown',()=>{if(finished){begin();return;}if(running&&!paused&&stage===0&&time>=invitation){transition(1);return;}punch(i,i?'uppercut':'jab');});
    h.addEventListener('gripdown',()=>grips.add(i));h.addEventListener('gripup',()=>grips.delete(i));
    h.addEventListener('thumbstickmoved',e=>{const {x,y}=e.detail;if(!i)axis=[Math.abs(x)>.16?x:0,Math.abs(y)>.16?y:0];else if(Math.abs(x)<.3)snapReady=true;else if(Math.abs(x)>.75&&snapReady){w.rig.rotation.y-=Math.sign(x)*Math.PI/6;snapReady=false;}});
  });
  w.scene.addEventListener('exit-vr',()=>{immersive=false;clearInput();if(finished)finish();else if(running&&!paused)togglePause();});
  $('#start').onclick=begin;$('#replay').onclick=begin;$('#sources').onclick=showSources;$('#to-cover').onclick=home;
  $('#vr').onclick=async()=>{try{await w.scene.enterVR();immersive=!!w.scene.renderer.xr.isPresenting;if(!immersive)throw Error();begin();}catch{modal('El casco no inició la sesión',[paragraph('Comprobá la conexión del visor y el permiso de realidad virtual del navegador.')],[['Entendido']]);}};
}
async function init(){
  // Keep a working cover and instructions even when the device cannot create WebGL.
  try{
    if(!T)throw Error('Falta el motor 3D.');
    knuckle=new T.Vector3();delta=new T.Vector3();offset=new T.Vector3();authoredQ=new T.Quaternion();controllerQ=new T.Quaternion();localHand=new T.Vector3();
    strikeStart=new T.Vector3();strikeEnd=new T.Vector3();strikeAxis=new T.Vector3();relativeHead=new T.Vector3();otherEye=new T.Vector3();
    head=new T.Vector3();forward=new T.Vector3();target=new T.Vector3();handPos=new T.Vector3();prevHands=[new T.Vector3(),new T.Vector3()];velocity=new T.Vector3();headOrientation=new T.Quaternion();
    [w]=await Promise.all([createWorld(tick),sound.prepare()]);bind();
    $('#start').disabled=false;$('#start span').textContent='Entrar al ring';
    const headsetSupported=!!(navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false));$('#vr').hidden=!headsetSupported;
  }catch(error){console.error(error);$('#start').disabled=false;$('#start span').textContent='Reintentar carga';$('#start').onclick=()=>location.reload();$('.hero-copy p').textContent='No se pudo preparar el estadio. Abrí el juego en un navegador con WebGL y volvé a intentar.';}
}
init();
