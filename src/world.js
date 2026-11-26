import {victoryCeremony} from './ceremony.js';
import {boards} from './boards.js';
import {centerCard,photographers} from './presentation.js';
import {crowdFromStands} from './stands.js';
const T=AFRAME.THREE;
function entity(tag,parent,attrs={}) {
  const el=document.createElement(tag);
  for(const [key,val] of Object.entries(attrs))el.setAttribute(key,val);
  parent.append(el);return el;
}
function model(parent,name){
  return new Promise((resolve,reject)=>{
    const el=document.createElement('a-entity');
    el.addEventListener('model-loaded',()=>resolve(el.getObject3D('mesh')),{once:true});
    el.addEventListener('model-error',()=>reject(new Error('No se pudo cargar '+name)),{once:true});
    el.setAttribute('gltf-model','url(assets/'+name+'.glb)');parent.append(el);
  });
}
function boxerMotion(model){
  const mixer=new T.AnimationMixer(model);
  const clip=model.animations.find(a=>a.name==='GuardFootwork')||model.animations[0];
  const guard=mixer.clipAction(clip);guard.play();
  const upper=['L','R'].map(s=>model.getObjectByName('Drive'+s));
  const fore=['L','R'].map(s=>model.getObjectByName('Fore'+s));
  const chest=model.getObjectByName('Chest'),head=model.getObjectByName('Head');
  // Restore the keyed arm pose before advancing the mixer and adding this strike.
  const layered=[chest,head,...upper,...fore],base=layered.map(b=>b.quaternion.clone());
  return (dt,side=0,load=0,reach=0,hit=0,pace=1)=>{
    layered.forEach((b,i)=>b.quaternion.copy(base[i]));
    mixer.update(dt*pace);
    layered.forEach((b,i)=>base[i].copy(b.quaternion));
    const sign=side===0?1:-1;
    chest.rotateY(sign*(.26*load-.46*reach));chest.rotateX(.10*reach-.20*hit);
    head.rotateY(sign*(.15*reach-.10*load));head.rotateZ(.14*hit*sign);
    upper[side].rotateX(.25*load-1.48*reach);upper[side].rotateY(sign*.22*reach);
    fore[side].rotateX(2.10*reach-.25*load);
    upper[1-side].rotateX(-.17*(load+reach));fore[1-side].rotateX(-.15*reach);
  };
}
export async function createWorld(tick) {
  AFRAME.registerComponent('match-loop',{tick(t,dt){if(dt)tick(Math.min(dt/1000,.12));}});
  const scene=document.createElement('a-scene');
  scene.setAttribute('embedded','');scene.setAttribute('match-loop','');scene.setAttribute('loading-screen','enabled:false');
  scene.setAttribute('device-orientation-permission-ui','enabled:false');scene.setAttribute('xr-mode-ui','enabled:false');
  scene.setAttribute('renderer','antialias:true; colorManagement:true; highRefreshRate:true');
  scene.setAttribute('light','defaultLightsEnabled:false');
  scene.setAttribute('webxr','referenceSpaceType: local-floor; optionalFeatures: bounded-floor, local-floor');
  scene.setAttribute('background','color: #172324');scene.setAttribute('fog','type: exponential; color:#172324; density:.018');
  const rig=entity('a-entity',scene,{id:'rig'}),camera=entity('a-entity',rig,{camera:'near:.04;far:100;fov:75','look-controls':'pointerLockEnabled:false; touchEnabled:true',position:'0 1.65 0'});
  const hands=['left','right'].map(hand=>entity('a-entity',rig,{'laser-controls':'hand:'+hand,'raycaster':'enabled:false','line':'visible:false'}));
  document.querySelector('#game').append(scene);
  if(!scene.hasLoaded)await new Promise(resolve=>scene.addEventListener('loaded',resolve,{once:true}));
  const [arena,opponent,glove,belt]=await Promise.all(['arena','opponent','glove','belt'].map(n=>model(scene,n)));
  const world=scene.object3D;
  const ribbon=arena.getObjectByName('Ribbon');
  const ambient=new T.HemisphereLight(0xffecdb,0x6b7471,2.1), key=new T.DirectionalLight(0xffdbad,2.8),rim=new T.DirectionalLight(0x97d7ee,1.9);
  key.position.set(3,7,4);rim.position.set(-4,4,-3);world.add(ambient,key,rim);
  const crowd=crowdFromStands();world.add(crowd);glove.visible=false;belt.visible=false;
  const armParts=['VictoryUpper','VictoryForearm'].map(name=>glove.getObjectByName(name).removeFromParent());
  const attachGlove=(parent,i)=>{
    const g=glove.clone(true);g.visible=true;g.scale.x=i?1:-1;parent.add(g);g.rotation.set(-.36,0,i?-.14:.14);return g;
  };
  const desk=[0,1].map(i=>attachGlove(camera.object3D,i));
  const xr=hands.map((hand,i)=>attachGlove(hand.object3D,i));
  for(const hand of hands)hand.addEventListener('controller-model-ready',()=>{const mesh=hand.getObject3D('mesh');if(mesh)mesh.visible=false;});
  const ceremony=victoryCeremony(scene,glove,belt,armParts);
  const animateBoxer=boxerMotion(opponent);
  const display=await boards(world);
  const card=centerCard(scene.camera),flashes=photographers(world);
  crowd.name='Afición';belt.name='Cinturón';
  const stars=new Float32Array(120*3);
  for(let i=0;i<120;i++){const a=i*2.39996,r=1.5+(i%17)*.30;stars.set([Math.cos(a)*r,2+(i%19)*.17,Math.sin(a)*r],i*3);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(stars,3));
  const confetti=new T.Points(geo,new T.PointsMaterial({color:0xf8d785,size:.045}));world.add(confetti);confetti.visible=false;
  const badge=new T.Mesh(new T.PlaneGeometry(1.85,.52),new T.MeshBasicMaterial({map:await new T.TextureLoader().loadAsync('assets/fairplay.png'),transparent:true,depthWrite:false}));
  badge.material.map.colorSpace=T.SRGBColorSpace;world.add(badge);badge.visible=false;
  const lamps=arena.getObjectByName('Lamps'),lampMats=[];
  lamps?.traverse(n=>{if(n.isMesh)lampMats.push(...[n.material].flat());});
  const lightColor=new T.Color(),warm=new T.Color('#fff0d6'),cold=new T.Color('#809cae');
  const skyA=new T.Color('#172324'),skyB=new T.Color('#081119');
  return {scene,rig:rig.object3D,camera,hands,desk,xr,arena,opponent,ceremony,animateBoxer,belt,crowd,display,confetti,badge,card,flashes,
    gate:arena.getObjectByName('Gate'),doors:[arena.getObjectByName('DoorL'),arena.getObjectByName('DoorR')],
    light(mix){key.intensity=2.8-2.35*mix;ambient.intensity=2.1-1.15*mix;rim.intensity=1.9-1.3*mix;
      ambient.color.copy(lightColor.copy(warm).lerp(cold,mix));world.background?.copy(skyA).lerp(skyB,mix);if(world.fog)world.fog.color.copy(world.background);
      lampMats.forEach(m=>{m.emissiveIntensity=2*(1-mix);});if(lamps)lamps.visible=mix<.92;
      if(ribbon)ribbon.visible=mix<.35;

    }};
}
