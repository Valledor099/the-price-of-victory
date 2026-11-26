const T=AFRAME.THREE;
export const rowCount=20;
export function seatRadius(row){return 16.5+row*1.14+(row>=10?1.5:0);}
export function seatHeight(row){return -.48+row*.64+(row>=10?1.45:0);}

// One instanced mesh for the distant figures. Aisles stay empty on both decks.
export function crowdFromStands(){
  const pos=[],colors=[],indices=[];
  // Tapered shoulders and a joined neckline read as a crowd from ringside.
  const profile=[[.02,.16,.09],[.28,.19,.12],[.53,.22,.13],[.58,.185,.11],
                 [.615,.075,.065],[.66,.073,.067],[.70,.098,.085],
                 [.79,.112,.096],[.87,.09,.082],[.91,.045,.043]];
  for(let row=0;row<profile.length;row++){
    const [y,rx,rz]=profile[row],shade=row<5?.73:.92;
    // From inside the ring each curved strip faces inward. Three vertices per
    // band give the chest a little depth without spending polygons on faces.
    pos.push(-rx,y,0, 0,y,rz, rx,y,0);
    for(let j=0;j<3;j++)colors.push(shade,shade,shade);
    if(row<profile.length-1){
      const k=row*3;
      indices.push(k,k+1,k+3,k+3,k+1,k+4, k+1,k+2,k+4,k+4,k+2,k+5);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const poses=[],dummy=new T.Object3D();
  for(let row=0;row<rowCount;row++){
    const radius=seatRadius(row),count=Math.floor(2*Math.PI*radius/.56);
    for(let i=0;i<count;i++){
      const a=2*Math.PI*(i+(row%2)*.3)/count;
      if(Math.abs(Math.sin(12*a))<.09 || (row<10&&Math.sin(a)>.97))continue;
      const seed=(i*97+row*197)%127/126;
      dummy.position.set(radius*Math.cos(a),seatHeight(row)+.10*seed,radius*Math.sin(a));
      dummy.rotation.set(.10*(seed-.5),-a-Math.PI/2,.11*(seed-.5));dummy.scale.setScalar(.86+.22*seed);dummy.updateMatrix();
      poses.push(dummy.matrix.clone());
    }
  }
  const crowd=new T.InstancedMesh(geo,new T.MeshBasicMaterial({vertexColors:true}),poses.length);
  const palette=['#4d6065','#425459','#5b6c6d','#726867','#475a62','#657470','#596369'];
  poses.forEach((m,i)=>{crowd.setMatrixAt(i,m);crowd.setColorAt(i,new T.Color(palette[(i*17+Math.floor(i/11))%palette.length]));});
  return crowd;
}
