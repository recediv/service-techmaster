import * as THREE from 'three';

// The selected “Округлый” model. All poses use these same opaque shells.
export const TIM_HEIGHT = 692;
export const TIM_HEAD_Y = 500;
// Same coral red as .site-button--accent.
export const TIM_ACCENT = 0xfe6c55;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pow = (n, p) => Math.sign(n) * Math.abs(n) ** p;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const shape = { a: 188, b: 192, c: 158, e: .82 };

export function roundSurface(x, y) {
  const ph = Math.asin(clamp(pow(y / shape.b, 1 / shape.e), -.99999, .99999));
  const r = Math.cos(ph) ** shape.e;
  return shape.c * r * Math.sqrt(Math.max(0, 1 - (x / (shape.a * r || 1)) ** 2));
}

function shellGeometry(a, b, c, e, nu = 80, nv = 52) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const ph = -Math.PI / 2 + j / nv * Math.PI, r = j === 0 || j === nv ? 0 : Math.max(0, Math.cos(ph)) ** e, y = pow(Math.sin(ph), e);
    for (let i = 0; i <= nu; i++) {
      const th = -Math.PI + i / nu * Math.PI * 2;
      const seam = i === 0 || i === nu;
      pos.push(seam ? 0 : a * r * Math.sin(th), b * y, c * r * (seam ? -1 : Math.cos(th))); uv.push(i / nu, .5 + y * .5);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = j * (nu + 1) + i; idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const normals = g.attributes.normal;
  for (let i = 0; i <= nu; i++) {
    normals.setXYZ(i, 0, -1, 0); normals.setXYZ(nv * (nu + 1) + i, 0, 1, 0);
  }
  for (let j = 1; j < nv; j++) {
    const left = j * (nu + 1), right = left + nu;
    const normal = v(normals.getX(left) + normals.getX(right), normals.getY(left) + normals.getY(right), normals.getZ(left) + normals.getZ(right)).normalize();
    normals.setXYZ(left, normal.x, normal.y, normal.z); normals.setXYZ(right, normal.x, normal.y, normal.z);
  }
  return g;
}

function pillow(w, h, cy) {
  const p = [], x = -w / 2, y = cy - h / 2;
  const segments = [[[0,y],[w*.38,y],[w/2,y+h*.17],[w/2,y+h*.5]],[[w/2,y+h*.5],[w/2,y+h*.87],[w*.36,y+h],[0,y+h]],[[0,y+h],[-w*.36,y+h],[x,y+h*.87],[x,y+h*.5]],[[x,y+h*.5],[x,y+h*.17],[-w*.38,y],[0,y]]];
  for (const s of segments) for (let i = 0; i < 32; i++) {
    const t = i / 32, u = 1 - t;
    p.push([u**3*s[0][0]+3*u*u*t*s[1][0]+3*u*t*t*s[2][0]+t**3*s[3][0],u**3*s[0][1]+3*u*u*t*s[1][1]+3*u*t*t*s[2][1]+t**3*s[3][1]]);
  }
  return p;
}

