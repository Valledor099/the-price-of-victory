const T=AFRAME.THREE;
// Offsets from the player's resting glove, ordered by time in seconds.
const moves={
  jab:{contact:.145,recovery:.30,range:1.65,
    keys:[[0,0,0,0,0,0],[.055,.018,.04,-.07,.08,.04],[.145,-.115,.17,-.61,-.91,-.48],[.19,-.10,.15,-.54,-.84,-.40],[.34,0,0,0,0,0]]},
  uppercut:{contact:.245,recovery:.44,range:1.42,
    keys:[[0,0,0,0,0,0],[.085,.046,-.105,.025,.26,.34],[.17,.005,-.035,-.22,.01,.66],
          [.245,-.145,.27,-.40,-.19,1.05],[.30,-.14,.29,-.37,-.18,1.01],[.50,0,0,0,0,0]]}
};
export const strikes=moves;
export function glovePose(kind,age,offset,angles){
  const frames=moves[kind].keys;
  offset.set(0,0,0);angles.set(0,0);
  if(age<0||age>=frames.at(-1)[0])return;
  const end=frames.findIndex(f=>f[0]>age),a=frames[end-1],b=frames[end];
  const x=(age-a[0])/(b[0]-a[0]),t=x*x*(3-2*x);
  offset.set(T.MathUtils.lerp(a[1],b[1],t),T.MathUtils.lerp(a[2],b[2],t),T.MathUtils.lerp(a[3],b[3],t));
  angles.set(T.MathUtils.lerp(a[4],b[4],t),T.MathUtils.lerp(a[5],b[5],t));
}

export function playerArms(world,parts){
  const arms=[-1,1].map(()=>parts.map(p=>{const o=p.clone(true);world.add(o);return o;}));
  const up=new T.Vector3(0,1,0),side=new T.Vector3(),front=new T.Vector3(),shoulder=new T.Vector3();
  const wrist=new T.Vector3(),elbow=new T.Vector3(),span=new T.Vector3(),pole=new T.Vector3(),q=new T.Quaternion();
  function fit(part,a,b){
    span.subVectors(b,a);part.position.copy(a);part.scale.y=span.length();
    part.quaternion.setFromUnitVectors(up,span.normalize());
  }
  return (visible,eye,heading,gloves)=>{
    for(const pair of arms)for(const part of pair)part.visible=visible;
    if(!visible)return;
    front.set(0,0,-1).applyQuaternion(heading);front.y=0;front.normalize();side.crossVectors(front,up);
    for(let i=0;i<2;i++){
      const sign=i?1:-1,hand=gloves[i];
      shoulder.copy(eye).addScaledVector(side,sign*.205).addScaledVector(front,-.035);shoulder.y-=.245;
      wrist.set(0,-.115,0).applyQuaternion(hand.getWorldQuaternion(q));hand.getWorldPosition(span);wrist.add(span);
      span.subVectors(wrist,shoulder);const distance=span.length();span.normalize();
      pole.copy(side).multiplyScalar(sign*.70);pole.y=-1;pole.addScaledVector(span,-pole.dot(span)).normalize();
      elbow.copy(shoulder).addScaledVector(span,distance*.52).addScaledVector(pole,Math.sqrt(Math.max(.001,.285**2-(distance*.5)**2)));
      fit(arms[i][0],shoulder,elbow);fit(arms[i][1],elbow,wrist);
    }
  };
}
