const T=AFRAME.THREE;
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};

// The referee, glove and trophy share a world-space pose. Looking around in VR
// moves the viewer independently of the presentation.
export function victoryCeremony(scene,rig,ref,glove,belt){
  const upper=ref.getObjectByName('DriveL'),fore=ref.getObjectByName('ForeL');
  const palm=ref.getObjectByName('VictoryGrip');
  if(!palm||!upper||!fore)throw Error('Falta el agarre de victoria del árbitro');
  const restUpper=upper.quaternion.clone(),restFore=fore.quaternion.clone();
  const axis=new T.Vector3(0,0,1),up=new T.Vector3(0,1,0);
  const rotation=new T.Quaternion(),heading=new T.Quaternion();
  const forward=new T.Vector3(),right=new T.Vector3(),offset=new T.Vector3(),origin=new T.Vector3();
  const raised=glove.clone(true);raised.name='Guante de victoria';scene.object3D.add(raised);
  const curtain=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({
    color:0x081119,transparent:true,depthTest:false,depthWrite:false,toneMapped:false
  }));
  curtain.position.z=-.095;curtain.renderOrder=9999;curtain.frustumCulled=false;scene.camera.add(curtain);
  let turned=false,scale=1;
  function reset(){
    turned=false;raised.visible=false;curtain.visible=false;
    upper.quaternion.copy(restUpper);fore.quaternion.copy(restFore);ref.scale.setScalar(1);
  }
  function place(eye,direction){
    forward.copy(direction);forward.y=0;
    if(forward.lengthSq()<.001)forward.set(0,0,-1);
    forward.normalize();right.crossVectors(forward,up);
    heading.setFromAxisAngle(up,Math.atan2(-forward.x,-forward.z));
    scale=T.MathUtils.clamp(eye.y/1.65,.76,1.15);
    ref.scale.setScalar(scale);
    ref.position.copy(eye).addScaledVector(forward,.85*scale).addScaledVector(right,.81*scale);
    ref.position.y=0;ref.quaternion.copy(heading);ref.rotateY(-.24);
  }
  function start(eye,direction){reset();place(eye,direction);raised.visible=true;tick(0,eye,direction);}
  function tick(time,eye,direction){
    const opacity=time<.32?ease(time/.28):1-ease((time-.32)/.35);
    curtain.material.opacity=opacity;curtain.visible=opacity>.001;
    if(!turned&&time>=.30){
      // Pivot around the tracked head so an off-centre player stays in place.
      const turn=-Math.PI/3;
      origin.copy(rig.position).sub(eye).applyAxisAngle(up,turn);
      rig.position.copy(eye).add(origin);rig.rotation.y+=turn;
      rig.updateMatrixWorld(true);
      place(eye,forward.copy(direction).applyAxisAngle(up,turn));
      turned=true;
    }
    const lift=ease((time-1.50)/2.8);
    upper.quaternion.copy(restUpper).multiply(rotation.setFromAxisAngle(axis,-.28-1.06*lift));
    fore.quaternion.copy(restFore).multiply(rotation.setFromAxisAngle(axis,-.66-.87*lift));
    palm.getWorldPosition(raised.position);
    raised.quaternion.copy(heading);raised.rotateZ(-.12-.13*lift);raised.rotateX(-.24);
    raised.position.add(offset.set(0,.112*scale,.017).applyQuaternion(raised.quaternion));
    raised.scale.setScalar(scale);
    belt.quaternion.copy(heading);belt.rotateZ(.06+.14*lift);belt.rotateX(-.13);
    // The raised right hand holds the outer end of the strap; the centre hangs free.
    belt.position.copy(raised.position).add(offset.set(-.365,-.060,-.005).applyQuaternion(belt.quaternion));
  }
  const releasePosition=new T.Vector3(),releaseRotation=new T.Quaternion();
  const glovePosition=new T.Vector3(),gloveRotation=new T.Quaternion();
  function letGo(){
    releasePosition.copy(raised.position);releaseRotation.copy(raised.quaternion);
  }
  function carry(hand,elapsed){
    hand.getWorldPosition(glovePosition);hand.getWorldQuaternion(gloveRotation);
    const blend=ease(elapsed/.9);
    raised.visible=blend<1;
    raised.position.lerpVectors(releasePosition,glovePosition,blend);
    raised.quaternion.slerpQuaternions(releaseRotation,gloveRotation,blend);
    belt.quaternion.copy(heading);belt.rotateZ(.2-.30*blend);belt.rotateX(-.13);
    belt.position.copy(raised.position).add(offset.set(-.365,-.060,-.005).applyQuaternion(belt.quaternion));
  }
  reset();
  return {start,tick,letGo,carry,reset};
}
