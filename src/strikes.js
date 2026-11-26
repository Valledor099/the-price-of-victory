const T=AFRAME.THREE;
// Offsets from the player's resting glove, ordered by time in seconds.
const moves={
  jab:{contact:.145,recovery:.56,range:1.65,
    keys:[[0,0,0,0,0],[.055,.018,.04,-.07,.12],[.145,-.115,.17,-.61,1],[.19,-.10,.15,-.54,.90],[.34,0,0,0,0]]},
  uppercut:{contact:.245,recovery:.76,range:1.42,
    keys:[[0,0,0,0,0],[.085,.046,-.105,.025,.24],[.17,.005,-.035,-.22,.57],
          [.245,-.145,.27,-.40,1],[.30,-.14,.29,-.37,.94],[.50,0,0,0,0]]}
};
export const strikes=moves;
export function glovePose(kind,age,offset){
  const frames=moves[kind].keys;
  offset.set(0,0,0);
  if(age<0||age>=frames.at(-1)[0])return 0;
  const end=frames.findIndex(f=>f[0]>age),a=frames[end-1],b=frames[end];
  const x=(age-a[0])/(b[0]-a[0]),t=x*x*(3-2*x);
  offset.set(T.MathUtils.lerp(a[1],b[1],t),T.MathUtils.lerp(a[2],b[2],t),T.MathUtils.lerp(a[3],b[3],t));
  return T.MathUtils.lerp(a[4],b[4],t);
}

// The GLB's +Y runs from cuff to knuckles, +Z is the stitched back, and -Z is the palm.
const wristAxis=new T.Vector3(),back=new T.Vector3(),across=new T.Vector3(),palmTurn=new T.Vector3();
const basis=new T.Matrix4(),line=new T.Vector3(),bend=new T.Vector3(),joint=new T.Vector3();
function orientWrist(q){
  across.crossVectors(wristAxis,back).normalize();
  back.crossVectors(across,wristAxis);
  q.setFromRotationMatrix(basis.makeBasis(across,wristAxis,back));
}
export function trackedWrist(q,side){
  // The grip pose supplies wrist roll. Its forward axis follows the controller handle.
  wristAxis.set(0,.36,-.93).normalize();back.set(side,.18,0);
  orientWrist(q);
}
export function animatedWrist(q,center,side,guard,kind,turn){
  joint.set(side*.205,-.245,.035);
  line.subVectors(center,joint);
  const distance=Math.max(.001,line.length());line.divideScalar(distance);
  bend.set(side*(.55-.23*guard),-1,kind==='uppercut'?-turn*.62:0);
  bend.addScaledVector(line,-bend.dot(line)).normalize();
  // Solve to the middle of the glove so its cuff continues the line of the forearm.
  const upper=.29,lower=.35,along=Math.min(upper,Math.max(0,(distance**2+upper**2-lower**2)/(2*distance)));
  const elbowDepth=Math.sqrt(Math.max(0,upper**2-along**2));
  joint.addScaledVector(line,along).addScaledVector(bend,elbowDepth);
  wristAxis.subVectors(center,joint).normalize();
  if(kind==='uppercut'){
    palmTurn.set(-side*.10,.85,-.51).normalize();
    wristAxis.lerp(palmTurn,turn*.72).normalize();
  }
  back.set(side*(.91-.31*guard),.08,-.45-.52*guard);
  palmTurn.set(kind==='jab'?side*.12:side*.35,kind==='jab'?1:-.55,kind==='jab'?0:-.95);
  back.lerp(palmTurn,turn);
  orientWrist(q);
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
      const distance=shoulder.distanceTo(wrist);
      pole.copy(up).applyQuaternion(q);
      elbow.copy(wrist).addScaledVector(pole,-Math.max(.235,distance*.47));
      fit(arms[i][0],shoulder,elbow);fit(arms[i][1],elbow,wrist);
    }
  };
}
