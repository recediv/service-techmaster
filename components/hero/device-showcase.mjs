import { smoothPhoneSurfaceNormals } from './phone-surface-normals.mjs';
import { createDeviceInternals } from './device-internals.mjs';

const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10);};

// An open device under diagnosis. The carrier rises for inspection; there is no
// decorative glass layer between the components and the repair instrument.
export function createDeviceShowcase({THREE,scene,ownGeometry,materials,textures,detail='high'}){
  const root=new THREE.Group();root.name='Open device under diagnosis';scene.add(root);
  const frame=new THREE.Group(),carrier=new THREE.Group();
  frame.name='Machined enclosure';carrier.name='Internal carrier';root.add(frame,carrier);
  const own=g=>ownGeometry(g),dummy=new THREE.Object3D();
  const standard=p=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
  const physical=p=>{const m=new THREE.MeshPhysicalMaterial(p);materials.add(m);return m;};
  const silver=standard({color:0xe1644c,metalness:.65,roughness:.34,envMapIntensity:1.05});
  const chassis=standard({color:0x9ba5aa,metalness:.7,roughness:.4,envMapIntensity:.8});
  const gasket=standard({color:0x0b1116,metalness:0,roughness:.78});
  const graphite=standard({color:0x063451,metalness:.15,roughness:.58});
  const gold=standard({color:0xd7b16b,metalness:1,roughness:.23,envMapIntensity:.9});
  const display=detail==='page'?new THREE.MeshBasicMaterial({color:0x07131a,toneMapped:false}):physical({color:0x020509,metalness:0,roughness:.12,clearcoat:.3,clearcoatRoughness:.12,envMapIntensity:.6});
  if(detail==='page'){display.name='Unlit rear edge';materials.add(display);}
  const signal=new THREE.MeshBasicMaterial({color:0xff4d35,toneMapped:false});materials.add(signal);
  const signalCyan=new THREE.MeshBasicMaterial({color:0x00d9ec,toneMapped:false});materials.add(signalCyan);
  const signalHead=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});materials.add(signalHead);
  const signalIdle=new THREE.Color(0x712c29),signalHot=new THREE.Color(0xff4d35),cyanIdle=new THREE.Color(0x126574),cyanHot=new THREE.Color(0x00e0ef);
  const copper=standard({color:0xab784a,metalness:1,roughness:.34});
  const cache=new Map();
  function rounded(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
  function hole(s,w,h,r,x=0,y=0){s.holes.push(new THREE.Path(rounded(w,h,r).getPoints(20).map(p=>new THREE.Vector2(p.x+x,p.y+y))));}
  function extrusion(s,d,b=.005){const g=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,curveSegments:18,bevelEnabled:b>0,bevelSize:b,bevelThickness:b,bevelSegments:4});smoothPhoneSurfaceNormals(g);g.translate(0,0,-d/2);return own(g);}
  // Arc joins can differ by a fraction of a floating-point unit. Snap and
  // remove duplicate vertices before beveling the continuous shell.
  function cleanShellProfile(shape){
    const points=path=>{
      const result=[];
      for(const p of path.getPoints(18)){
        const v=new THREE.Vector2(Math.round(p.x*1e6)/1e6,Math.round(p.y*1e6)/1e6);
        if(!result.length||result.at(-1).distanceToSquared(v)>1e-12)result.push(v);
      }
      if(result.length>1&&result[0].distanceToSquared(result.at(-1))<=1e-12)result.pop();
      return result;
    };
    const result=new THREE.Shape(points(shape));
    result.holes=shape.holes.map(hole=>new THREE.Path(points(hole)));
    return result;
  }
  // Keep the port wall's bevel inside the straight opening. Its end bevel
  // otherwise overlaps the U-shell's flat caps at exactly the same depth.
  function clipPortWallEnds(geometry,halfWidth){
    const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    const bound=Math.fround(halfWidth),positions=[],normals=[],uvs=[],groups=[];
    const read=index=>[position.getX(index),position.getY(index),position.getZ(index),normal.getX(index),normal.getY(index),normal.getZ(index),uv?.getX(index)||0,uv?.getY(index)||0];
    const clip=(polygon,plane,keepGreater)=>{
      const result=[];
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],b=polygon[(i+1)%polygon.length];
        const aInside=keepGreater?a[0]>=plane:a[0]<=plane,bInside=keepGreater?b[0]>=plane:b[0]<=plane;
        if(aInside)result.push(a);
        if(aInside!==bInside){
          const t=(plane-a[0])/(b[0]-a[0]),vertex=a.map((value,axis)=>value+(b[axis]-value)*t);
          vertex[0]=plane;result.push(vertex);
        }
      }
      return result;
    };
    const append=(a,b,c)=>{
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
      if(x*x+y*y+z*z<=1e-20)return;
      for(const vertex of [a,b,c]){
        positions.push(vertex[0],vertex[1],vertex[2]);
        const length=Math.hypot(vertex[3],vertex[4],vertex[5])||1;
        normals.push(vertex[3]/length,vertex[4]/length,vertex[5]/length);uvs.push(vertex[6],vertex[7]);
      }
    };
    const sourceGroups=geometry.groups.length?geometry.groups:[{start:0,count:position.count,materialIndex:0}];
    for(const group of sourceGroups){
      const start=positions.length/3;
      for(let i=group.start;i<group.start+group.count;i+=3){
        const polygon=clip(clip([read(i),read(i+1),read(i+2)],-bound,true),bound,false);
        for(let j=1;j<polygon.length-1;j++)append(polygon[0],polygon[j],polygon[j+1]);
      }
      const count=positions.length/3-start;if(count)groups.push({start,count,materialIndex:group.materialIndex});
    }
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    if(uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.clearGroups();for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  }
  function plate(w,h,d,r=.08,b=.005){const key=[w,h,d,r,b].join(':');if(!cache.has(key))cache.set(key,extrusion(rounded(w,h,r),d,b));return cache.get(key);}
  function ring(w,h,iw,ih,d,r,b=.005){const s=rounded(w,h,r);hole(s,iw,ih,Math.max(.015,r-(w-iw)/2));return extrusion(s,d,b);}
  function mesh(g,m,parent,p=[0,0,0],shadow=true){const o=new THREE.Mesh(g,m);o.position.set(...p);o.castShadow=shadow;o.receiveShadow=shadow;parent.add(o);return o;}
  const unitBox=own(new THREE.BoxGeometry(1,1,1));
  function batch(g,m,items,parent=frame){const o=new THREE.InstancedMesh(g,m,items.length);items.forEach((v,i)=>{dummy.position.set(...v.p);dummy.rotation.set(...(v.r||[0,0,0]));dummy.scale.set(...(v.s||[1,1,1]));dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);});o.instanceMatrix.needsUpdate=true;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  // One continuous side shell, with the same circular corner on both surfaces.
  // A convex edge bevel replaces the two projecting rims and recessed waist.
  // The lower straight wall remains separate to keep the real port apertures.
  const shell=new THREE.Shape();shell.moveTo(1.22,-3.47);
  shell.absarc(1.22,-3,.47,-Math.PI/2,0,false);shell.lineTo(1.69,3);
  shell.absarc(1.22,3,.47,0,Math.PI/2,false);shell.lineTo(-1.22,3.47);
  shell.absarc(-1.22,3,.47,Math.PI/2,Math.PI,false);shell.lineTo(-1.69,-3);
  shell.absarc(-1.22,-3,.47,Math.PI,Math.PI*1.5,false);shell.lineTo(-1.22,-3.32);
  shell.absarc(-1.22,-3,.32,Math.PI*1.5,Math.PI,true);shell.lineTo(-1.54,3);
  shell.absarc(-1.22,3,.32,Math.PI,Math.PI/2,true);shell.lineTo(1.22,3.32);
  shell.absarc(1.22,3,.32,Math.PI/2,0,true);shell.lineTo(1.54,-3);
  shell.absarc(1.22,-3,.32,0,-Math.PI/2,true);shell.closePath();
  mesh(extrusion(cleanShellProfile(shell),.32,.012),silver,frame).name='Continuous machined enclosure';
  const portWall=new THREE.Shape();portWall.moveTo(-1.22,-.16);portWall.lineTo(1.22,-.16);portWall.lineTo(1.22,.16);portWall.lineTo(-1.22,.16);portWall.closePath();
  hole(portWall,.62,.118,.046,0,-.018);for(const sign of [-1,1])for(let i=0;i<5;i++){const path=new THREE.Path();path.absarc(sign*(.53+i*.13),-.014,.028,0,Math.PI*2,true);portWall.holes.push(path);}
  const lower=clipPortWallEnds(extrusion(cleanShellProfile(portWall),.15,.012),1.22);lower.rotateX(Math.PI/2);mesh(lower,silver,frame,[0,-3.395,0]).name='Port wall with open apertures';
  mesh(plate(.60,.32,.07,.045),gasket,frame,[0,-3.20,-.015]);
  if(detail!=='page'){
    mesh(plate(.44,.23,.026,.02,.002),graphite,frame,[0,-3.29,-.026]);
    batch(unitBox,gold,Array.from({length:12},(_,i)=>({p:[-.174+i*.0316,-3.34,-.008],s:[.015,.13,.008]})));
  }
  // Edge antenna joints and a mechanical switch are aligned with real rails.
  batch(unitBox,gasket,[-1,1].flatMap(sign=>[-2.55,2.55].map(y=>({p:[sign*1.62,y,0],s:[.18,.022,.324]}))));
  for(const [x,y,h]of[[-1.707,.97,.63],[-1.707,.12,.63],[1.707,.7,.96]]){if(detail==='page'&&x<0)continue;mesh(plate(.028,h+.09,.10,.014,.003),gasket,frame,[x,y,0]);mesh(plate(.038,h,.082,.018,.004),silver,frame,[x*1.006,y,.005]);}
  const rearScreen=mesh(plate(3.12,6.66,.035,.37,.006),display,frame,[0,0,-.204]);
  const rearGasket=mesh(ring(3.16,6.70,3.09,6.63,.012,.39,.003),gasket,frame,[0,0,-.181]);
  const rearEdges=[rearScreen,rearGasket];
  if(detail==='page')for(const edge of rearEdges)edge.userData.dynamicVisibility=true;
  mesh(plate(3.02,6.48,.035,.33),chassis,frame,[0,0,-.115]).name='Light metal internal chassis';
  // A single cell is structural context under the board, not the main subject.
  mesh(plate(1.62,3.68,.072,.12,.007),graphite,frame,[-.45,-.55,-.054]);
  if(detail!=='page')batch(unitBox,gold,[{p:[.42,-.37,-.032],s:[.28,.26,.018]},{p:[.42,-.82,-.032],s:[.28,.26,.018]}]);
  const internals=createDeviceInternals({THREE,ownGeometry,materials,textures,detail});carrier.add(internals.root);
  const routes=[];
  for(const points of internals.signalPaths||[]){
    const path=points.map(p=>p.clone());
    const curve=new THREE.CatmullRomCurve3(path,false,'centripetal');
    mesh(own(new THREE.TubeGeometry(curve,Math.max(20,path.length*10),.021,6,false)),copper,carrier,[0,0,.002],false);
    mesh(own(new THREE.TubeGeometry(curve,Math.max(20,path.length*10),.012,6,false)),routes.length<2?signal:signalCyan,carrier,[0,0,.020],false);
    routes.push(curve);
  }
  const pulseGeometry=own(new THREE.SphereGeometry(1,10,6));
  const pulses=new THREE.InstancedMesh(pulseGeometry,signalHead,routes.length*7);pulses.frustumCulled=false;pulses.userData.dynamicGeometry=true;carrier.add(pulses);
  for(let i=0;i<routes.length*7;i++)pulses.setColorAt(i,new THREE.Color(i<14?0xff4d35:0x00e0ef));
  const focusPoint=new THREE.Vector3(),probeContact=new THREE.Vector3(),testPadLocal=internals.probeContact||new THREE.Vector3(-.245,.2425,.092);
  const probeSeatedContact=testPadLocal.clone().add(new THREE.Vector3(-.035,.015,.127));
  let progress=0,inspection=0,probeApproach=0,time=0;
  function update(value=0){
    time=Number.isFinite(value)?value:0;const t=((time%14)+14)%14;
    progress=ease((t-1)/3)*(1-ease((t-10.7)/2.7));
    probeApproach=ease((t-4.35)/.8)*(1-ease((t-9.45)/.8));
    inspection=ease((t-5.3)/.35)*(1-ease((t-8.85)/.35));
    root.rotation.set(.012,0,-.29);
    carrier.position.set(-.035*progress,.015*progress,.022+.105*progress);
    signal.color.copy(signalIdle).lerp(signalHot,inspection);signalCyan.color.copy(cyanIdle).lerp(cyanHot,inspection);
    let index=0;for(let route=0;route<routes.length;route++)for(let tail=0;tail<7;tail++){
      const phase=((time*.17-route*.21-tail*.014)%1+1)%1;routes[route].getPointAt(phase,dummy.position);dummy.position.z+=.026;dummy.rotation.set(0,0,0);dummy.scale.set(.034*(1-tail/8),.034*(1-tail/8),.019*(1-tail/8));dummy.scale.multiplyScalar(.06+.94*inspection);dummy.updateMatrix();pulses.setMatrixAt(index++,dummy.matrix);
    }pulses.instanceMatrix.needsUpdate=true;
    internals.update?.(time,inspection);root.updateWorldMatrix(true,false);
    probeContact.copy(testPadLocal).add(carrier.position);
    focusPoint.copy(probeContact);root.localToWorld(focusPoint);
  }
  update(.5);
  return {root,focusPoint,probeContact,probeSeatedContact,update,
    setPageView(mobile){if(detail!=='page')return false;const changed=rearScreen.visible!==Boolean(mobile);for(const edge of rearEdges)edge.visible=Boolean(mobile);return changed;},
    getProbeApproach:()=>probeApproach,getInspection:()=>inspection,getState:()=>({cycleTime:((time%14)+14)%14,expansion:progress,phase:inspection>.3?'diagnostic':progress<.02?'standby':'inspection',carrierLift:carrier.position.z,probeApproach})};
}
