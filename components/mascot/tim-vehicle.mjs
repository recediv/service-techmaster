import * as THREE from 'three';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>n*n*(3-2*n);
const cue=(n,a,b)=>smooth(clamp((n-a)/(b-a),0,1));
const signed=(n,p)=>Math.sign(n)*Math.abs(n)**p;

// Rounded micro-EV: smooth coachwork, panoramic canopy, sculpted LED ribbons.
// Panels unfold from the torso; the original robot compacts inside them.
export function createTimVehicle(robot,materials) {
  const {body,head,arms,legs,collar}=robot;
  const hardware=new THREE.Group(),skin=new THREE.Group(),neck=new THREE.Group();
  hardware.name='tim-vehicle';skin.name='car-body';neck.name='folding-neck';
  robot.root.add(hardware,neck);hardware.add(skin);hardware.visible=neck.visible=false;
  const paint=new THREE.MeshStandardMaterial({color:0xf5f8f7,roughness:.28,metalness:.16});
  const glass=new THREE.MeshStandardMaterial({color:0x0e2934,roughness:.17,metalness:.3,side:THREE.DoubleSide});
  const lamps=new THREE.MeshBasicMaterial({color:0xc2fff2,toneMapped:false,side:THREE.DoubleSide});
  const tailLight=new THREE.MeshBasicMaterial({color:0xfe6c55,toneMapped:false,side:THREE.DoubleSide});
  const rimMuted=new THREE.MeshStandardMaterial({color:0x64797d,roughness:.45,metalness:.22});
  const hubMuted=new THREE.MeshStandardMaterial({color:0x214e56,roughness:.5,metalness:.12});
  const wheels=[],axles=[],eyes=[],links=[];
  const vector=new THREE.Vector3(),target=new THREE.Vector3(),axisY=new THREE.Vector3(0,1,0);
  const rotation=new THREE.Quaternion(),rest=new THREE.Quaternion(),euler=new THREE.Euler();
  const bodySections=[
    [-315,0,125,125],[-302,66,65,155],[-274,133,51,190],[-210,162,48,207],
    [-105,173,48,211],[20,174,48,210],[130,170,49,201],[225,155,54,190],
    [280,119,64,178],[305,65,88,152],[315,0,124,124],
  ];
  const cabinSections=[
    [-245,0,182,182],[-227,83,182,218],[-191,121,182,271],[-140,137,182,301],
    [-65,139,182,306],[13,132,182,296],[75,114,182,265],[118,74,182,221],[139,0,182,182],
  ];
  function sample(sections,u) {
    const q=clamp(u,0,1)*(sections.length-1),i=Math.min(sections.length-2,Math.floor(q)),t=q-i;
    return [0,1,2,3].map(k=>{
      const a=sections[Math.max(0,i-1)][k],b=sections[i][k],c=sections[i+1][k],d=sections[Math.min(sections.length-1,i+2)][k];
      return .5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    });
  }
  function atZ(sections,z) {
    let a=0,b=1;
    for(let i=0;i<22;i++){const t=(a+b)/2;if(sample(sections,t)[0]<z)a=t;else b=t;}
    return sample(sections,(a+b)/2);
  }
  function mesh(parent,g,material,name) {
    const item=new THREE.Mesh(g,material);if(name)item.name=name;parent.add(item);return item;
  }
  function loft(sections,dome,power) {
    const positions=[],indices=[],uv=[],long=80,round=dome?32:48;
    for(let j=0;j<=long;j++) {
      const[z,w,low,high]=sample(sections,j/long),width=Math.max(0,w),centre=(high+low)/2,radius=Math.max(0,(high-low)/2);
      for(let i=0;i<=round;i++){
        const t=i/round*(dome?Math.PI:Math.PI*2);
        const x=width*signed(Math.cos(t),power);
        let y=dome?low+(high-low)*Math.sin(t)**power:centre+radius*signed(Math.sin(t),power);
        if(!dome&&width>0){
          const dz=Math.min(Math.abs(z-195),Math.abs(z+195));
          if(dz<67){const arch=62+Math.sqrt(67*67-dz*dz);y+=(Math.max(y,arch)-y)*cue(Math.abs(x)/width,.5,.9);}
        }
        positions.push(x,y,z);
        uv.push(i/round,j/long);
      }
    }
    for(let j=0;j<long;j++)for(let i=0;i<round;i++){const k=j*(round+1)+i;indices.push(k,k+1,k+round+1,k+1,k+round+2,k+round+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    if(!dome){const normals=g.attributes.normal;for(let j=0;j<=long;j++){const a=j*(round+1),b=a+round;vector.set(normals.getX(a)+normals.getX(b),normals.getY(a)+normals.getY(b),normals.getZ(a)+normals.getZ(b)).normalize();normals.setXYZ(a,vector.x,vector.y,vector.z);normals.setXYZ(b,vector.x,vector.y,vector.z);}}
    return g;
  }
  function tube(parent,points,radius,material,name) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return mesh(parent,new THREE.TubeGeometry(curve,40,radius,8,false),material,name);
  }
  const coachwork=mesh(skin,loft(bodySections,false,.65),paint,'rounded-coachwork');
  const canopy=mesh(skin,loft(cabinSections,true,.82),glass,'panoramic-canopy');
  const roofPositions=[],roofIndices=[];
  for(let j=0;j<=40;j++){
    const z=-214+j*252/40,[,w,lo,hi]=atZ(cabinSections,z);
    for(let i=0;i<=24;i++){
      const theta=.64+i/24*(Math.PI-1.28);
      roofPositions.push((w+1.5)*signed(Math.cos(theta),.82),lo+(hi-lo+2)*Math.sin(theta)**.82,z);
    }
  }
  for(let j=0;j<40;j++)for(let i=0;i<24;i++){const k=j*25+i;roofIndices.push(k,k+1,k+25,k+1,k+26,k+25);}
  const roofGeometry=new THREE.BufferGeometry();roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofPositions,3));roofGeometry.setIndex(roofIndices);roofGeometry.computeVertexNormals();
  mesh(skin,roofGeometry,paint,'sculpted-white-roof');
  coachwork.updateMatrixWorld(true);canopy.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  function surface(item,x,y,rear=false) {
    ray.set(new THREE.Vector3(x,y,rear?-500:500),new THREE.Vector3(0,0,rear?1:-1));
    return ray.intersectObject(item,false)[0];
  }
  function ribbon(x0,x1,y,height,material,offset,name,rear=false) {
    const positions=[],indices=[];
    for(let j=0;j<=24;j++){
      const t=j/24,x=x0+(x1-x0)*t,h=height*Math.sin(Math.PI*t)**.3;
      for(const sign of [-1,1]){
        const yy=y+sign*h/2,hit=surface(coachwork,x,yy,rear);
        positions.push(x,yy,(hit?.point.z||(rear?-285:285))+(rear?-offset:offset));
      }
    }
    for(let j=0;j<24;j++){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return mesh(skin,g,material,name);
  }
  for(const side of [-1,1]){
    const lampHit=surface(coachwork,side*104,155),lampNormal=lampHit.face.normal.clone().normalize();
    const lampPod=new THREE.Group();skin.add(lampPod);lampPod.position.copy(lampHit.point).addScaledVector(lampNormal,3);lampPod.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),lampNormal);
    const housing=mesh(lampPod,new THREE.SphereGeometry(1,24,16),glass,'headlight-housing');housing.scale.set(18,20,4);
    mesh(lampPod,new THREE.TorusGeometry(12.5,2.5,8,32),lamps,'led-headlight-ring').position.z=3.5;
    const lens=mesh(lampPod,new THREE.SphereGeometry(1,20,12),lamps,'headlight-lens');lens.scale.set(9,9,2);lens.position.z=3.5;
    ribbon(side*87,side*140,144,8,tailLight,3,'rear-light',true);
    const points=[];
    for(let j=0;j<=16;j++){
      const z=-264+j*524/16,[,w,lo,hi]=atZ(bodySections,z),dy=Math.abs((94-(lo+hi)/2)/((hi-lo)/2));
      const x=w*Math.max(0,1-dy**(2/.65))**(.65/2);
      points.push([side*(x+2),94,z]);
    }
    tube(skin,points,2.7,materials.teal,'lower-teal-line');
    const pillar=[],[,cw,cl,ch]=atZ(cabinSections,-100);
    for(let j=0;j<=10;j++){const a=j/10*.85;pillar.push([side*(cw+2)*Math.cos(a)**.82,cl+(ch-cl+2)*Math.sin(a)**.82,-100]);}
    tube(skin,pillar,3.8,paint,'window-pillar');
    const mirror=mesh(skin,new THREE.SphereGeometry(1,20,12),paint,'mirror');
    mirror.position.set(side*155,209,65);mirror.scale.set(17,8,14);
    const handle=mesh(skin,new THREE.CapsuleGeometry(2.4,17,3,8),materials.metal,'flush-handle');
    handle.rotation.x=Math.PI/2;handle.position.set(side*172,156,-40);
  }
  ribbon(-65,65,111,10,glass,2,'smile-grille');
  ribbon(-16,16,157,3.5,tailLight,2,'tim-coral-mark');
  for(let i=0;i<2;i++){
    const hit=surface(canopy,i?45:-45,250);
    const normal=hit?.normal?.clone()||hit?.face.normal.clone()||new THREE.Vector3(0,.6,.8);
    const eye=mesh(skin,new THREE.PlaneGeometry(30,39),robot.eyes[i].mesh.material,'windscreen-eye');
    eye.position.copy(hit?.point||new THREE.Vector3(i?45:-45,250,85)).addScaledVector(normal,2.3);
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal.normalize());
    eye.userData.home=eye.position.clone();eye.renderOrder=2;eyes.push(eye);
  }

  const geometry={
    tyre:new THREE.CylinderGeometry(60,60,30,40),rim:new THREE.CylinderGeometry(42,42,32,32),
    hub:new THREE.CylinderGeometry(13,13,35,28),spoke:new THREE.BoxGeometry(4,24,4),
    axle:new THREE.CylinderGeometry(6,6,1,12),rail:new THREE.BoxGeometry(10,10,1),
    arch:new THREE.RingGeometry(61,67,40,1,0,Math.PI),
    archLip:new THREE.TorusGeometry(66,3.5,6,40,Math.PI),
    neck:new THREE.CylinderGeometry(10,10,1,12),
  };
  for(let end=0;end<2;end++){
    const axle=mesh(hardware,geometry.axle,materials.metal,'axle');axle.rotation.z=Math.PI/2;axles.push(axle);
    for(const side of [-1,1]){
      const pod=new THREE.Group(),spin=new THREE.Group(),ribs=[];pod.name='wheel-pod';hardware.add(pod);pod.add(spin);
      mesh(spin,geometry.tyre,materials.rubber).rotation.z=Math.PI/2;
      const rim=mesh(spin,geometry.rim,paint),hub=mesh(spin,geometry.hub,materials.teal);rim.rotation.z=hub.rotation.z=Math.PI/2;
      const arch=mesh(pod,geometry.arch,materials.rubber,'wheel-arch');arch.position.x=side*1;arch.rotation.y=side*Math.PI/2;
      const lip=mesh(pod,geometry.archLip,paint,'arch-lip');lip.position.x=side*2;lip.rotation.y=side*Math.PI/2;
      for(let j=0;j<5;j++){const angle=j*Math.PI*2/5,rib=mesh(spin,geometry.spoke,materials.metal);rib.position.set(side*18,Math.cos(angle)*26,Math.sin(angle)*26);rib.rotation.x=angle;ribs.push(rib);}
      wheels.push({pod,spin,side,end,rim,hub,ribs});
    }
  }
  const rails=[-1,1].map(side=>{const rail=mesh(hardware,geometry.rail,materials.metal,'chassis-rail');rail.position.x=side*70;return rail;});
  for(const side of [-1,1])links.push({side,link:mesh(neck,geometry.neck,materials.metal)});
  function stow(){
    for(const wheel of wheels)wheel.pod.position.set(wheel.side*65,200,wheel.end?-40:40);
    for(let end=0;end<2;end++){axles[end].position.set(0,200,end?-40:40);axles[end].scale.y=130;}
    for(const rail of rails){rail.position.y=200;rail.position.z=0;rail.scale.z=1;}
  }
  stow();
  hardware.traverse(item=>{if(item.isMesh&&!axles.includes(item)&&!rails.includes(item)&&!eyes.includes(item)){item.updateMatrix();item.matrixAutoUpdate=false;}});
  return{
    frontExtent:350,
    applyBody(blend,yaw,distance){
      const wasVisible=hardware.visible;hardware.visible=neck.visible=blend>.0001;
      const collarY=326-110*cue(blend,.12,.6);if(collar.position.y!==collarY){collar.position.y=collarY;collar.updateMatrix();}
      body.scale.setScalar(1-.4*cue(blend,.3,.8));head.scale.setScalar(1-.5*cue(blend,.22,.75));
      if(!hardware.visible){if(wasVisible)stow();return;}
      const carYaw=yaw*.88,fold=cue(blend,.16,.78),deploy=cue(blend,.16,.72),panels=cue(blend,.28,.8);
      hardware.rotation.y=carYaw;skin.scale.set(.35+.65*panels,.16+.84*panels,.15+.85*panels);skin.position.y=200*(1-panels);
      rotation.setFromEuler(euler.set(Math.PI/2,carYaw,0,'YXZ'));body.quaternion.slerp(rotation,fold);
      body.position.lerp(target.set(0,160,-120).applyAxisAngle(axisY,carYaw),fold);
      const lower=cue(blend,.18,.8),lift=32*cue(blend,0,.15);head.position.y+=lift+(190-head.position.y-lift)*lower;
      target.set(0,0,-70*cue(blend,.2,.65)).applyAxisAngle(axisY,carYaw);head.position.x=head.position.x*(1-lower)+target.x;head.position.z=target.z;
      rotation.setFromEuler(euler.set(Math.PI/2,carYaw,0,'YXZ'));head.quaternion.slerp(rotation,cue(blend,.18,.75));
      for(const{side,link}of links){
        vector.set(side*64,170,-72).multiplyScalar(body.scale.x).applyQuaternion(body.quaternion).add(body.position);
        target.set(side*64,-156,-45).multiplyScalar(head.scale.x).applyQuaternion(head.quaternion).add(head.position);
        link.position.copy(vector).lerp(target,.5);target.sub(vector);link.scale.y=Math.max(1,target.length());link.quaternion.setFromUnitVectors(axisY,target.normalize());
      }
      for(const wheel of wheels){
        wheel.pod.position.set(wheel.side*(65+109*deploy),200-138*deploy,(wheel.end?-1:1)*(40+155*deploy));wheel.spin.rotation.x=distance/60;
        const far=wheel.side*Math.sign(yaw)>0;wheel.rim.material=far?rimMuted:paint;wheel.hub.material=far?hubMuted:materials.teal;
        for(const rib of wheel.ribs)rib.material=far?hubMuted:materials.metal;
      }
      for(let end=0;end<2;end++){const p=wheels[end*2].pod.position;axles[end].position.set(0,p.y,p.z);axles[end].scale.y=(65+109*deploy)*2;}
      for(const rail of rails){rail.position.y=axles[0].position.y+45*deploy;rail.position.z=0;rail.scale.z=Math.max(1,Math.abs(axles[0].position.z-axles[1].position.z));}
    },
    applyLimbs(blend,yaw){
      if(blend<=0)return;const tuck=cue(blend,.02,.3),feet=cue(blend,.75,1),carYaw=yaw*.88;
      for(const arm of arms)arm.group.quaternion.slerp(rest,tuck);rotation.setFromEuler(euler.set(0,carYaw,0,'YXZ'));
      for(const leg of legs){target.set(leg.side*72,120,60).applyAxisAngle(axisY,carYaw);leg.foot.position.lerp(target,feet);leg.foot.quaternion.slerp(rotation,feet);}
    },
    applyEyes(open,gazeX,gazeY){
      for(const eye of eyes){eye.scale.y=Math.max(.05,open);eye.position.copy(eye.userData.home);eye.position.x+=gazeX*.35;eye.position.y+=gazeY*.2;}
    },
  };
}
