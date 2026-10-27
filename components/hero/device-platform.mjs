// A connected diagnostic environment extending behind the hero copy.
export function createDevicePlatform({THREE,scene,ownGeometry,materials,textures,device}){
  const root=new THREE.Group();root.name='Connected diagnostic workspace';(device?.root||scene).add(root);
  const own=g=>ownGeometry(g);
  const mat=p=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
  // The shared hero surface supplies the colour. This plane receives only
  // the device's contact shadow, so studio lighting cannot turn it grey.
  const floor=new THREE.ShadowMaterial({color:0x334e54,opacity:.16});materials.add(floor);
  const tipMetal=mat({color:0xf2bd57,metalness:.45,roughness:.28,envMapIntensity:.55});
  const dark=mat({color:0x102d39,metalness:.55,roughness:.32});
  const rubber=mat({color:0x182630,metalness:0,roughness:.64});
  const red=mat({color:0xd85f46,metalness:.18,roughness:.48});
  function mesh(g,m,p=[0,0,0],parent=root){const o=new THREE.Mesh(g,m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  mesh(own(new THREE.PlaneGeometry(200,200)),floor,[0,0,-.34]).castShadow=false;
  const tube=(points,r,m)=>mesh(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),64,r,8,false)),m);
  // An inspection stylus with machined collars and a fine copper contact.
  const probe=new THREE.Group();probe.name='Diagnostic microprobe';root.add(probe);
  const shaft=own(new THREE.CylinderGeometry(1,1,1,32));
  const shaftAxis=new THREE.Vector3(0,1,0),rodDirection=new THREE.Vector3();
  function placeRod(o,a,b,r){o.position.copy(a).add(b).multiplyScalar(.5);rodDirection.subVectors(b,a);const length=rodDirection.length();o.quaternion.setFromUnitVectors(shaftAxis,rodDirection.multiplyScalar(1/(length||1)));o.scale.set(r,length,r);}
  function rod(a,b,r,m){const o=mesh(shaft,m,[0,0,0],probe);placeRod(o,a,b,r);return o;}
  // Build one rigid tool in its fully seated pose. Only its parent translates;
  // retracting must never shorten the sleeve or pivot the needle on its own.
  const seatedTip=device?.probeSeatedContact?.clone()||new THREE.Vector3(-.28,.2575,.219);
  const probeAxis=new THREE.Vector3(1.35,1.75,2.35).normalize();
  const along=distance=>seatedTip.clone().addScaledVector(probeAxis,distance);
  const needleStart=along(.22);
  const contact=new THREE.Vector3();
  rod(along(.22),along(.72),.036,tipMetal).name='Visible plated probe stem';
  rod(along(.72),along(1.12),.065,dark).name='Insulated probe nose';
  rod(along(1.1),along(1.16),.145,red).name='Probe finger guard';
  const grip=mesh(own(new THREE.CylinderGeometry(1,.78,1,32)),rubber,[0,0,0],probe);
  grip.name='Compact insulated probe grip';placeRod(grip,along(1.14),along(2.06),.112);
  for(let i=0;i<6;i++)rod(along(1.28+i*.1),along(1.31+i*.1),.113,dark);
  rod(along(2.06),along(2.18),.083,dark).name='Probe cable socket';
  rod(along(2.18),along(2.36),.052,rubber).name='Probe cable strain relief';
  // ConeGeometry's +Y apex is the physical contact point after placeRod.
  const needle=mesh(own(new THREE.ConeGeometry(1,1,24)),tipMetal,[0,0,0],probe);needle.name='Microprobe contact needle';
  placeRod(needle,needleStart,seatedTip,.022);
  // Flex only the free cable loop; its far end stays on the work surface.
  // Reuse the same buffers instead of rebuilding a TubeGeometry every frame.
  const cable=tube([along(2.36).toArray(),along(2.72).toArray(),[2.5,3.8,2.25],[5,5,1.5],[8,7,.4],[13,10,.4]],.044,rubber);
  cable.name='Flexible microprobe lead';cable.userData.dynamicGeometry=true;
  const cableGeometry=cable.geometry,cablePosition=cableGeometry.attributes.position;
  const cableRest=cablePosition.array.slice(),cableWeights=new Float32Array(cablePosition.count);
  for(let i=0;i<cableWeights.length;i++){
    const t=Math.min(1,Math.floor(i/9)/32);
    cableWeights[i]=1-t*t*(3-2*t);
  }
  cablePosition.setUsage(THREE.DynamicDrawUsage);cableGeometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  cableGeometry.computeBoundingSphere();cableGeometry.boundingSphere.radius+=1;
  const lastCableOffset=new THREE.Vector3(Infinity,Infinity,Infinity);
  const glow=new THREE.MeshBasicMaterial({color:0xff4d24,transparent:true,opacity:0,depthWrite:false,toneMapped:false});materials.add(glow);
  const halo=mesh(own(new THREE.RingGeometry(.108,.139,48)),glow);halo.name='Diagnostic test land contact halo';halo.castShadow=false;halo.receiveShadow=false;halo.userData.dynamicTransform=true;
  const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
  function update(time=0){
    const inspection=clamp(device?.getInspection?.()||0),approach=clamp(device?.getProbeApproach?.()??inspection);
    if(device?.probeContact&&Number.isFinite(device.probeContact.x)&&Number.isFinite(device.probeContact.y)&&Number.isFinite(device.probeContact.z))contact.copy(device.probeContact);
    else{
      // Same pad coordinate plus the current carrier pose, for callers without the new API.
      const state=device?.getState?.(),expansion=clamp(state?.expansion||0);
      contact.set(-.245-.035*expansion,.2425+.015*expansion,.092+(Number.isFinite(state?.carrierLift)?state.carrierLift:.022+.105*expansion));
    }
    // The tool waits independently while the carrier moves. Its approach and
    // retraction happen only during the carrier's stationary inspection hold.
    probe.position.set(0,0,.72*(1-approach));
    if(!lastCableOffset.equals(probe.position)){
      const {x,y,z}=probe.position,positions=cablePosition.array;
      for(let i=0;i<cableWeights.length;i++){
        const j=i*3,w=cableWeights[i];
        positions[j]=cableRest[j]+x*w;positions[j+1]=cableRest[j+1]+y*w;positions[j+2]=cableRest[j+2]+z*w;
      }
      cablePosition.needsUpdate=true;cableGeometry.computeVertexNormals();lastCableOffset.copy(probe.position);
    }
    halo.position.copy(contact);halo.position.z+=.001;
    halo.visible=approach>=1-1e-6&&inspection>.001;halo.scale.setScalar(1+Math.sin(time*3)*.035);glow.opacity=.95*inspection;
  }
  update(0);return {root,update};
}
