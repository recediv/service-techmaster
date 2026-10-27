// Physical routed conductors, dielectric vias and light travelling through the device.
// Everything is local to its actual component, so the assembly never leaves a floating overlay behind.
export function createPhoneTechCircuits({THREE,ownGeometry,materials,chassis,board,oled,chipGeometry}){
  const owned=g=>ownGeometry(g),dummy=new THREE.Object3D(),axis=new THREE.Vector3(0,1,0);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),direction=new THREE.Vector3();
  const material=options=>{const m=new THREE.MeshStandardMaterial(options);materials.add(m);return m;};
  const power=material({color:0xd54e37,metalness:.52,roughness:.29,emissive:0xff361b,emissiveIntensity:.8});
  const signal=material({color:0x003a92,metalness:.08,roughness:.32,envMapIntensity:.15,emissive:0x004cff,emissiveIntensity:1.8});
  const gold=material({color:0xc6a15c,metalness:1,roughness:.27});
  const coralPulse=material({color:0xff6b41,metalness:.15,roughness:.28,emissive:0xff3c1e,emissiveIntensity:2.1});
  const cyanPulse=material({color:0x0fbaff,metalness:.08,roughness:.28,envMapIntensity:.15,emissive:0x009dff,emissiveIntensity:2.8});
  const coreGeometry=owned(new THREE.CylinderGeometry(1,1,1,6));
  const terminalGeometry=owned(new THREE.TorusGeometry(.026,.006,5,12));
  const pulseGeometry=owned(new THREE.CylinderGeometry(.010,.010,.052,6));
  const bundles=[];
  function conductors(parent,paths,mat,radius=.011){
    const segments=[],terminals=[];
    for(const points of paths){for(let i=1;i<points.length;i++)segments.push([points[i-1],points[i]]);terminals.push(points[0],points.at(-1));}
    const copper=new THREE.InstancedMesh(coreGeometry,mat,segments.length);copper.receiveShadow=true;copper.castShadow=false;
    segments.forEach(([p,q],i)=>{a.set(...p);b.set(...q);direction.copy(b).sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(axis,direction.clone().normalize());dummy.scale.set(radius,direction.length(),radius);dummy.updateMatrix();copper.setMatrixAt(i,dummy.matrix);});
    copper.instanceMatrix.needsUpdate=true;parent.add(copper);
    const vias=new THREE.InstancedMesh(terminalGeometry,gold,terminals.length);
    terminals.forEach((p,i)=>{dummy.position.set(...p);dummy.quaternion.identity();dummy.scale.setScalar(1);dummy.updateMatrix();vias.setMatrixAt(i,dummy.matrix);});vias.instanceMatrix.needsUpdate=true;parent.add(vias);
    const routes=paths.map(points=>{const vertices=points.map(p=>new THREE.Vector3(...p)),length=[0];for(let i=1;i<vertices.length;i++)length.push(length.at(-1)+vertices[i].distanceTo(vertices[i-1]));return {vertices,length,restZ:vertices.map(v=>v.z)};});routes.copper=copper;return routes;
  }
  function bundle(parent,paths,mat,pulse,radius,folded=false){
    const routes=conductors(parent,paths,mat,radius),trails=7;
    if(folded)routes.copper.frustumCulled=false;
    const moving=new THREE.InstancedMesh(pulseGeometry,pulse,routes.length*trails);moving.frustumCulled=false;parent.add(moving);bundles.push({routes,moving,trails,radius,folded});
  }
  // Coral power buses hug the actual machined rails and meet the USB / battery contacts.
  bundle(chassis,[
    [[-.35,-3.10,.074],[-.56,-3.10,.074],[-.77,-2.89,.074],[-.84,-2.68,.074],[-.84,.95,.074],[-.65,1.14,.074],[.20,1.14,.074]],
    [[.35,-3.10,.074],[.58,-3.10,.074],[1.37,-2.70,.128],[1.42,-2.49,.132],[1.42,2.63,.132],[1.19,2.86,.132],[.45,2.86,.132]],
    [[-1.43,-2.58,.132],[-1.43,-.92,.132],[-1.39,-.80,.132],[-1.39,2.65,.132],[-1.16,2.88,.132]],
    [[-.82,-1.73,.080],[-.62,-1.73,.080],[-.45,-1.56,.080],[.76,-1.56,.080],[.95,-1.37,.080],[1.35,-1.37,.080]],
    [[-.82,.15,.080],[-.63,.15,.080],[-.45,.33,.080],[.76,.33,.080],[.94,.51,.080],[1.35,.51,.080]]
  ],power,coralPulse,.012);
  bundle(board,[
    [[-1.39,-2.28,.030],[-1.31,-2.20,.030],[-1.31,.91,.030],[-1.13,1.09,.030],[-.78,1.09,.030]],
    [[-1.02,-2.18,.030],[-1.02,-1.53,.030],[-.98,-1.49,.030],[-.98,.89,.030],[-.75,1.12,.030],[.20,1.12,.030],[.20,1.35,.030],[.48,1.35,.030],[1.25,1.35,.030]],
    [[1.31,1.45,.030],[1.31,2.66,.030],[1.17,2.80,.030],[.54,2.80,.030],[.44,2.70,.030],[.44,2.19,.030]],
    [[.49,1.49,.032],[.49,1.74,.032],[.62,1.87,.032],[.62,2.14,.032],[.48,2.28,.032]],
    [[-.92,1.27,.032],[-.66,1.27,.032],[-.44,1.49,.032],[-.23,1.49,.032],[-.08,1.64,.032],[-.08,2.65,.032]]
  ],power,coralPulse,.009);
  // Three-dimensional signal routing over transparent front glass, rather than an empty clear rectangle.
  // The authored lanes share buses and turn at45°, with several real vertical interconnects.
  const circuits=[];
  for(let i=0;i<7;i++){
    const x=-1.21+i*.105,y=-2.70+i*.105,z=.035+i*.008;
    circuits.push([[x,y,z],[x,-1.55+i*.065,z],[-.72+i*.085,-1.11+i*.065,z],[-.72+i*.085,.66+i*.038,z],[-.42+i*.085,.96+i*.038,z],[.74+i*.045,.96+i*.038,z]]);
  }
  for(let i=0;i<6;i++){
    const x=.98-i*.095,z=.044+i*.010;
    circuits.push([[x,2.65,z],[x,1.98-i*.075,z],[.62-i*.095,1.62-i*.075,z],[.62-i*.095,.18-i*.045,z],[.32-i*.095,-.12-i*.045,z],[-.33-i*.095,-.12-i*.045,z]]);
  }
  for(let i=0;i<5;i++){
    const y=-2.45+i*.14,z=.04+i*.009;
    circuits.push([[1.21,y,z],[.58+i*.04,y,z],[.23+i*.04,y+.35,z],[.23+i*.04,-.93+i*.085,z],[-.05+i*.04,-.65+i*.085,z]]);
  }
  const raisedCircuits=[
    [[-.98,-1.12,.04],[-.98,-1.12,.25],[-.66,-.80,.25],[-.66,.34,.25],[-.38,.62,.25],[.48,.62,.25],[.48,.62,.04]],
    [[.93,1.89,.05],[.93,1.89,.29],[.45,1.41,.29],[-.20,1.41,.29],[-.51,1.10,.29],[-.51,.64,.29],[-.51,.64,.06]],
    [[.90,-2.18,.05],[.90,-2.18,.24],[.48,-1.76,.24],[.48,-1.19,.24],[.17,-.88,.24],[-.10,-.88,.24],[-.10,-.88,.05]],
    [[-1.13,2.24,.05],[-1.13,2.24,.27],[-.82,1.93,.27],[-.41,1.93,.27],[-.10,1.62,.27],[-.10,1.62,.05]]
  ];
  bundle(oled,circuits,signal,cyanPulse,.013);
  bundle(oled,raisedCircuits,signal,cyanPulse,.013,true);
  // Physical chip-sized receiving pads make the upper circuitry read as a connected assembly.
  const pads=[];
  for(const [cx,cy,w,h]of[[-.38,-.55,.48,.72],[.34,1.20,.53,.50],[.60,-1.48,.35,.42]]){
    for(let side=0;side<2;side++)for(let i=0;i<8;i++){
      const yy=cy+(i/7-.5)*h;pads.push([[cx+(side?1:-1)*w/2,yy,.038],[cx+(side?1:-1)*(w/2+.07),yy,.038]]);
    }
  }
  conductors(oled,pads,gold,.0065);
  const chipMaterial=material({color:0x071320,metalness:.18,roughness:.43,envMapIntensity:.45});
  const chips=new THREE.InstancedMesh(chipGeometry,chipMaterial,3);chips.castShadow=true;chips.receiveShadow=true;
  [[-.38,-.55,.48,.72],[.34,1.20,.53,.50],[.60,-1.48,.35,.42]].forEach(([x,y,w,h],i)=>{dummy.position.set(x,y,.077);dummy.quaternion.identity();dummy.scale.set(w,h,.070);dummy.updateMatrix();chips.setMatrixAt(i,dummy.matrix);});chips.instanceMatrix.needsUpdate=true;oled.add(chips);
  const nodeGeo=owned(new THREE.CylinderGeometry(.027,.027,.018,12));
  const nodes=new THREE.InstancedMesh(nodeGeo,signal,11);nodeGeo.rotateX(Math.PI/2);
  [[-.98,-1.12,.04],[.93,1.89,.05],[.90,-2.18,.05],[-1.13,2.24,.05],[-.51,.64,.06],[.48,.62,.04],[-.1,-.88,.05],[.74,.96,.04],[-.33,-.12,.04],[1.21,-2.45,.04],[-1.21,-2.70,.04]].forEach((p,i)=>{dummy.position.set(...p);dummy.quaternion.identity();dummy.scale.setScalar(1);dummy.updateMatrix();nodes.setMatrixAt(i,dummy.matrix);});nodes.instanceMatrix.needsUpdate=true;oled.add(nodes);
  return {update(time,activity=1,expansion=1){
    power.emissiveIntensity=.45+activity*.66;signal.emissiveIntensity=1.35+activity*.70;
    let routeIndex=0;
    for(const {routes,moving,trails,radius,folded}of bundles){let n=0;
      if(folded){let conductor=0;for(const route of routes){
        route.length[0]=0;for(let k=1;k<route.vertices.length-1;k++)route.vertices[k].z=.08+(route.restZ[k]-.08)*expansion;
        for(let k=1;k<route.vertices.length;k++){
          a.copy(route.vertices[k-1]);b.copy(route.vertices[k]);direction.copy(b).sub(a);const length=direction.length();route.length[k]=route.length[k-1]+length;
          dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(axis,direction.normalize());dummy.scale.set(radius,length,radius);dummy.updateMatrix();routes.copper.setMatrixAt(conductor++,dummy.matrix);
        }
      }routes.copper.instanceMatrix.needsUpdate=true;}
      for(const route of routes){for(let trail=0;trail<trails;trail++){
        const total=route.length.at(-1),d=((time*1.75-routeIndex*.31-trail*.075)%total+total)%total;let k=1;while(k<route.length.length-1&&route.length[k]<d)k++;
        a.copy(route.vertices[k-1]);b.copy(route.vertices[k]);direction.copy(b).sub(a);dummy.position.copy(a).lerp(b,(d-route.length[k-1])/(route.length[k]-route.length[k-1]));dummy.quaternion.setFromUnitVectors(axis,direction.normalize());dummy.scale.setScalar((.50+activity*.50)*(1-trail/(trails+1)));dummy.updateMatrix();moving.setMatrixAt(n++,dummy.matrix);
      }routeIndex++;}moving.instanceMatrix.needsUpdate=true;
    }
  }};
}