export function roundFacePatch(cx, cy, rx, ry, offset = 2.4, nx = 24, ny = 28) {
  const g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = cx + (i/nx*2-1)*rx, y = cy + (j/ny*2-1)*ry;
    pos.push(x,y,roundSurface(x,y)+offset); uv.push(i/nx,j/ny);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * (nx + 1) + i; idx.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function createRoundTim() {
  const root = new THREE.Group(), head = new THREE.Group(), body = new THREE.Group();
  root.add(body, head); head.position.y = TIM_HEAD_Y;
  // Resources belong to this instance; hiding/reopening the mascot creates a fresh rig.
  const materials = new Map(), eyeMaps = new Map(), shells = new Map(), sphere = new THREE.SphereGeometry(1,24,16);
  const mat = color => {
    // Only the small chest indicator uses the exact button red; the shell trim stays teal.
    if (!materials.has(color)) materials.set(color,color===TIM_ACCENT
      ? new THREE.MeshBasicMaterial({color,toneMapped:false})
      : new THREE.MeshStandardMaterial({color,roughness:.52,metalness:.03}));
    return materials.get(color);
  };
  const white = 0xf5f8f7, teal = 0x028291;
  function shell(parent,a,b,c,e,color,x=0,y=0,z=0,nu=80,nv=52) {
    const key=[a,b,c,e,nu,nv].join(':');
    if(!shells.has(key))shells.set(key,shellGeometry(a,b,c,e,nu,nv));
    const mesh = new THREE.Mesh(shells.get(key),typeof color==='number'?mat(color):color);
    mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  }
  function ball(parent,color,x,y,z,rx,ry,rz) {
    const mesh=new THREE.Mesh(sphere,mat(color));mesh.position.set(x,y,z);mesh.scale.set(rx,ry,rz);parent.add(mesh);return mesh;
  }
  // Detail follows the 125px maximum; keep the head/display at their original resolution.
  shell(body,168,154,126,.90,white,0,200,0,48,32);
  const collar=shell(body,94,24,112,.70,teal,0,326,-8,40,20);
  const indicator=shell(body,32,5.4,3.6,.55,mat(TIM_ACCENT).clone(),0,222,127,24,12);
  const arms=[],legs=[];
  for (const side of [-1,1]) {
    const group=new THREE.Group();group.position.set(side*150,296,0);body.add(group);
    ball(group,teal,0,0,0,34,38,36);
    const wing=shell(group,36,86,34,.94,white,side*34,-46,4,32,24);wing.rotation.z=side*.60;
    const grip=v(side*74,-108,9);arms.push({group,side,grip,direction:grip.clone().normalize()});
    const foot=new THREE.Group();root.add(foot);foot.position.x=side*72;
    shell(foot,64,28,78,.72,white,0,30,28,40,24);
    shell(foot,58,7,70,.75,teal,0,8,28,40,16);legs.push({side,foot});
  }
  // A closed, uniformly white shell. Screen colours exist only on the front panel.
  shell(head,188,192,158,.82,white);
  const face=document.createElement('canvas');face.width=256;face.height=256;
  const ctx=face.getContext('2d');
  function polygon(points,color) {
    ctx.beginPath();points.forEach(([x,y],i)=>{
      const u=(x/328+.5)*face.width,w=(.5-(y+11)/296)*face.height;
      if(i)ctx.lineTo(u,w);else ctx.moveTo(u,w);
    });ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  polygon(pillow(314,284,-11),'#7aadb1');polygon(pillow(304,274,-11),'#0c2029');
  const faceTexture=new THREE.CanvasTexture(face);faceTexture.colorSpace=THREE.SRGBColorSpace;
  const visor=new THREE.Mesh(roundFacePatch(0,-11,164,148,.8,64,64),new THREE.MeshStandardMaterial({map:faceTexture,roughness:.36,metalness:.03,transparent:true,depthWrite:true}));
  visor.renderOrder=1;head.add(visor);
  function eyeMap(happy) {
    if(eyeMaps.has(happy))return eyeMaps.get(happy);
    const c=document.createElement('canvas');c.width=c.height=128;const e=c.getContext('2d');e.scale(.5,.5);
    // Canvas shadowBlur uses backing-store pixels rather than the drawing transform.
    e.shadowBlur=7;e.shadowColor='#68e9df';e.fillStyle='#9ffff1';e.strokeStyle='#a8fff2';
    if(happy){e.lineWidth=30;e.lineCap='round';e.beginPath();e.moveTo(42,154);e.quadraticCurveTo(128,30,214,154);e.stroke();}
    else{const gradient=e.createLinearGradient(0,25,0,231);gradient.addColorStop(0,'#b9fff2');gradient.addColorStop(1,'#66e5d6');e.fillStyle=gradient;e.beginPath();e.roundRect(39,29,178,198,77);e.fill();}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;eyeMaps.set(happy,texture);return texture;
  }
  const eyes=[-60,60].map(cx=>{
    const mesh=new THREE.Mesh(roundFacePatch(cx,-6,42,54),new THREE.MeshBasicMaterial({map:eyeMap(false),transparent:true,depthWrite:false,toneMapped:false}));
    mesh.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    // Runtime expression weights stay in [0,1]. Include every clamped gaze,
    // blink and alert deformation once, so culling/raycast never needs a
    // per-expression vertex scan. roundSurface decreases with |x| and |y|.
    const extentX=7.5+42*1.10,extentY=4.4+54*1.13;
    const minZ=roundSurface(Math.abs(cx)+extentX,6+extentY)+2.4;
    const maxZ=roundSurface(Math.max(0,Math.abs(cx)-extentX),0)+2.4;
    mesh.geometry.boundingSphere=new THREE.Box3(
      v(cx-extentX,-6-extentY,minZ),v(cx+extentX,-6+extentY,maxZ)
    ).expandByScalar(.01).getBoundingSphere(new THREE.Sphere());
    mesh.renderOrder=2;head.add(mesh);return {mesh,cx,last:null};
  });
  // The animal is drawn on the same curved display, never in front of the shell.
  const animalCanvas=document.createElement('canvas');animalCanvas.width=animalCanvas.height=256;
  const animalCtx=animalCanvas.getContext('2d'),animalTexture=new THREE.CanvasTexture(animalCanvas);
  animalCtx.scale(.5,.5);
  animalTexture.colorSpace=THREE.SRGBColorSpace;
  const animalScreen=new THREE.Mesh(roundFacePatch(0,-11,146,130,2.5,40,40),new THREE.MeshBasicMaterial({map:animalTexture,transparent:true,depthWrite:false,toneMapped:false}));
  animalScreen.renderOrder=2;animalScreen.visible=false;head.add(animalScreen);
  let eyesEnabled=true,animalFrame='',animalKind=null;
  const currentExpression={open:1,left:1,right:1,happy:false,gazeX:0,gazeY:0,alert:0};
  function syncEyesVisibility() {
    const visible=eyesEnabled&&!animalScreen.visible;
    let revealed=false;
    for(const eye of eyes){if(visible&&!eye.mesh.visible)revealed=true;eye.mesh.visible=visible;}
    if(revealed)applyExpression();
  }
  function drawAnimal(kind,t,reveal) {
    const c=animalCtx,mint='#a8fff2',coral='#fe8e7c';
    c.clearRect(0,0,512,512);c.save();
    // A short screen blink switches faces without displaying both at once.
    c.beginPath();c.rect(0,256*(1-reveal),512,512*reveal);c.clip();
    c.lineCap='round';c.lineJoin='round';c.shadowColor='#68e9df';c.shadowBlur=3;
    const path=(d,{fill=null,stroke=mint,width=12,alpha=1}={})=>{
      c.globalAlpha=alpha;c.lineWidth=width;const p=new Path2D(d);
      if(fill){c.fillStyle=fill;c.fill(p);}if(stroke){c.strokeStyle=stroke;c.stroke(p);}c.globalAlpha=1;
    };
    const oval=(x,y,rx,ry,fill=mint,alpha=1)=>{
      c.globalAlpha=alpha;c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,Math.max(1,ry),0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    };
    const blinkAt=kind==='rabbit'?2.5:1.15;
    const blink=1-.96*Math.max(0,1-Math.abs(t-blinkAt)/.13);
    const happy=kind==='cat'&&t>1.8&&t<4.3;
    const eye=(x,y)=>happy
      ?path(`M${x-20} ${y+7} Q${x} ${y-19} ${x+20} ${y+7}`,{width:13})
      :oval(x,y,17,23*blink);
    if(kind==='hello'){
      const ease=(a,b)=>{const q=clamp((t-a)/(b-a),0,1);return q*q*(3-2*q);};
      const task=ease(.7,1.03);
      if(task<1){
        c.save();c.globalAlpha=1-task;c.translate(256,253);c.rotate(Math.sin(t*7)*.10);
        c.fillStyle=mint;c.font='700 310px "Open Sans", Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('?',0,10);c.restore();
      }
      if(task>0){
        c.globalAlpha=task;
        path('M150 96 H292 L342 146 V348 H150 Z M292 96 V146 H342',{width:16,alpha:task});
        path('M190 180 H290 M190 231 H268 M190 280 H228',{width:14,alpha:task});
        const scan=166+118*(.5+.5*Math.sin((t-1)*4));
        path(`M177 ${scan} H312`,{width:8,alpha:task*.55});
        c.globalAlpha=task;c.strokeStyle=coral;c.lineWidth=22;c.beginPath();c.arc(325,310,55,0,Math.PI*2);c.moveTo(366,351);c.lineTo(403,390);c.stroke();
        c.fillStyle=mint;c.font='700 70px "Open Sans", Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('ЗАКАЗ?',256,428);c.globalAlpha=1;
      }
    }else if(kind==='boot'){
      const ease=(a,b)=>{const q=clamp((t-a)/(b-a),0,1);return q*q*(3-2*q);};
      const gather=ease(.2,1.08),confirm=ease(.92,1.5);
      path('M154 118 H119 V153 M358 118 H393 V153 M119 359 V394 H154 M358 394 H393 V359',{width:10,alpha:1-.7*confirm});
      // A scan sweep contracts into a small circuit core. Pixel trails arrive
      // at the centre before the confirmation stroke is drawn.
      const scanY=122+266*ease(0,.8);
      path(`M142 ${scanY} H370`,{width:8,alpha:1-ease(.6,.95)});
      for(let i=0;i<8;i++){
        const angle=i*Math.PI/4+t*1.6*(1-gather),radius=130*(1-gather)+19;
        const x=256+Math.cos(angle)*radius,y=256+Math.sin(angle)*radius;
        c.globalAlpha=1-confirm;c.fillStyle=i%3===0?coral:mint;
        c.beginPath();c.roundRect(x-9,y-9,18,18,4);c.fill();c.globalAlpha=1;
      }
      c.globalAlpha=confirm;c.strokeStyle=mint;c.lineWidth=12;
      c.beginPath();c.arc(256,256,100,0,Math.PI*2);c.stroke();
      const progress=clamp((t-1.04)/.46,0,1);
      c.lineWidth=20;c.beginPath();c.moveTo(204,256);
      if(progress<.35)c.lineTo(204+37*progress/.35,256+36*progress/.35);
      else{c.lineTo(241,292);c.lineTo(241+71*(progress-.35)/.65,292-78*(progress-.35)/.65);}
      c.stroke();c.globalAlpha=1;
    }else if(kind==='cat'){
      const ear=8*Math.sin(t*5)*Math.exp(-Math.max(0,t-1)*1.4);
      path(`M120 255 Q108 202 128 ${108+ear} Q161 115 195 154 Q255 136 316 154 Q349 115 385 108 Q404 202 392 255 C407 325 366 397 256 399 C145 397 105 325 120 255 Z`);
      path('M145 147 153 199 183 172 M367 147 359 199 329 172',{width:9,alpha:.5});
      eye(201,259);eye(311,259);
      path('M240 310 Q256 302 272 310 L256 325 Z',{fill:coral,stroke:null});
      path('M256 325 v9 Q242 353 228 338 M256 334 Q270 353 284 338',{width:10});
      const whisk=3*Math.sin(t*3.8);
      path(`M158 307 79 ${294+whisk} M158 328 80 ${342-whisk} M354 307 433 ${294-whisk} M354 328 432 ${342+whisk}`,{width:10});
    }else if(kind==='rabbit'){
      const twitch=13*Math.sin(t*6)*Math.exp(-Math.abs(t-1.45)*2.4);
      path(`M145 270 C125 316 155 414 256 414 C357 414 387 316 367 270 Q354 242 322 228 C356 140 ${350+twitch} 70 ${321+twitch} 68 C286 66 273 144 280 214 Q256 208 232 214 C239 144 226 66 191 68 C162 70 156 140 190 228 Q158 242 145 270 Z`);
      path(`M197 109 Q182 144 210 213 M${317+twitch*.65} 109 Q330 144 303 213`,{width:10,alpha:.5});
      eye(207,299);eye(305,299);
      oval(174,335,15,7,coral,.75);oval(338,335,15,7,coral,.75);
      path('M243 337 Q256 327 269 337 L256 351 Z',{fill:coral,stroke:null});
      path('M256 351 v7 Q241 371 228 355 M256 358 Q271 371 284 355',{width:9});
      c.fillStyle=mint;c.beginPath();c.roundRect(244,363,24,24,5);c.fill();
    }
    c.restore();animalTexture.needsUpdate=true;
  }
  function setScreenFace(kind,t=0,reveal=1) {
    const visible=kind==='cat'||kind==='rabbit'||kind==='boot'||kind==='hello';
    animalScreen.visible=visible;syncEyesVisibility();
    if(!visible){animalKind=null;animalFrame='';return;}
    const frame=`${kind}:${Math.floor(t*30)}:${Math.round(reveal*100)}`;
    if(frame===animalFrame&&kind===animalKind)return;
    animalFrame=frame;animalKind=kind;drawAnimal(kind,t,clamp(reveal,0,1));
  }
  function expression({open=1,left=1,right=1,happy=false,gazeX=0,gazeY=0,alert=0}={}) {
    currentExpression.open=open;currentExpression.left=left;currentExpression.right=right;
    currentExpression.happy=happy;currentExpression.gazeX=gazeX;currentExpression.gazeY=gazeY;currentExpression.alert=alert;
    applyExpression();
  }
  function applyExpression() {
    if(!eyesEnabled||animalScreen.visible)return;
    const {open,left,right,happy,gazeX,gazeY,alert}=currentExpression;
    eyes.forEach((eye,i)=>{
      // Happy arcs retain their height; a blink still closes the whole glyph.
      const opening=Math.max(.045,open*(happy?1:(i?right:left)));
      const gx=clamp(gazeX,-5,5)*1.5,gy=clamp(gazeY,-4,4)*1.1;
      const key=[opening,gx,gy,happy,alert].map(n=>typeof n==='number'?n.toFixed(3):n).join(':');
      if(key===eye.last)return;eye.last=key;eye.mesh.material.map=eyeMap(happy);
      const p=eye.mesh.geometry.attributes.position;
      for(let j=0;j<=28;j++)for(let k=0;k<=24;k++){
        const x=eye.cx+gx+(k/24*2-1)*42*(1+alert*.10),y=-6+gy+(j/28*2-1)*54*opening*(1+alert*.13);
        p.setXYZ(j*25+k,x,y,roundSurface(x,y)+2.4);
      }
      p.needsUpdate=true;
    });
  }
  const armDelta=v(0,0,0),armBaseDirection=v(0,0,0),armAxis=v(1,0,0),armBase=new THREE.Quaternion();
  function aimArm(index,target,output=new THREE.Vector3(),swing=0) {
    const arm=arms[index];armDelta.copy(target).sub(arm.group.position);
    if(swing?.isQuaternion)armBase.copy(swing);else armBase.setFromAxisAngle(armAxis,swing);
    armBaseDirection.copy(arm.direction).applyQuaternion(armBase);
    if(armDelta.lengthSq()>.001)arm.group.quaternion.setFromUnitVectors(armBaseDirection,armDelta.normalize()).multiply(armBase);
    // A rigid paddle, never a stretched human forearm. Props attach to the real tip.
    return output.copy(arm.grip).applyQuaternion(arm.group.quaternion).add(arm.group.position);
  }
  function rotateArm(index,rotation,output=new THREE.Vector3()) {
    const arm=arms[index];arm.group.quaternion.copy(rotation);
    return output.copy(arm.grip).applyQuaternion(rotation).add(arm.group.position);
  }
  // Animation changes rig groups, eye vertices and materials; these local mesh transforms stay fixed.
  root.traverse(object=>{if(object.isMesh){object.updateMatrix();object.matrixAutoUpdate=false;}});
  return {root,head,body,arms,legs,collar,indicator,eyes,expression,aimArm,rotateArm,setScreenFace,
    setEyesVisible(visible){eyesEnabled=visible;syncEyesVisibility();},
    dispose(){eyeMaps.forEach(texture=>texture.dispose());animalTexture.dispose();}
  };
}
