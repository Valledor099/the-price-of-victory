import {boards} from './boards.js';
import {centerCard,photographers} from './presentation.js';
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
// All crowd members share the Blender spectator geometry and a handful of draw calls.
function crowdFrom(template){
  const group=new T.Group(), seats=[], transform=new T.Object3D();
  for(let row=0;row<7;row++){
    const count=64+row*6;
    for(let i=0;i<count;i++){
      const a=(i+.25*(row%2))*2*Math.PI/count;
      if(Math.sin(a)>.94&&Math.abs(Math.cos(a))<.26)continue;
      const r=8.55+row*1.28, size=.80+.23*((i*17+row*7)%13)/12;
      transform.position.set(Math.cos(a)*r,-.59+row*.68,Math.sin(a)*r);
      transform.rotation.y=-a-Math.PI/2;transform.scale.setScalar(size);transform.updateMatrix();
      seats.push(transform.matrix.clone());
    }
  }
  template.updateMatrixWorld(true);template.traverse(node=>{
    if(!node.isMesh)return;
    const mesh=new T.InstancedMesh(node.geometry,node.material.clone(),seats.length);
    seats.forEach((matrix,i)=>{mesh.setMatrixAt(i,matrix.clone().multiply(node.matrixWorld));mesh.setColorAt(i,new T.Color(['#ffe5bb','#b2c3cf','#cc9488','#e6ece5'][i%4]));});
    group.add(mesh);
  });template.visible=false;return group;
}
function pivotArm(body,name,x,y){
  const arm=body.getObjectByName(name);if(!arm)return new T.Group();
  const pivot=new T.Group();body.add(pivot);pivot.position.set(x,y,0);body.updateWorldMatrix(true,true);pivot.attach(arm);return pivot;
}
export async function createWorld(tick) {
  AFRAME.registerComponent('match-loop',{tick(t,dt){if(dt)tick(Math.min(dt/1000,.12));}});
  const scene=document.createElement('a-scene');
  scene.setAttribute('embedded','');scene.setAttribute('match-loop','');scene.setAttribute('loading-screen','enabled:false');
  scene.setAttribute('device-orientation-permission-ui','enabled:false');scene.setAttribute('xr-mode-ui','enabled:false');
  scene.setAttribute('renderer','antialias:true; colorManagement:true; highRefreshRate:true');
  scene.setAttribute('light','defaultLightsEnabled:false');
  scene.setAttribute('webxr','referenceSpaceType: local-floor; optionalFeatures: bounded-floor, local-floor');
  scene.setAttribute('background','color: #172324');scene.setAttribute('fog','type: exponential; color:#172324; density:.035');
  const rig=entity('a-entity',scene,{id:'rig'}),camera=entity('a-entity',rig,{camera:'near:.04;far:70;fov:75','look-controls':'pointerLockEnabled:false; touchEnabled:true',position:'0 1.65 0'});
  const hands=['left','right'].map(hand=>entity('a-entity',rig,{'laser-controls':'hand:'+hand,'raycaster':'enabled:false','line':'visible:false'}));
  document.querySelector('#game').append(scene);
  if(!scene.hasLoaded)await new Promise(resolve=>scene.addEventListener('loaded',resolve,{once:true}));
  const [arena,opponent,ref,glove,belt,fan]=await Promise.all(['arena','opponent','referee','glove','belt','spectator'].map(n=>model(scene,n)));
  const world=scene.object3D;
  const ribbon=arena.getObjectByName('Ribbon');
  const ambient=new T.HemisphereLight(0xffecdb,0x6b7471,2.1), key=new T.DirectionalLight(0xffdbad,2.8),rim=new T.DirectionalLight(0x97d7ee,1.9);
  key.position.set(3,7,4);rim.position.set(-4,4,-3);world.add(ambient,key,rim);
  const crowd=crowdFrom(fan);world.add(crowd);glove.visible=false;belt.visible=false;
  const attachGlove=(parent,i)=>{
    const g=glove.clone(true);g.visible=true;g.scale.x=i?1:-1;parent.add(g);g.rotation.set(-.36,0,i?-.14:.14);return g;
  };
  const desk=[0,1].map(i=>attachGlove(camera.object3D,i));
  const xr=hands.map((hand,i)=>attachGlove(hand.object3D,i));
  for(const hand of hands)hand.addEventListener('controller-model-ready',()=>{const mesh=hand.getObject3D('mesh');if(mesh)mesh.visible=false;});
  const refArm=pivotArm(ref,'RefL',-.27,1.41);
  const fists=[pivotArm(opponent,'FistL',-.27,1.41),pivotArm(opponent,'FistR',.27,1.41)];
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
  return {scene,rig:rig.object3D,camera,hands,desk,xr,arena,opponent,ref,refArm,fists,belt,crowd,display,confetti,badge,card,flashes,
    gate:arena.getObjectByName('Gate'),doors:[arena.getObjectByName('DoorL'),arena.getObjectByName('DoorR')],
    light(mix){key.intensity=2.8-2.35*mix;ambient.intensity=2.1-1.15*mix;rim.intensity=1.9-1.3*mix;
      ambient.color.copy(lightColor.copy(warm).lerp(cold,mix));world.background?.copy(skyA).lerp(skyB,mix);if(world.fog)world.fog.color.copy(world.background);
      lampMats.forEach(m=>{m.emissiveIntensity=2*(1-mix);});if(lamps)lamps.visible=mix<.92;
      if(ribbon)ribbon.visible=mix<.35;

    }};
}
