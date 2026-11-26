const T=AFRAME.THREE;
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};

export function victoryCeremony(scene,glove,belt,armParts){
  // Both fists are attached to the ends of the same strap throughout the lift.
  const trophy=new T.Group();scene.object3D.add(trophy);trophy.add(belt);
  const fists=[-1,1].map(side=>{
    const hand=glove.clone(true);hand.name=side<0?'Victoria izquierda':'Victoria derecha';
    hand.scale.x=side;hand.position.set(side*.397,.012,.014);
    hand.rotation.set(-.19,side*.15,side*-.23);
    trophy.add(hand);hand.visible=true;return hand;
  });
  const base=new T.Vector3(),local=new T.Vector3(),up=new T.Vector3(0,1,0);
  const arms=fists.map(()=>armParts.map(part=>{
    const segment=part.clone(true);segment.visible=true;trophy.add(segment);return segment;
  }));
  const shoulder=new T.Vector3(),elbow=new T.Vector3(),wrist=new T.Vector3(),span=new T.Vector3();
  function fit(segment,start,end){
    span.subVectors(end,start);
    segment.position.copy(start);segment.scale.y=span.length();
    segment.quaternion.setFromUnitVectors(up,span.normalize());
  }
  let scale=1;
  function reset(){trophy.visible=false;belt.visible=false;}
  function start(eye,direction){
    base.copy(eye);scale=T.MathUtils.clamp(eye.y/1.65,.8,1.14);
    trophy.quaternion.setFromAxisAngle(up,Math.atan2(-direction.x,-direction.z));
    trophy.scale.setScalar(scale);trophy.visible=true;belt.visible=true;
    tick(0);
  }
  function tick(time,lowering=false){
    const h=lowering?1-ease(time/.85):ease((time-.6)/2.45);
    const height=-.56+.76*h,depth=-.63-.11*h;
    local.set(0,height*scale,depth*scale).applyQuaternion(trophy.quaternion);
    trophy.position.copy(base).add(local);
    belt.rotation.x=-.07;
    fists.forEach((hand,i)=>{
      const side=i?1:-1;
      wrist.set(0,-.12,0).applyQuaternion(hand.quaternion).add(hand.position);
      shoulder.set(side*.21,-.23-height,.025-depth);
      elbow.lerpVectors(shoulder,wrist,.51);
      elbow.x+=side*.085;elbow.y-=.11+.045*h;
      fit(arms[i][0],shoulder,elbow);fit(arms[i][1],elbow,wrist);
    });
    if(lowering&&time>=.85)reset();
  }
  reset();
  return {start,tick,reset};
}
