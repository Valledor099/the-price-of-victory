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
  const actions=new Map(model.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
  let current=actions.get('GuardFootwork');
  current.play();
  const chest=model.getObjectByName('Chest'),head=model.getObjectByName('Head');
  const baseChest=chest.quaternion.clone(),baseHead=head.quaternion.clone();
  return (dt,name='GuardFootwork',pace=1,strikeTime=null,hit=0)=>{
    const next=actions.get(name);
    if(current!==next){
      const phase=current.time/current.getClip().duration;
      next.reset().play();
      next.time=(phase%1)*next.getClip().duration;
      next.weight=0;current=next;
    }
    current.timeScale=pace;
    current.paused=strikeTime!==null;
    if(current.paused)current.time=strikeTime*current.getClip().duration;
    // Short overlapping transitions retain the support of the planted foot.
    const blend=1-Math.exp(-dt*(current.paused?23:14));
    for(const action of actions.values()){
      if(!action.isScheduled())continue;
      action.weight+=((action===current?1:0)-action.weight)*blend;
      if(action!==current&&action.weight<.002)action.stop();
    }
    chest.quaternion.copy(baseChest);head.quaternion.copy(baseHead);
    mixer.update(dt);
    baseChest.copy(chest.quaternion);baseHead.copy(head.quaternion);
    chest.rotateX(-.24*hit);head.rotateZ(.19*hit);
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
  const lamps=arena.getObjectByName('Lamps'),emissive=new Map();
  arena.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat()){
    if(m.emissive?.getHex())emissive.set(m,m.emissiveIntensity);
  }});
  const lightColor=new T.Color(),warm=new T.Color('#fff0d6'),cold=new T.Color('#809cae');
  const skyA=new T.Color('#172324'),skyB=new T.Color('#030609');
  return {scene,rig:rig.object3D,camera,hands,desk,xr,arena,opponent,ceremony,animateBoxer,belt,crowd,display,confetti,badge,card,flashes,
    gate:arena.getObjectByName('Gate'),doors:[arena.getObjectByName('DoorL'),arena.getObjectByName('DoorR')],
    light(mix){key.intensity=2.8*(1-mix);ambient.intensity=2.1*(1-mix)+.035*mix;rim.intensity=1.9*(1-mix);
      ambient.color.copy(lightColor.copy(warm).lerp(cold,mix));world.background?.copy(skyA).lerp(skyB,mix);if(world.fog)world.fog.color.copy(world.background);
      emissive.forEach((original,m)=>{m.emissiveIntensity=original*(1-mix);});if(lamps)lamps.visible=mix<.92;
      if(ribbon)ribbon.visible=mix<.35;

    }};
}
