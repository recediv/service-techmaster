import * as THREE from 'three';
import { measureTimTerritory } from './tim-placement.mjs';
import { createPartsThought } from './tim-thought.mjs';
import { createTimVehicle } from './tim-vehicle.mjs';
import { createTimHitBatch } from './tim-hit-batch.mjs';
import { createRoundTim, roundFacePatch, roundSurface, TIM_HEIGHT, TIM_HEAD_Y, TIM_ACCENT } from './tim-model.mjs';

// The selected round robot shares one rig and interaction runtime across all routes.
export function createTimMascot({ stage, host, shadow, fiveTarget, playDot, partsButton, partsAvailable = false, thoughtBubble, height = 125, walking = true, firstVisitAttention = false, onFirstAttention = () => {}, onMenu = () => {} }) {
const lifetime = new AbortController();
const listen = (target, type, callback, options = {}) => target.addEventListener(type, event => {wake();callback(event);}, { ...options, signal: lifetime.signal });
let disposed = false, suspended = false, menuOpen = false, frameId = 0,frameTimer=0,staticFrameUntil=0,inFrame=false,hitGeneration=0;
function queueFrame(delay=0){
 if(disposed||suspended||frameId||frameTimer)return;
 if(delay>6){frameTimer=setTimeout(()=>{frameTimer=0;if(!disposed&&!suspended)frameId=requestAnimationFrame(frame);},delay);}
 else frameId=requestAnimationFrame(frame);
}
function wake(){
 staticFrameUntil=performance.now()+1600;
 if(frameTimer){clearTimeout(frameTimer);frameTimer=0;}
 if(!disposed&&!suspended&&!frameId&&!inFrame){last=frameClock=performance.now();queueFrame();}
}
let roaming = walking, roamTarget = null, roamRestUntil = 4, nextRoamDirection = -1;
let territory=null,territoryDirty=true,lastTerritoryAt=0,returning=false,carryBlend=0;
let orderPanel=null,orderReturn=null,orderMotion=0,orderStride=40,orderSwing=23,orderGrip=0,orderLean=0;
let vehicleBlend=0,vehicleYaw=0,vehicleDistance=0;
// Release the final push before the drawer leaves the viewport. The remaining
// closing time lets the feet settle before control returns to the idle scene.
const ORDER_RELEASE_FROM=1.9,ORDER_RELEASE_TO=2.4;
let stageBox={left:0,top:0,width:0,height:0};
const writeData=(element,key,value)=>{if(element.dataset[key]!==value)element.dataset[key]=value;};
const styleValues=new WeakMap();
function writeStyle(element,key,value){let values=styleValues.get(element);if(!values){values=new Map();styleValues.set(element,values);}if(values.get(key)!==value){if(key.startsWith('--'))element.style.setProperty(key,value);else element.style[key]=value;values.set(key,value);}}


const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-840,840,800,-40,1,4000);
camera.position.set(0,0,1800);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,failIfMajorPerformanceCaveat:true});
renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
host.replaceChildren(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
scene.add(new THREE.HemisphereLight(0xffffff,0x9badb4,1.6));
function light(color,intensity,x,y,z){const l=new THREE.DirectionalLight(color,intensity);l.position.set(x,y,z);scene.add(l)}
light(0xffffff,2.2,-400,600,800);light(0xdff5f4,.65,400,200,400);
const mats={
 ivory:new THREE.MeshStandardMaterial({color:0xf5f8f7,roughness:.52,metalness:.03}),
 teal:new THREE.MeshStandardMaterial({color:0x028291,roughness:.52,metalness:.03}),
 coral:new THREE.MeshStandardMaterial({color:0xfe6c55,roughness:.5,metalness:.03}),
 rubber:new THREE.MeshStandardMaterial({color:0x26373c,roughness:.6}),
 metal:new THREE.MeshStandardMaterial({color:0x8ba6ad,roughness:.3,metalness:.6}),
 mint:new THREE.MeshBasicMaterial({color:0xa8fff2,toneMapped:false}),
};
const robot=createRoundTim(),motionRig=robot.root,bodyRig=robot.body,headRig=robot.head;
const vehicle=createTimVehicle(robot,mats);
const legs=robot.legs;scene.add(motionRig);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t);
const signedPow=(x,p)=>Math.sign(x)*Math.pow(Math.abs(x),p);
const sphere=new THREE.SphereGeometry(1,40,28),up=new THREE.Vector3(0,1,0);
function ellipsoid(parent,mat,x,y,z,rx,ry,rz){const m=new THREE.Mesh(sphere,mat);m.position.set(x,y,z);m.scale.set(rx,ry,rz);parent.add(m);return m}
function curvedLine(parent,points,mat,r){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,40,r,8,false),mat);parent.add(mesh);return mesh;
}

/* SK-1-inspired rigid helmet: white shell, a face opening, and a clear front visor. */
const spaceHelmet=new THREE.Group();headRig.add(spaceHelmet);spaceHelmet.visible=false;
const helmetGlass=new THREE.Group(),helmetHardware=new THREE.Group();spaceHelmet.add(helmetGlass,helmetHardware);
// These fittings occupy only a few pixels at the maximum 125px character size.
// Keep the shell/visor smooth and leave the denser prop sphere unchanged.
const helmetFittingSphere=new THREE.SphereGeometry(1,20,14);
function helmetFitting(parent,mat,x,y,z,rx,ry,rz){
 const mesh=new THREE.Mesh(helmetFittingSphere,mat);mesh.position.set(x,y,z);mesh.scale.set(rx,ry,rz);
 mesh.updateMatrix();mesh.matrixAutoUpdate=false;parent.add(mesh);return mesh;
}
const helmetWhite=new THREE.MeshStandardMaterial({color:0xf4f3e9,roughness:.29,metalness:.04});
const helmetDark=new THREE.MeshStandardMaterial({color:0x31494a,roughness:.64});
const helmetMetal=new THREE.MeshStandardMaterial({color:0x9da79d,roughness:.36,metalness:.55});
const helmetRed=new THREE.MeshStandardMaterial({color:0xb93029,roughness:.45});
const helmetSolidMaterials=[helmetWhite,helmetDark,helmetMetal,helmetRed];
const helmetRX=224,helmetRY=235,helmetRZ=196,helmetCY=10;
function helmetSurface(x,y){return helmetRZ*Math.sqrt(Math.max(0,1-(x/helmetRX)**2-((y-helmetCY)/helmetRY)**2))}
function helmetOpening(a){return [168*signedPow(Math.cos(a),.83),-15+150*signedPow(Math.sin(a),.85)]}
function helmetSurfaceGeometry(inner,outer,radial=20,angular=128,offset=0){
 const pos=[],idx=[],uv=[];
 for(let j=0;j<=radial;j++)for(let i=0;i<=angular;i++){
  const a=i/angular*Math.PI*2,u=j/radial,p=inner(a),q=outer(a),x=p[0]+(q[0]-p[0])*u,y=p[1]+(q[1]-p[1])*u;
  pos.push(x,y,helmetSurface(x,y)+offset);uv.push((x/helmetRX+1)/2,((y-helmetCY)/helmetRY+1)/2);
 }
 for(let j=0;j<radial;j++)for(let i=0;i<angular;i++){const k=j*(angular+1)+i;idx.push(k,k+angular+1,k+1,k+1,k+angular+1,k+angular+2)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const helmetFront=new THREE.Mesh(helmetSurfaceGeometry(helmetOpening,a=>[helmetRX*Math.cos(a),helmetCY+helmetRY*Math.sin(a)]),helmetWhite);helmetHardware.add(helmetFront);
const helmetBack=new THREE.Mesh(new THREE.SphereGeometry(1,80,48,Math.PI,Math.PI),helmetWhite);helmetBack.scale.set(helmetRX,helmetRY,helmetRZ);helmetBack.position.y=helmetCY;helmetHardware.add(helmetBack);
function helmetRim(radius,offset,material){
 const points=[];for(let i=0;i<128;i++){const p=helmetOpening(i/128*Math.PI*2);points.push(new THREE.Vector3(p[0],p[1],helmetSurface(...p)+offset))}
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),160,radius,10,true),material);helmetHardware.add(mesh);return mesh;
}
helmetRim(10,3,helmetDark);helmetRim(3.4,10,helmetMetal);
const helmetVisorMat=new THREE.ShaderMaterial({
 transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{reveal:{value:0}},
 vertexShader:`varying vec3 vn;varying vec3 vv;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vn=normalize(normalMatrix*normal);vv=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
 fragmentShader:`uniform float reveal;varying vec3 vn;varying vec3 vv;void main(){float edge=pow(1.-abs(dot(normalize(vn),normalize(vv))),2.);gl_FragColor=vec4(.68,.91,.94,(.025+.18*edge)*reveal);}`
});
const helmetVisor=new THREE.Mesh(helmetSurfaceGeometry(()=>[0,-21],helmetOpening,28,128,8),helmetVisorMat);helmetGlass.add(helmetVisor);
helmetVisor.renderOrder=4;
const helmetGlintMat=new THREE.MeshBasicMaterial({color:0xf2ffff,transparent:true,opacity:0,depthWrite:false});
function visorGlint(points,r){const mesh=curvedLine(helmetGlass,points.map(([x,y])=>[x,y,helmetSurface(x,y)+10]),helmetGlintMat,r);mesh.renderOrder=5;return mesh;}
visorGlint([[-153,67],[-143,83],[-125,95],[-109,101]],3.3);
visorGlint([[163,20],[169,0],[170,-19]],2.1);
helmetGlass.traverse(o=>o.userData.noPick=true);
const helmetLetterCanvas=document.createElement('canvas');helmetLetterCanvas.width=512;helmetLetterCanvas.height=128;
const helmetLetters=helmetLetterCanvas.getContext('2d');helmetLetters.font='900 107px Arial';helmetLetters.textAlign='center';helmetLetters.textBaseline='middle';
helmetLetters.fillStyle='#bb2925';helmetLetters.translate(256,68);helmetLetters.scale(454/helmetLetters.measureText('СССР').width,1);helmetLetters.fillText('СССР',0,0);
const helmetLetterTex=new THREE.CanvasTexture(helmetLetterCanvas);helmetLetterTex.colorSpace=THREE.SRGBColorSpace;
const helmetLetterMat=new THREE.MeshStandardMaterial({map:helmetLetterTex,alphaTest:.15,roughness:.5,depthWrite:true});
helmetSolidMaterials.push(helmetLetterMat);
const helmetLetterPos=[],helmetLetterUV=[],helmetLetterIdx=[];
for(let j=0;j<=8;j++)for(let i=0;i<=36;i++){const x=-116+i/36*232,y=148+j/8*61;helmetLetterPos.push(x,y,helmetSurface(x,y)+1);helmetLetterUV.push(i/36,j/8)}
for(let j=0;j<8;j++)for(let i=0;i<36;i++){const k=j*37+i;helmetLetterIdx.push(k,k+1,k+37,k+1,k+38,k+37)}
const helmetLetterGeo=new THREE.BufferGeometry();helmetLetterGeo.setAttribute('position',new THREE.Float32BufferAttribute(helmetLetterPos,3));helmetLetterGeo.setAttribute('uv',new THREE.Float32BufferAttribute(helmetLetterUV,2));helmetLetterGeo.setIndex(helmetLetterIdx);helmetLetterGeo.computeVertexNormals();
helmetHardware.add(new THREE.Mesh(helmetLetterGeo,helmetLetterMat));
for(const side of [-1,1]){
 const pivot=new THREE.Group();pivot.position.set(side*214,24,48);helmetHardware.add(pivot);
 helmetFitting(pivot,helmetWhite,0,0,0,14,32,30);helmetFitting(pivot,helmetMetal,side*10,0,0,5,17,17);helmetFitting(pivot,helmetDark,side*14,0,0,2.5,7,7);
 const bx=side*184,by=84;helmetFitting(helmetHardware,helmetMetal,bx,by,helmetSurface(bx,by)+4,5,5,3);
}
const helmetCollar=new THREE.Group();helmetCollar.position.y=-204;helmetHardware.add(helmetCollar);
for(const [y,r,t,m]of [[0,125,10,helmetMetal],[-12,119,7,helmetDark],[9,124,6,helmetWhite]]){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(r,t,12,80),m);ring.rotation.x=Math.PI/2;ring.scale.y=.68;ring.position.y=y;helmetCollar.add(ring);
}
helmetFitting(helmetCollar,helmetMetal,0,4,100,19,12,7);helmetFitting(helmetCollar,helmetRed,0,4,107,8,5,2);
helmetHardware.traverse(object=>{if(object.isMesh)object.renderOrder=3;});
let helmetOn=false,helmetAmount=0,helmetHighTime=0;
let helmetWarmIdle=null,helmetWarmTimer=null,helmetCompile=null,helmetDeferredTask=null;
function queueHelmetWarmup(task){
 const run=()=>{
  helmetWarmIdle=helmetWarmTimer=null;
  if(disposed)return;
  if(suspended){helmetDeferredTask=task;return;}
  if(physical()||orderPanel||helmetOn){helmetWarmTimer=setTimeout(()=>queueHelmetWarmup(task),350);return;}
  task();
 };
 if('requestIdleCallback'in window)helmetWarmIdle=requestIdleCallback(run,{timeout:1600});
 else helmetWarmTimer=setTimeout(run,160);
}
function withHelmetVariant(transparent,task){
 const saved=helmetSolidMaterials.map(m=>[m.transparent,m.depthWrite,m.opacity]);
 helmetSolidMaterials.forEach(m=>{if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}m.depthWrite=!transparent;m.opacity=transparent?.5:1;});
 try{return task();}finally{
  helmetSolidMaterials.forEach((m,i)=>{const[t,d,o]=saved[i];if(m.transparent!==t){m.transparent=t;m.needsUpdate=true;}m.depthWrite=d;m.opacity=o;});
 }
}
function prepareHelmet(transparent=true){
 // r180 compiles every mesh in this subtree, using the real scene's lights.
 // Prepare both fading and opaque shader variants before the first lift.
 helmetCompile=withHelmetVariant(transparent,()=>renderer.compileAsync(spaceHelmet,camera,scene));
 helmetCompile.then(()=>{
  if(disposed)return;
  queueHelmetWarmup(()=>{
   const visible=spaceHelmet.visible,autoClear=renderer.autoClear,scissorTest=renderer.getScissorTest(),scissor=renderer.getScissor(new THREE.Vector4());
   try{
    spaceHelmet.visible=true;renderer.autoClear=false;
    // A zero-area scissor uploads the real geometry/texture/program without
    // touching a visible pixel or allocating a second drawing surface.
    renderer.setScissor(0,0,0,0);renderer.setScissorTest(true);
    withHelmetVariant(transparent,()=>renderer.render(scene,camera));
   }finally{spaceHelmet.visible=visible;renderer.autoClear=autoClear;renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);}
   if(transparent)queueHelmetWarmup(()=>prepareHelmet(false));
  });
 }).catch(()=>{});
}
function updateHelmet(dt){
 const highAt=Math.max(110,ceiling*.48);
 if(state==='held'){
  if(elevation>highAt){helmetHighTime+=dt;if(helmetHighTime>.22){helmetOn=true;jetArmed=true}}else helmetHighTime=0;
  if(elevation<highAt*.61){helmetOn=false;jetArmed=false}
 }else if(state==='air'&&jetArmed){helmetOn=true;helmetHighTime=0}
 else if(state==='land'&&time-jetLandedAt<.65){helmetOn=true}
 else{helmetOn=false;helmetHighTime=0}
 helmetAmount+=((helmetOn?1:0)-helmetAmount)*(1-Math.exp(-dt*(helmetOn?8:9)));
 if(helmetAmount<.003&&!helmetOn)helmetAmount=0;
 const q=smooth(helmetAmount);spaceHelmet.visible=q>.001;
 spaceHelmet.scale.setScalar(.95+.05*q);spaceHelmet.position.y=(1-q)*12;
 helmetSolidMaterials.forEach(m=>{const transparent=q<.999;if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true}m.depthWrite=!transparent;m.opacity=q});
 helmetVisorMat.uniforms.reveal.value=q;helmetGlintMat.opacity=.68*q*q;

 writeData(host,'helmet',helmetOn?'on':'off');
}

const batteryCanvas=document.createElement('canvas');batteryCanvas.width=256;batteryCanvas.height=128;
const batteryCtx=batteryCanvas.getContext('2d'),batteryTex=new THREE.CanvasTexture(batteryCanvas);batteryTex.colorSpace=THREE.SRGBColorSpace;
batteryCtx.scale(.5,.5);
const batteryFace=new THREE.Mesh(roundFacePatch(0,-6,115,57),new THREE.MeshBasicMaterial({map:batteryTex,transparent:true,depthWrite:false,toneMapped:false}));batteryFace.renderOrder=2;headRig.add(batteryFace);batteryFace.visible=false;
const projectorFace=new THREE.Group();headRig.add(projectorFace);projectorFace.visible=false;
const projectorMaterials=[];
for(const [radius,width,opacity]of [[55,3,.35],[39,4,.75]]){
 const material=new THREE.MeshBasicMaterial({color:0xb6fff0,transparent:true,opacity,depthWrite:false,toneMapped:false});
 const ring=new THREE.Mesh(new THREE.RingGeometry(radius-width,radius,64),material);
 ring.position.set(0,-6,roundSurface(0,-6)+3);ring.renderOrder=3;projectorFace.add(ring);projectorMaterials.push([material,opacity]);
}
const projectorCoreMat=new THREE.MeshBasicMaterial({color:0xf0fff8,transparent:true,depthWrite:false,toneMapped:false});
const projectorCore=new THREE.Mesh(new THREE.CircleGeometry(24,48),projectorCoreMat);projectorCore.position.set(0,-6,roundSurface(0,-6)+4);projectorCore.renderOrder=3;projectorFace.add(projectorCore);projectorMaterials.push([projectorCoreMat,1]);
let batteryLast=-1;
function drawBattery(amount){
 const step=Math.round(amount*100);if(step===batteryLast)return;batteryLast=step;
 const c=batteryCtx;c.clearRect(0,0,512,256);c.strokeStyle='#cffff0';c.lineWidth=12;c.lineJoin='round';
 c.beginPath();c.roundRect(36,54,406,148,23);c.stroke();
 c.fillStyle='#cffff0';c.beginPath();c.roundRect(448,101,27,54,8);c.fill();
 const width=Math.max(5,366*amount);c.fillStyle=amount<.3?'#ffb278':amount<.7?'#f6da77':'#93ffd1';c.beginPath();c.roundRect(56,74,width,108,10);c.fill();
 if(amount>.99){c.strokeStyle='#174d53';c.lineWidth=13;c.lineCap='round';c.beginPath();c.moveTo(206,126);c.lineTo(232,151);c.lineTo(279,104);c.stroke();}
 batteryTex.needsUpdate=true;
}
function setBattery(on){batteryFace.visible=on;robot.setEyesVisible(!on);}

/* The thrusters use the real foot positions; their light is never an input surface. */
let jetArmed=false,jetFiring=false,jetPower=0,jetThrust=0,jetLandedAt=-10;
const jetCanvas=document.createElement('canvas');jetCanvas.classList.add('tim-mascot__jets');jetCanvas.setAttribute('aria-hidden','true');
jetCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none';
jetCanvas.width=jetCanvas.height=1;
stage.append(jetCanvas);const jetCtx=jetCanvas.getContext('2d');let jetDPR=1,jetW=0,jetH=0,jetDirty=false;
function resizeJetEffects(w,h){jetDPR=Math.min(devicePixelRatio||1,2);jetW=w;jetH=h;}
function releaseJetSurface(){if(jetCanvas.width!==1||jetCanvas.height!==1){jetCanvas.width=jetCanvas.height=1;}jetDirty=false;}
function ensureJetSurface(){
 const w=Math.round(jetW*jetDPR),h=Math.round(jetH*jetDPR);
 if(jetCanvas.width!==w||jetCanvas.height!==h){jetCanvas.width=w;jetCanvas.height=h;jetCtx.setTransform(jetDPR,0,0,jetDPR,0,0);}
}
const jetNozzles=legs.map(leg=>{
 const g=new THREE.Group();g.position.set(0,1,28);leg.foot.add(g);g.visible=false;
 const rim=new THREE.Mesh(new THREE.TorusGeometry(20,4.5,10,32),mats.metal);rim.rotation.x=Math.PI/2;g.add(rim);
 const bore=new THREE.Mesh(new THREE.CylinderGeometry(16,16,3,24),mats.rubber);g.add(bore);
 const lightMat=new THREE.MeshBasicMaterial({color:0xffe3a2}),light=new THREE.Mesh(new THREE.CircleGeometry(13,24),lightMat);light.rotation.x=Math.PI/2;light.position.y=-2;g.add(light);return {g,light,mat:lightMat};
});
function updateJetEffects(){
 if(jetDirty){jetCtx.clearRect(0,0,jetW,jetH);jetDirty=false;}
 jetNozzles.forEach(n=>{n.g.visible=helmetAmount>.35||jetPower>.02;n.light.visible=jetPower>.02});
 writeData(host,'jets',jetFiring?'on':'off');
 if(jetPower<.008){releaseJetSurface();return;}
 ensureJetSurface();
 jetDirty=true;scene.updateMatrixWorld(true);
 const c=jetCtx;
 for(let i=0;i<legs.length;i++){
  const p=legs[i].foot.localToWorld(new THREE.Vector3(0,-2,28)),sx=x+p.x*scale,sy=ground-elevation-p.y*scale;
  const gap=Math.max(0,ground-sy),pulse=.94+.06*Math.sin(time*41+i*2.7),length=Math.min((90+145*jetPower)*scale*pulse,Math.max(0,gap-1));
  const width=(17+11*jetPower)*scale,lean=clamp(-vx/180,-1,1)*width*.6;
  if(length>1){
   c.save();c.globalAlpha=Math.min(1,jetPower*1.6);
   const fire=c.createLinearGradient(0,sy,0,sy+length);fire.addColorStop(0,'#fcfff4');fire.addColorStop(.16,'#fff4ad');fire.addColorStop(.45,'#ffb84d');fire.addColorStop(.8,'#ff7440');fire.addColorStop(1,'#ff643400');
   c.fillStyle=fire;c.shadowColor='#ffb347';c.shadowBlur=6+jetPower*4;
   c.beginPath();c.moveTo(sx-width,sy);c.bezierCurveTo(sx-width*1.08,sy+length*.27,sx-width*.25+lean,sy+length*.76,sx+lean,sy+length);
   c.bezierCurveTo(sx+width*.28+lean,sy+length*.64,sx+width,sy+length*.3,sx+width,sy);c.closePath();c.fill();
   const core=c.createLinearGradient(0,sy,0,sy+length*.7);core.addColorStop(0,'#e5ffff');core.addColorStop(.25,'#fffef5');core.addColorStop(1,'#fff1a000');
   c.fillStyle=core;c.shadowBlur=0;c.beginPath();c.moveTo(sx-width*.5,sy);c.quadraticCurveTo(sx-width*.45,sy+length*.4,sx+lean*.5,sy+length*.7);c.quadraticCurveTo(sx+width*.45,sy+length*.4,sx+width*.5,sy);c.closePath();c.fill();
   c.restore();
  }
  const proximity=1-clamp(gap/(150*scale),0,1);
  if(proximity>0){
   c.save();c.translate(sx,ground-1);c.scale(1,.22);
   const radius=(40+proximity*35)*scale,g=c.createRadialGradient(0,0,0,0,0,radius);g.addColorStop(0,'rgba(255,186,79,'+(proximity*jetPower*.6)+')');g.addColorStop(1,'rgba(255,143,63,0)');
   c.fillStyle=g;c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();c.restore();
  }
 }
}

/* Reusable, code-built props. Coordinates share the robot's rig and never resize him. */
const props=new THREE.Group();motionRig.add(props);
const propMat={
 cream:new THREE.MeshStandardMaterial({color:0xf5f8f7,roughness:.55}),
 yellow:new THREE.MeshStandardMaterial({color:0xffcf58,roughness:.4}),
 dark:new THREE.MeshStandardMaterial({color:0x174e58,roughness:.5}),
 silver:new THREE.MeshStandardMaterial({color:0xb9dddb,roughness:.3,metalness:.5}),
 bulb:new THREE.MeshStandardMaterial({color:0xffedac,roughness:.25,emissive:0xffb52e,emissiveIntensity:0})
};
function roundedBox(parent,w,h,d,r,mat,x=0,y=0,z=0){
 const g=new THREE.BoxGeometry(w,h,d,5,5,5),a=g.attributes.position;
 for(let i=0;i<a.count;i++){
  const p=new THREE.Vector3(a.getX(i),a.getY(i),a.getZ(i)),c=new THREE.Vector3(clamp(p.x,-w/2+r,w/2-r),clamp(p.y,-h/2+r,h/2-r),clamp(p.z,-d/2+r,d/2-r));
  p.sub(c).normalize().multiplyScalar(r).add(c);a.setXYZ(i,p.x,p.y,p.z);
 }
 g.computeVertexNormals();const mesh=new THREE.Mesh(g,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function propGroup(){const group=new THREE.Group();props.add(group);group.visible=false;return group}
function rod(parent,mat,r){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,12),mat);parent.add(mesh);return mesh}
function setRod(mesh,a,b){const delta=new THREE.Vector3().subVectors(b,a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(1,Math.max(.01,delta.length()),1);mesh.quaternion.setFromUnitVectors(up,delta.normalize())}
const partsPole=propGroup(),partsPoleMat=new THREE.MeshStandardMaterial({color:0xc99558,roughness:.8});
const partsPoleShaft=rod(partsPole,partsPoleMat,8);
function haloTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,5,64,64,64);
 g.addColorStop(0,'rgba(255,216,101,.65)');g.addColorStop(.35,'rgba(255,203,72,.24)');g.addColorStop(1,'rgba(255,203,72,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
const softGlow=haloTexture();
const bulbProp=propGroup();
ellipsoid(bulbProp,propMat.bulb,0,78,0,47,53,41);
roundedBox(bulbProp,42,35,40,9,propMat.cream,0,31,0);
for(let i=0;i<3;i++)roundedBox(bulbProp,45,5,43,2,propMat.silver,0,16+i*10,0);
roundedBox(bulbProp,45,22,42,8,mats.coral,0,1,0);
const bulbGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:softGlow,transparent:true,depthWrite:false,opacity:0}));
bulbGlow.position.set(0,77,-12);bulbGlow.scale.set(235,235,1);bulbProp.add(bulbGlow);
const bulbLight=new THREE.PointLight(0xffc35e,0,850,1);props.add(bulbLight);
const cableCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,178,-80),new THREE.Vector3(80,64,-30),new THREE.Vector3(180,32,35),new THREE.Vector3(250,185,58)]);
const cableGeometry=new THREE.TubeGeometry(cableCurve,32,7,8,false),cablePoint=new THREE.Vector3();
cableGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);cableGeometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
const cableRings=Array.from({length:9},(_,i)=>[-Math.cos(i/8*Math.PI*2),Math.sin(i/8*Math.PI*2)]);
const cableProp=propGroup(),cableMesh=new THREE.Mesh(cableGeometry,mats.teal);cableProp.add(cableMesh);
let cableLast=-1;
function drawCable(points,t){
 if(t-cableLast<.035)return;cableLast=t;
 for(let i=0;i<4;i++)cableCurve.points[i].copy(points[i]);
 cableCurve.updateArcLengths();const frames=cableCurve.computeFrenetFrames(32,false),position=cableGeometry.attributes.position,normal=cableGeometry.attributes.normal;
 // Same TubeGeometry sampling and winding, with persistent GPU buffers/UV/index.
 for(let i=0;i<=32;i++){
  cableCurve.getPointAt(i/32,cablePoint);const n=frames.normals[i],b=frames.binormals[i];
  for(let j=0;j<=8;j++){const [cos,sin]=cableRings[j],nx=cos*n.x+sin*b.x,ny=cos*n.y+sin*b.y,nz=cos*n.z+sin*b.z,k=i*9+j;
   normal.setXYZ(k,nx,ny,nz);position.setXYZ(k,cablePoint.x+7*nx,cablePoint.y+7*ny,cablePoint.z+7*nz);
  }
 }
 position.needsUpdate=normal.needsUpdate=true;cableGeometry.computeBoundingSphere();
}
const socketProp=propGroup();
roundedBox(socketProp,76,146,48,12,mats.teal,0,-27,-5);
roundedBox(socketProp,114,15,75,7,propMat.cream,0,-92,0);
roundedBox(socketProp,104,125,62,18,propMat.cream,0,125,0);
roundedBox(socketProp,82,100,8,4,mats.teal,0,128,34);
ellipsoid(socketProp,propMat.dark,0,131,43,31,35,8);
for(const s of [-1,1])roundedBox(socketProp,9,22,5,3,propMat.silver,s*13,131,52);
const chargeLamp=new THREE.MeshStandardMaterial({color:0x7de6a0,emissive:0x43ff9a,emissiveIntensity:.2});
const chargeBars=[];for(let i=0;i<3;i++)chargeBars.push(roundedBox(socketProp,17,11,5,3,chargeLamp,-25+i*25,172,41));
const chargingPlug=propGroup();roundedBox(chargingPlug,51,43,39,12,mats.coral);roundedBox(chargingPlug,25,13,10,3,propMat.silver,0,0,-23);
const bench=propGroup();roundedBox(bench,310,38,160,15,propMat.cream,0,19,-28);
const sparkProp=propGroup();
const sparkPoints=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?7:28;sparkPoints.push(new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r))}
const sparkShape=new THREE.Shape(sparkPoints);
for(let i=0;i<3;i++){const star=new THREE.Mesh(new THREE.ShapeGeometry(sparkShape),mats.mint);sparkProp.add(star)}

const magnifier=propGroup();
const lensRing=new THREE.Mesh(new THREE.TorusGeometry(48,8,12,48),mats.coral);lensRing.position.set(0,67,0);magnifier.add(lensRing);
const lensGlass=new THREE.Mesh(new THREE.CircleGeometry(40,48),new THREE.MeshStandardMaterial({color:0xa4e3e5,transparent:true,opacity:.16,roughness:.1,depthWrite:false}));lensGlass.position.set(0,67,0);magnifier.add(lensGlass);
roundedBox(magnifier,18,61,18,8,mats.teal,0,0,0);
curvedLine(magnifier,[[-25,82,3],[-19,94,3],[-9,101,3]],mats.ivory,3);
const mapProp=propGroup();
roundedBox(mapProp,155,126,5,5,propMat.cream,0,35,0);
curvedLine(mapProp,[[-66,50,5],[-29,31,5],[13,45,5],[66,25,5]],mats.teal,3.5);
curvedLine(mapProp,[[-30,88,5],[-20,38,5],[-32,-20,5]],mats.teal,3.5);
curvedLine(mapProp,[[33,88,5],[21,38,5],[35,-20,5]],propMat.yellow,5);
const pin=new THREE.Mesh(new THREE.TorusGeometry(15,5,10,30),mats.coral);pin.position.set(25,48,10);mapProp.add(pin);
curvedLine(mapProp,[[12,36,10],[25,16,10],[38,36,10]],mats.coral,5);

const statusLight=robot.indicator,statusGlow=new THREE.Color(0xffffff);

const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');
let sizePx=clamp(Number(height)||125,75,125);
let scale=.3,actorWidth=96,ground=0,left=0,right=0,ceiling=300,x=null,elevation=0;
let mode='front',state=reducedMotion.matches||!firstVisitAttention?'front':'greet',stateTime=0,dir=1,yaw=0,headYaw=0,phase=0,speed=0,gaitBlend=0,manualTurn=false;
let last=performance.now(),frameClock=last,time=0,nextBlink=2.2,blinkStart=-10;
let pointer={x:0,y:0,until:0},oldStatus='',gesture=null,dragVX=0,dragVY=0,vx=0,vy=0,roll=0,rollVelocity=0,heldBlend=0,impact=0,impactAge=10,bounces=0;
const v=(x,y,z)=>new THREE.Vector3(x,y,z),axisX=v(1,0,0),axisY=v(0,1,0),axisZ=v(0,0,1);
const physical=()=>gesture!==null||state==='held'||state==='air'||state==='land';

const actDurations={projection:Infinity,stretch:11,bulb:7.4,charge:9,rest:8.2,recover:3.6,inspect:4.8,found:2.6,empty:3.5,contact:6.2,read:3.5,typing:1.6,tap:1.5,pet:3.2,five:8,follow:90};
const actLabels={projection:'Проецирует страницу',stretch:'Делает зарядку',bulb:'Проверяет лампочку',charge:'Уютная подзарядка',rest:'Перерыв',recover:'Приводит себя в порядок',inspect:'Ищет вместе с тобой',found:'Нашёл — показывает результат',empty:'Предлагает очистить запрос',contact:'Показывает, как связаться',read:'Читает ответ вместе с тобой',typing:'Следит за вводом',tap:'Заметил прикосновение',pet:'Нравится, когда гладят',five:'Ждёт, когда дашь пять',follow:'Играет с курсором'};
const animalFaces=['cat','rabbit'];
const isAnimalScene=kind=>animalFaces.includes(kind);
Object.assign(actDurations,{cat:6.8,rabbit:6.2,boot:2.3});
Object.assign(actLabels,{cat:'Показывает кота',rabbit:'Показывает зайца',boot:'Завершает проекцию'});

actDurations.order=Infinity;
actLabels.order='Открывает проверку заказа';
let act=null,pendingScene=null,autoScenes=walking,nextActAt=18,autoIndex=0,autoAnimalIndex=0,landingSeverity=0,forceRecovery=false;
const autoOrder=['cat','stretch','rabbit','rest','bulb','cat','rabbit','charge'];
const cue=(t,a,b)=>smooth(clamp((t-a)/(b-a),0,1));
// A full-size item travels behind the torso, around its side, then into the hand.
// The reverse path hides it behind the opaque body before its scene is removed.
function carryPhase(t,d){return cue(t,.65,1.9)*(1-cue(t,d-1.9,d-.65))}
function carryHand(side,q,goal){
 const rear=v(side*20,270,-80),edge=v(side*302,265,-40),front=v(side*248,290,150);
 if(q<.4)return rear.lerp(edge,smooth(q/.4));
 if(q<.72)return edge.lerp(front,smooth((q-.4)/.32));
 return front.lerp(v(...goal),smooth((q-.72)/.28));
}
function gripProp(group,point,grip,rotation){
 group.rotation.set(...rotation);
 group.position.copy(point).sub(v(...grip).applyQuaternion(group.quaternion));
}
const pose={bodyY:0,headY:0,bodyPitch:0,bodyRoll:0,headPitch:0,headRoll:0,sit:0,floorSit:0,eyeL:1,eyeR:1,joy:0};
const neutralPose={...pose},poseKeys=Object.keys(pose);
const scriptedHands=[{point:v(0,0,0),mix:0},{point:v(0,0,0),mix:0}];
let actTarget=null,interactionLook=0,gazeX=0,gazeY=0;
let tapLast=-20,tapVariant=0,petLean=0,petUntil=0,controlsUntil=0,playPoint={x:0,y:0,until:0},followDistance=0;
let attentionHovered=false,attentionUntil=0,orderTriggerAttention=false;
let awaitingIntroduction=firstVisitAttention,invitationBlend=0,invitationScreenBlend=0;
const walkArmAngles=[0,0],walkArmRotations=[new THREE.Quaternion(),new THREE.Quaternion()];
const partsThought=createPartsThought({element:thoughtBubble,wake,writeStyle});
function acknowledgeIntroduction(){
 if(!awaitingIntroduction)return;
 awaitingIntroduction=false;onFirstAttention();roamRestUntil=Math.max(roamRestUntil,time+8);
}
const hasAttention=()=>!orderPanel&&!physical()&&!menuOpen&&(orderTriggerAttention||attentionHovered||performance.now()<attentionUntil)&&(!act||act.kind==='follow');

function hideProps(){
 for(const p of [bulbProp,cableProp,socketProp,chargingPlug,bench,sparkProp,magnifier,mapProp,partsPole])p.visible=false;
 bulbLight.intensity=0;statusLight.material.color.set(TIM_ACCENT);
}
function cancelAct(){
 const projection=act?.projection;act=null;projection?.cancel();
 pendingScene=null;hideProps();setBattery(false);robot.setScreenFace(null);projectorFace.visible=false;nextActAt=time+35;if(fiveTarget)fiveTarget.hidden=true;if(playDot)playDot.hidden=true;territoryDirty=true;
}
function startAct(kind,force=false){
 if(orderPanel&&kind!=='order')return false;
 if(!actDurations[kind])return false;
 if(physical()&&!force){pendingScene=kind;return false}
 cancelAct();act={kind,t:0,duration:actDurations[kind],side:x<stageBox.width/2?1:-1};
 if(kind==='follow'){playPoint={x:x,y:ground-actorWidth*.45,until:0};}
 if(kind==='tap')act.variant=tapVariant++%3;
 state='scene';stateTime=0;manualTurn=false;
 return true;
}
function scenePose(a){
 const t=a.t,s=a.side,d=a.duration,e=cue(t,0,.45)*(Number.isFinite(d)?1-cue(t,d-.65,d):1);
 const result={bodyY:0,headY:0,bodyPitch:0,bodyRoll:0,headPitch:0,headRoll:0,sit:0,floorSit:0,eyeL:1,eyeR:1,joy:0,yaw:0,headYaw:0,gaze:[0,0],hands:[null,null],env:e};
 const hand=(index,p,weight=e)=>{result.hands[index]={point:v(...p),weight}};
 const near=s>0?1:0;
 if(isAnimalScene(a.kind)){
  if(reducedMotion.matches)return result;
  const q=cue(t,.65,1.1)*(1-cue(t,d-.9,d-.4));
  const paws=!(partsAvailable&&!compact.matches);
  if(a.kind==='cat'){
   const curl=cue(t,1,1.8)*(1-cue(t,4.5,5.4));
   result.headRoll=(.12*Math.sin((t-.7)*1.5)-.045)*q;result.headPitch=.025*curl;
   result.bodyY=-4*curl;result.headY=-6*curl;
   if(paws)hand(near,[s*218,285+9*Math.sin(t*2.4),85],.8*curl);
  }else if(a.kind==='rabbit'){
   const listen=cue(t,.8,1.5)*(1-cue(t,3.8,4.7)),bob=6*Math.sin(t*5.2)*cue(t,2.6,3)*(1-cue(t,4.1,4.5));
   result.headPitch=-.065*listen;result.headYaw=.08*Math.sin(t*2)*q;
   result.headRoll=.045*Math.sin(t*2.5)*q;result.bodyY=bob;result.headY=bob+5*listen;
   if(paws)for(let i=0;i<2;i++)hand(i,[(i?1:-1)*211,276,84],.75*q);
  }
 }else if(a.kind==='order'&&orderPanel){
  const o=orderPanel,side=o.side,near=side>0?1:0;
  if(o.phase==='approach'){
   result.yaw=o.travel?.direction||Math.sign(o.targetX-x)||side;result.headYaw=result.yaw*.94;result.gaze=[result.yaw*4,0];
   return result;
  }
  const moving=o.phase!=='open',opening=o.phase==='opening';
  const grip=moving?cue(o.t,.12,.58)*(opening?1-cue(o.t,3.2,3.72):1-cue(o.t,ORDER_RELEASE_FROM,ORDER_RELEASE_TO)):0;
  const waiting=o.load==='loading'&&!moving&&!reducedMotion.matches;
  const point=!moving&&o.load==='loaded'&&!reducedMotion.matches?cue(time-o.readyAt,0,.24)*(1-cue(time-o.readyAt,1.15,1.6)):0;
  const heave=(from,to)=>cue(o.t,from,from+.26)*(1-cue(o.t,to-.04,to+.2));
  const effort=moving?Math.max(heave(.40,1.45),heave(1.5,2.35),opening?heave(2.4,3.18):0)*grip:0;
  o.effort=effort;o.grip=grip;o.forceSide=side*(opening?1:-1);
  result.yaw=side*(.91*grip+.08*(1-grip));result.headYaw=side*(.88*grip+.16*(1-grip));
  result.bodyY=-16*effort;result.headY=-16*effort;result.headRoll=o.forceSide*.045*effort;result.headPitch=.07*effort-.035*(1-grip);
  result.eyeL=result.eyeR=1-.24*effort;
  result.gaze=[side*(moving?3:4),moving?-1:3];
  // Both rigid paddles hold the drawer's two grips. Their real tips anchor the handle.
  for(let i=0;i<2;i++)hand(i,[side*116,302+(i?18:-18),(i?1:-1)*-side*126],grip);
  if(waiting)hand(near,[side*280,275+Math.sin(time*10)*5,52],.55);
  if(point>.001)hand(near,[side*248,358,45],point);
  if(reducedMotion.matches){result.yaw=0;result.headYaw=side*.12;result.headRoll=0;result.bodyY=result.headY=0;result.hands=[null,null];}
 }else if(a.kind==='stretch'){
  const leftBend=cue(t,2.5,3.1)*(1-cue(t,4,4.6));
  const rightBend=cue(t,4.7,5.3)*(1-cue(t,6.2,6.8));
  const lean=(leftBend-rightBend)*.105;
  const warm=cue(t,.5,1)*(1-cue(t,2,2.5));
  const squatTime=clamp((t-7)/2.7,0,1),squats=Math.sin(squatTime*Math.PI*2)**2;
  const balance=cue(t,6.8,7.1)*(1-cue(t,9.4,9.9));
  result.bodyRoll=lean;result.headRoll=-lean*.22;
  result.bodyY=-24*squats;result.headY=-28*squats;
  result.headPitch=.055*squats;result.gaze=[-lean*17,-squats];
  result.eyeL=result.eyeR=1-.14*Math.max(leftBend,rightBend,squats);
  for(let i=0;i<2;i++){
   const side=i?1:-1,reach=i?leftBend:rightBend;
   const angle=side*(warm*.72+reach*1.67+balance*.94);
   // Outward arcs, two side stretches, two planted-foot squats, then rest.
   const palm=robot.arms[i].grip.clone().applyAxisAngle(axisZ,angle);
   palm.applyAxisAngle(axisX,warm*.24*Math.sin((t-.5)*Math.PI*2));
   palm.add(robot.arms[i].group.position).applyAxisAngle(axisZ,lean);
   palm.y+=result.bodyY;
   hand(i,palm.toArray());
  }
 }else if(a.kind==='bulb'){
  hand(near,carryHand(s,carryPhase(t,d),[s*254,327,72]).toArray(),cue(t,0,.25)*(1-cue(t,d-.18,d)));result.yaw=s*.07*e;
  result.headYaw=s*.24*e*(1-cue(t,2.65,3.1));result.gaze=[s*4*(1-cue(t,2.65,3.1)),-2];result.headRoll=s*.06*Math.sin(t)*e;
  hand(1-near,[-s*245,354,60],cue(t,3.1,3.35)*(1-cue(t,3.8,4.1)));
 }else if(a.kind==='charge'){
  const sit=cue(t,1.5,2.25)*(1-cue(t,6.1,6.9));result.sit=sit;
  result.bodyY=-8*sit;result.headY=-13*sit;result.bodyPitch=-.025*sit;result.headPitch=.025*sit;
  result.headRoll=Math.sin(t*.9)*.035*sit;result.gaze=[s*2*(1-sit),-2*sit];
  const stretch=cue(t,6.55,6.85)*(1-cue(t,6.9,7.1));
  if(stretch>.01)hand(1-near,[-s*251,367,35],stretch);
  const reach=cue(t,.15,.55)*(1-cue(t,1.4,1.8)),unplug=cue(t,7.05,7.55)*(1-cue(t,8.6,8.95));
  const inserted=cue(t,.65,1.15)*(1-cue(t,7.75,8.15));
  // Both endpoints fit the rigid arm's reach. The plug follows the real palm;
  // the wrist stays in front of the socket while inserting and removing it.
  const palm=v(s*175,185,65).lerp(v(s*(210+15*inserted),245-14*inserted,105-19*inserted),Math.max(reach,unplug));
  palm.lerp(v(s*251,367,35),stretch*(1-unplug));
  // Rest on the torso side of the stand, rather than retracting through its face.
  hand(near,palm.toArray(),cue(t,0,.25)*(1-cue(t,8.8,9)));
 }else if(a.kind==='rest'){
  const sit=cue(t,.35,1.55)*(1-cue(t,6.35,7.85));result.sit=result.floorSit=sit;result.bodyY=-42*sit;result.headY=-48*sit;
  result.bodyPitch=-.01*sit;result.headPitch=.035*sit;result.headRoll=Math.sin(t*.8)*.045*sit;
  result.headYaw=(time<pointer.until?pointer.x*.14:Math.sin(t*.7)*.08)*sit;
  result.eyeL=result.eyeR=1-.28*sit;result.gaze=[time<pointer.until?pointer.x*5:Math.sin(t)*2,0];
  for(let i=0;i<2;i++)hand(i,[(i?1:-1)*145,169,100],sit);
 }else if(a.kind==='recover'){
  result.headRoll=.065*Math.sin(t*9)*Math.exp(-t*1.5);result.gaze=t<.8?[0,4]:[0,0];
  const dust=cue(t,.7,1)*(1-cue(t,1.95,2.2)),wave=cue(t,2.25,2.5)*(1-cue(t,3,3.4));
  for(let i=0;i<2;i++)hand(i,[(i?1:-1)*(116+Math.sin(t*12+i*Math.PI)*18),244,110],dust);
  if(wave>.01)hand(1,[255,358+Math.sin(t*18)*8,45],wave);
 }else if(a.kind==='inspect'){
  const q=carryPhase(t,d);
  hand(1,carryHand(1,q,[183+Math.sin(t*5)*17,363,110]).toArray(),cue(t,0,.25)*(1-cue(t,d-.18,d)));result.headY=-45*cue(q,.65,1);
  result.headRoll=Math.sin(t*3)*.06*q;result.gaze=[Math.sin(t*5)*4,-2];
 }else if(a.kind==='found'){
  hand(1,[243,364+Math.sin(t*8)*5,65],cue(t,.05,.35)*(1-cue(t,1.9,2.5)));
  result.headPitch=-Math.sin(t*6)*.06*Math.exp(-t*.6);result.headRoll=-.055*e;result.gaze=[2,3];result.joy=.7*e;
 }else if(a.kind==='empty'){
  result.headRoll=.10*Math.sin(cue(t,0,.7)*Math.PI/2)*e;result.gaze=[-2,2];
  hand(0,[-260,320,65],cue(t,.7,1.1)*(1-cue(t,2.6,3.2)));
 }else if(a.kind==='typing'){
  result.headYaw=clamp(interactionLook,-1,1)*.14*e;result.gaze=[clamp(interactionLook,-1,1)*4,4];result.headPitch=-.08*e;
 }else if(a.kind==='contact'){
  const q=carryPhase(t,d),reach=cue(t,0,.25)*(1-cue(t,d-.18,d));
  hand(1,carryHand(1,q,[252,276,80]).toArray(),reach);hand(0,[75,270,110],cue(t,2.2,2.6)*(1-cue(t,4,4.4)));result.headYaw=.16*q;result.gaze=[3,-2];
 }else if(a.kind==='read'){
  result.headPitch=.08*e;result.gaze=[Math.sin(t*1.8)*3,-2];result.headRoll=-.04*e;hand(1,[107,327,118]);
 }else if(a.kind==='tap'){
  const q=cue(t,.05,.22)*(1-cue(t,.8,1.3)),wave=Math.sin(cue(t,0,1.4)*Math.PI);
  result.headRoll=(a.variant===1?-.09:.075)*wave;result.headPitch=(a.variant===2?.065:-.035)*wave;
  if(a.variant!==2)result[a.variant===0?'eyeR':'eyeL']=1-.98*q;else result.joy=.85*q;
  result.gaze=[a.variant===1?-1:1,2];
 }else if(a.kind==='pet'){
  const q=cue(t,0,.35)*(1-cue(t,d-.35,d));result.joy=q;
  result.headRoll=(petLean*.10+.02*Math.sin(t*3))*q;result.headY=-8*q;result.bodyY=-3*q;result.headPitch=-.035*q;
  result.eyeL=result.eyeR=1-.85*q;result.gaze=[0,1];
  for(let i=0;i<2;i++)hand(i,[(i?1:-1)*235,240,60],q*.4);
 }else if(a.kind==='five'){
  const hit=a.contactAt!==undefined,age=hit?t-a.contactAt:0,reach=cue(t,.05,.75)*(1-cue(t,d-.65,d)),bump=hit?Math.sin(clamp(age/.48,0,1)*Math.PI):0;
  hand(near,[s*(202+35*bump),430+7*Math.sin(t*2)-55*bump,45-30*bump],reach);
  result.headRoll=-s*.12*reach+s*.09*bump;result.headPitch=-.035*reach+.06*bump;result.gaze=[s*3,2];result.bodyY=-16*bump;result.headY=-24*bump;result.joy=hit?cue(age,0,.12)*(1-cue(age,.95,1.4)):0;
 }else if(a.kind==='follow'){
  const alive=time<playPoint.until,dist=alive?playPoint.x-x:0,lane=currentLane(),allowed=alive?clamp(playPoint.x,lane.min,lane.max)-x:0;
  followDistance=Math.abs(allowed)>5?allowed:0;const walking=Math.abs(followDistance)>5;if(walking)dir=Math.sign(followDistance);
  result.yaw=walking?dir:0;result.headYaw=walking?dir*.86:clamp(dist/actorWidth,-1,1)*.2;
  result.gaze=[clamp(dist/actorWidth,-1,1)*4,clamp((ground-actorWidth*.65-playPoint.y)/actorWidth,-1,1)*4];
  if(alive&&!walking&&Math.abs(dist)>actorWidth*.16){const side=Math.sign(dist);hand(side>0?1:0,[side*255,clamp((ground-playPoint.y)/scale,260,365),60],cue(t,0,.5)*.8);result.headRoll=-side*.055;}
 }else if(a.kind==='boot'){
  const q=cue(t,0,.3)*(1-cue(t,1.8,2.3));
  result.headRoll=-.025*q;result.gaze=[0,1];
 }else if(a.kind==='projection'){
  const q=cue(t,0,.18)*(a.releaseAt===undefined?1:1-cue(t-a.releaseAt,0,.24));
  result.bodyY=-7*q;result.headY=9*q;result.bodyPitch=.045*q;
  result.yaw=s*.12*q;result.headYaw=s*.2*q;result.headPitch=-.32*q;result.gaze=[s*2,4];
  for(let i=0;i<2;i++)hand(i,[(i?1:-1)*238,218,32],q*.75);
 }
 return result;
}
function updateAct(dt){
 if(!act&&!awaitingIntroduction&&autoScenes&&!menuOpen&&!hasAttention()&&!partsThought.visible&&!physical()&&!returning&&!currentLane().dock&&insideLane()&&time>nextActAt&&!reducedMotion.matches){
  const kind=partsAvailable?animalFaces[autoAnimalIndex++%animalFaces.length]:autoOrder[autoIndex++%autoOrder.length];startAct(kind);if(act)act.automatic=true;
 }
 if(act){act.t+=dt;if(act.kind==='pet'){if(time<petUntil)act.t=Math.min(act.t,1.2);else act.t=Math.max(act.t,act.duration-.35)}if(act.t>=act.duration){const follow=act.followup;cancelAct();if(follow){startAct(follow);}else restoreMode();nextActAt=time+20+Math.random()*12}}
 actTarget=act?scenePose(act):null;
 const carrying=partsAvailable&&!compact.matches&&(!act||isAnimalScene(act.kind))&&!physical()&&!menuOpen&&!returning&&!orderReturn&&insideLane()&&!currentLane().dock;
 carryBlend+=(Number(carrying)-carryBlend)*(1-Math.exp(-dt*10));
 const target=actTarget||neutralPose;
 for(const key of poseKeys)pose[key]+=(target[key]-pose[key])*(1-Math.exp(-dt*12));
 for(let i=0;i<2;i++){
  const carryAngle=yaw*Math.PI/2;
  const h=actTarget?.hands[i]||(carryBlend>.001&&i===1?{point:v(247,300,88).applyAxisAngle(axisY,carryAngle),weight:carryBlend}:null);
  const a=scriptedHands[i];a.mix+=((h?.weight||0)-a.mix)*(1-Math.exp(-dt*18));
  if(h){if(a.mix<.02)a.point.copy(h.point);else a.point.lerp(h.point,1-Math.exp(-dt*24));}
 }

}
const handWorld=[v(0,0,0),v(0,0,0)],bodyInverse=new THREE.Matrix4();
const rigEuler=new THREE.Euler(),orderQuaternion=new THREE.Quaternion();
function setRigRotation(rig,pitch,yaw,roll){
 rig.quaternion.setFromEuler(rigEuler.set(pitch,yaw,roll,'XYZ'));
 if(orderMotion>0){
  orderQuaternion.setFromEuler(rigEuler.set(pitch,yaw,roll,'ZYX'));
  rig.quaternion.slerp(orderQuaternion,orderMotion);
 }
}
function updateProps(){
 hideProps();
 setBattery(act?.kind==='charge'&&act.t>=1.65&&act.t<6.55);
 if(orderPanel)return;
 partsPole.visible=carryBlend>.05&&partsAvailable&&(!act||isAnimalScene(act.kind))&&!physical()&&!menuOpen&&!compact.matches;
 if(partsPole.visible){
  const grip=handWorld[1].clone(),tip=v(225,738,88).applyAxisAngle(axisY,yaw*Math.PI/2);
  setRod(partsPoleShaft,grip.clone().addScaledVector(tip.clone().sub(grip).normalize(),-35),tip);
 }
 if(!act)return;
 const t=act.t,s=act.side,near=s>0?1:0,d=act.duration,e=cue(t,0,.3)*(Number.isFinite(d)?1-cue(t,d-.4,d):1);

 if(act.kind==='bulb'){
  bulbProp.visible=t>.55&&t<d-.55;gripProp(bulbProp,handWorld[near],[0,-8,-10],[0,0,s*.12*Math.sin(t*1.1)]);
  const lit=cue(t,2,2.2)*(1-cue(t,5.35,5.65));propMat.bulb.emissiveIntensity=lit*1.7;bulbGlow.material.opacity=lit*.95;bulbLight.position.copy(bulbProp.position).add(v(0,77,60));bulbLight.intensity=lit*110;
  cableProp.visible=bulbProp.visible;const end=bulbProp.position.clone().add(v(0,-15,-8)),back=v(0,178,-80),unravel=cue(carryPhase(t,d),.2,.8);
  drawCable([back,back.clone().lerp(v(s*170,76,-30),unravel),back.clone().lerp(v(s*315,118,45),unravel),end],time);
 }else if(act.kind==='charge'){
  socketProp.visible=true;socketProp.position.set(s*251,100,-36);socketProp.scale.setScalar(e);
  chargingPlug.visible=true;
  const connected=cue(t,1.15,1.35)*(1-cue(t,7.65,7.85));
  chargingPlug.scale.setScalar(e);
  chargingPlug.position.copy(handWorld[near]).sub(v(-s*26,0,46).multiplyScalar(e).applyQuaternion(chargingPlug.quaternion));
  chargingPlug.position.lerp(v(s*251,231,40),connected);
  cableProp.visible=true;
  drawCable([v(0,178+pose.bodyY,-80),v(s*122,64,-30),v(s*225,32,35),v(-s*19,-8,0).multiplyScalar(e).applyQuaternion(chargingPlug.quaternion).add(chargingPlug.position)],time);
  bench.visible=pose.sit>.08;bench.scale.setScalar(pose.sit);
  const charging=cue(t,1.45,1.65)*(1-cue(t,6.5,6.8));chargeLamp.emissiveIntensity=charging*(.6+.6*Math.sin(t*3.2));statusLight.material.color.set(TIM_ACCENT).lerp(statusGlow,charging*(.08+.16*(.5+.5*Math.sin(t*3.2))));
  chargeBars.forEach((bar,i)=>bar.visible=t>1.7+i*1.3);
  const screenOn=t>=1.65&&t<6.55;setBattery(screenOn);if(screenOn)drawBattery(clamp((t-1.8)/4.25,0,1),t);
 }else if(act.kind==='five'&&act.contactAt!==undefined){
  const age=t-act.contactAt,pulse=Math.sin(clamp(age/.45,0,1)*Math.PI);
  sparkProp.visible=pulse>.02;sparkProp.children.forEach((star,i)=>{star.position.copy(handWorld[near]).add(v(s*(23+i*22)*pulse,(i-1)*46*pulse,45));star.scale.setScalar(pulse*.45);star.rotation.z=age*2+i;});
 }else if(act.kind==='inspect'){
  magnifier.visible=t>.55&&t<d-.55;gripProp(magnifier,handWorld[1],[0,0,-10],[0,0,Math.sin(t*5)*.13]);
 }else if(act.kind==='contact'){
  mapProp.visible=t>.55&&t<d-.55;gripProp(mapProp,handWorld[1],[28,-17,-10],[0,-.12,-.04]);
 }
}

function announce(s){if(s!==oldStatus){host.dataset.activity=s;oldStatus=s}}
function currentLane(){return territory.walk;}
function insideLane(){const lane=currentLane();return x>=lane.min-1&&x<=lane.max+1;}
function refreshTerritory(){
 if(act?.kind==='projection'||orderPanel){territoryDirty=true;return;}
 territory=measureTimTerritory(stage,actorWidth,compact.matches,partsAvailable);left=territory.left;right=territory.right;
 const safeBottom=Math.max(0,parseFloat(getComputedStyle(stage).paddingBottom)||0);
 ground=stage.getBoundingClientRect().height-Math.max(safeBottom,territory.reserved);ceiling=Math.max(0,ground-actorWidth-12);
 territoryDirty=false;lastTerritoryAt=performance.now();
}
const markTerritoryDirty=()=>{territoryDirty=true;wake();};
listen(window,'scroll',markTerritoryDirty,{passive:true});
listen(document,'load',markTerritoryDirty,{capture:true,passive:true});
const contentObserver=new ResizeObserver(markTerritoryDirty);
for(const element of document.querySelectorAll('.site-page-content,.site-footer-info,.site-footer'))contentObserver.observe(element);
 if(partsButton)contentObserver.observe(partsButton);
function resize(){
 hitGeneration++;
 wake();
 const box=stage.getBoundingClientRect(),initial=x===null;stageBox={left:box.left,top:box.top,width:box.width,height:box.height};resizeJetEffects(box.width,box.height);
 actorWidth=sizePx;scale=sizePx/TIM_HEIGHT;const canvasHeight=840*scale;
 host.style.width=canvasHeight+'px';host.style.height=canvasHeight+'px';
 const renderWidth=Math.floor(canvasHeight*2*renderer.getPixelRatio()),renderHeight=Math.floor(canvasHeight*renderer.getPixelRatio());
 if(renderer.domElement.width!==renderWidth||renderer.domElement.height!==renderHeight)renderer.setSize(canvasHeight*2,canvasHeight);
 renderer.domElement.style.width=(canvasHeight*2)+'px';renderer.domElement.style.height=canvasHeight+'px';renderer.domElement.style.marginLeft=(-canvasHeight/2)+'px';
 if(orderPanel){
  orderPanel.geometryDirty=true;
  territory=measureTimTerritory(stage,actorWidth,compact.matches,partsAvailable);left=territory.left;right=territory.right;
  orderPanel.floorInset=Math.max(territory.reserved,parseFloat(getComputedStyle(stage).paddingBottom)||0);
  orderPanel.floor=box.height-orderPanel.floorInset;
  if(orderPanel.phase==='closing')measureOrderExit(orderPanel);
 }else refreshTerritory();
 if(initial){x=territory.home;dir=-1;}
 x=clamp(x,orderPanel?Math.min(left,actorWidth*.36):left,orderPanel?Math.max(right,box.width-actorWidth*.36):right);elevation=clamp(elevation,0,ceiling);
 if(gesture){gesture.originX=x;gesture.originElevation=elevation;gesture.startX=gesture.lastX;gesture.startY=gesture.lastY}
}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();
function finishOrderReturn(){
 if(!orderReturn)return;
 x=orderReturn.drawX;
 const visibleGround=orderReturn.drawGround;
 elevation=Math.max(0,elevation+ground-visibleGround);orderReturn=null;
}
function measureOrderExit(panel){
 const lane=measureTimTerritory(stage,actorWidth,compact.matches,partsAvailable).walk;
 const gutter=parseFloat(document.documentElement.style.getPropertyValue('--tim-order-page-gap'))||0;
 panel.exitMin=lane.min;panel.exitMax=Math.max(lane.min,lane.max-gutter);
}
function openOrderPanel(element,onClosed){
 if(orderPanel?.element===element)return;
 finishOrderReturn();
 if(orderPanel)cancelOrderPanel();
 finishDrag(true);cancelAct();menuOpen=false;attentionHovered=false;attentionUntil=0;
 const landing=physical()||elevation>.5;
 if(landing&&!physical()){state='air';stateTime=0;vx=vy=0;}
 if(!landing){vx=vy=roll=rollVelocity=speed=gaitBlend=0;elevation=0;jetFiring=jetArmed=false;helmetOn=false;}
 const side=x>=stage.clientWidth/2?1:-1;
 orderPanel={element,onClosed,side,phase:reducedMotion.matches?'opening':'approach',t:0,q:0,load:'loading',readyAt:-100,savedSize:sizePx,floor:ground,floorInset:stageBox.height-ground,startX:x,gripX:null,stepDistance:0,effort:0,grip:0,geometryDirty:true,header:element.querySelector('.tim-order__header'),overlay:stage.querySelector('.tim-order__overlay')};
 const mounted=orderPanel;
 mounted.observer=new ResizeObserver(()=>{if(orderPanel===mounted){mounted.geometryDirty=true;wake();}});
 mounted.observer.observe(element);if(mounted.header)mounted.observer.observe(mounted.header);
 element.dataset.side=side>0?'right':'left';
 if(compact.matches&&sizePx>125){sizePx=125;resize();}
 if(!landing){startAct('order',true);act.side=side;host.dataset.motion='idle';}
 roamTarget=null;returning=false;
 syncSuspension();
}
function closeOrderPanel(){
 if(!orderPanel||orderPanel.phase==='closing')return;
 if(orderPanel.phase==='approach'){const done=orderPanel.onClosed;cancelOrderPanel();done();return;}
 orderPanel.startQ=orderPanel.q;orderPanel.startX=x;orderPanel.phase='closing';orderPanel.t=0;
 measureOrderExit(orderPanel);
 // Closing also works while the form is still loading or the opening is unfinished.
 if(reducedMotion.matches){const done=orderPanel.onClosed;cancelOrderPanel();done();}
}
function cancelOrderPanel(){
 if(!orderPanel)return;
 const fromX=x,fromGround=ground;
 const previous=orderPanel,falling=physical();orderPanel=null;sizePx=previous.savedSize;ground=previous.floor;
 previous.observer.disconnect();
 writeStyle(stage,'height','');writeStyle(stage,'top','');
 cancelAct();if(!falling){restoreMode();elevation=0;speed=0;}controlsUntil=performance.now()+3000;
 if(!disposed){resize();queueMicrotask(()=>{if(!disposed)syncSuspension();});}
 if(!disposed&&!falling&&!reducedMotion.matches)orderReturn={x:fromX,ground:fromGround,drawX:fromX,drawGround:fromGround,start:performance.now()};
}
function measureOrderPanel(o){
 if(!o.geometryDirty)return o.geometry;
 const p=o.element;
 o.geometry={w:p.offsetWidth,h:p.offsetHeight,px:p.offsetLeft,py:p.offsetTop,ledge:o.header?.offsetHeight||0};
 o.geometryDirty=false;return o.geometry;
}
function vehicleStop(o,direction){
 const inset=vehicle.frontExtent*scale+8;
 return direction>0?Math.min(o.targetX,stageBox.width-inset):Math.max(o.targetX,inset);
}
function updateOrderPanel(dt){
 const o=orderPanel;if(!o)return;
 // The keyboard can change the visual viewport between ResizeObserver turns.
 // Apply that size before reading the bottom-anchored panel's new geometry.
 const view=compact.matches?window.visualViewport:null;
 const viewHeight=view?view.height+'px':'',viewTop=view?view.offsetTop+'px':'';
 if(stage.style.height!==viewHeight||stage.style.top!==viewTop){
  writeStyle(stage,'height',viewHeight);writeStyle(stage,'top',viewTop);o.geometryDirty=true;
  if(view)o.floor=view.height-o.floorInset;
 }
 const fittedSize=compact.matches?Math.min(o.savedSize,125):o.savedSize;
 if(sizePx!==fittedSize){sizePx=fittedSize;resize();}
 o.t+=dt*(o.phase==='closing'?1.25:1);o.stepDistance=0;
 const previous=o.q;
 if(o.phase==='approach'){
  o.targetX=compact.matches?(o.side>0?stageBox.width-77:77):(o.side>0?stageBox.width-actorWidth*.36:actorWidth*.36);
  if(!physical()){
   if(act?.kind!=='order'){startAct('order',true);act.side=o.side;}
   if(reducedMotion.matches&&o.travel){o.travel=null;vehicleBlend=0;x=o.targetX;}
   if(!o.travelChecked){
    o.travelChecked=true;
    const threshold=Math.max(actorWidth*.6,Math.min(actorWidth*2,stageBox.width*.22));
    if(!reducedMotion.matches&&Math.abs(o.targetX-x)>threshold){
     o.travel={phase:'fold',t:0,direction:Math.sign(o.targetX-x),from:x,goal:o.targetX,fromBlend:vehicleBlend};vehicleDistance=0;
    }
   }
   if(o.travel){
    const car=o.travel;car.t+=dt;vehicleYaw=car.direction;
    if(car.phase==='fold'){
     vehicleBlend=car.fromBlend+(1-car.fromBlend)*cue(car.t,0,.82);
     if(car.t>=.82){car.phase='drive';car.t=0;car.from=x;car.goal=vehicleStop(o,car.direction);car.duration=clamp(Math.abs(car.goal-x)/(actorWidth*7),.3,.95);}
    }else if(car.phase==='drive'){
     const goal=vehicleStop(o,car.direction);
     if(Math.abs(car.goal-goal)>1){car.from=x;car.goal=goal;car.t=0;car.duration=clamp(Math.abs(car.goal-x)/(actorWidth*7),.3,.95);}
     const q=clamp(car.t/car.duration,0,1),eased=q*q*q*(q*(q*6-15)+10),before=x;
     x=car.from+(car.goal-car.from)*eased;vehicleDistance+=Math.abs(x-before)/scale;vehicleBlend=1;
     if(q>=1){car.phase='unfold';car.t=0;car.from=x;}
    }else{
     vehicleBlend=1-cue(car.t,0,.82);
     const from=clamp(car.from,actorWidth*.36,stageBox.width-actorWidth*.36);
     x=from+(o.targetX-from)*cue(car.t,.36,.82);
     if(car.t>=.82){vehicleBlend=0;o.travel=null;}
    }
   }
   if(!o.travel&&vehicleBlend<=0&&Math.abs(o.targetX-x)<2){o.phase='opening';o.t=0;o.startX=x;}
  }
 }
 if(o.phase==='opening'){
  o.q=reducedMotion.matches?1:.36*cue(o.t,.8,1.45)+.35*cue(o.t,1.7,2.35)+.29*cue(o.t,2.6,3.18);
  if(o.t>=3.85||reducedMotion.matches){o.phase='open';o.q=1;o.t=0;if(o.load==='loaded')o.readyAt=time;}
 }else if(o.phase==='closing'){
  o.q=o.startQ*(1-.5*cue(o.t,.75,1.45)-.5*cue(o.t,1.7,2.4));
  if(o.t>=2.95){const done=o.onClosed;cancelOrderPanel();done();return;}
 }
 const geometry=measureOrderPanel(o),travel=compact.matches?Math.max(0,o.floor-geometry.py-geometry.ledge):geometry.w+16;
 o.stepDistance=Math.max(Math.abs(o.q-previous)*travel,o.actualStep||0);
 if(o.phase==='closing'&&o.t>=ORDER_RELEASE_FROM)o.stepDistance=o.actualStep||0;
 writeData(o.element,'motion',o.phase);writeData(stage,'vehicle',o.travel?.phase||(vehicleBlend>0?'unfold':'robot'));
 if(!o.overlay)o.overlay=stage.querySelector('.tim-order__overlay');
 if(o.overlay)writeStyle(o.overlay,'opacity',String(o.phase==='approach'?0:o.q));
}
function positionOrderPanel(){
 const o=orderPanel;if(!o)return;
 const panel=o.element,{w,h,px,py,ledge}=measureOrderPanel(o);
 const near=o.side>0?1:0,palm=handWorld[0].clone().lerp(handWorld[1],.5),approaching=o.phase==='approach';
 if(compact.matches){
  // The full robot stands on the header divider; the form begins below his feet.
  const travel=Math.max(0,o.floor-py-ledge),offset=travel*(1-o.q);
  writeStyle(panel,'transform',`translateY(${offset}px)`);
  writeStyle(panel,'opacity',approaching?'0':o.phase==='opening'?String(cue(o.t,0,.3)):o.phase==='closing'?String(1-cue(o.t,2.4,2.95)):'1');
  if(!approaching)ground=py+ledge+offset;
  const target=px+(o.side>0?w-65:65);
  if(!approaching)x=o.phase==='opening'?o.startX+(target-o.startX)*cue(o.t,0,.55):target;
 }else{
  const travel=o.side>0?stageBox.width-px-6:-(px+w-6),offset=travel*(1-o.q);
  writeStyle(panel,'transform',`translateX(${offset}px)`);
  writeStyle(panel,'opacity',approaching?'0':'1');
  ground=o.floor;
  const edge=px+offset+(o.side>0?-4:w+4),rawRest=edge-o.side*actorWidth*.43;
  const rest=o.phase==='closing'?clamp(rawRest,o.exitMin??left,o.exitMax??right):rawRest;
  if(!approaching){
   const gripTarget=edge-palm.x*scale;
   const target=o.phase==='closing'?clamp(gripTarget,o.exitMin??left,o.exitMax??right):gripTarget;
   if(o.phase==='open')x=rest;
   else{
    const reach=cue(o.t,.08,.55),release=o.phase==='opening'?cue(o.t,3.2,3.82):cue(o.t,ORDER_RELEASE_FROM,ORDER_RELEASE_TO);
    x=(o.startX+(target-o.startX)*reach)*(1-release)+rest*release;
   }
  }
  const gripping=!approaching&&o.phase!=='open'&&o.grip>.15;
  if(gripping){
   const yy=handWorld.map(hand=>ground-elevation-hand.y*scale),top=Math.min(...yy)-8,bottom=Math.max(...yy)+8;
   o.handleY=py+h-bottom;writeStyle(panel,'--tim-order-handle-height',(bottom-top)+'px');
  }else if(o.handleY===undefined)o.handleY=24;
  writeStyle(panel,'--tim-order-handle',o.handleY+'px');
 }
 o.actualStep=o.lastX===undefined?0:Math.abs(x-o.lastX);o.lastX=x;
 writeStyle(panel,'--tim-order-handle-opacity',String(o.phase==='closing'?Math.min(o.grip||0,clamp(o.q*10,0,1)):1));
 writeData(panel,'positioned','true');writeData(panel,'arriving',String(approaching));
}
function restoreMode(){mode='front';state='front';stateTime=0;roamTarget=null;roamRestUntil=Math.max(roamRestUntil,time+4+Math.random()*6);}
function updateRoaming(){
 if(orderPanel||orderReturn||vehicleBlend>0||menuOpen||physical()||hasAttention()||partsThought.visible||awaitingIntroduction)return;
 if(act?.automatic&&!insideLane()){cancelAct();restoreMode();}
 if(act)return;
 const nearest=currentLane();
 const target=clamp(x,nearest.min,nearest.max);
 if(Math.abs(target-x)>1){
  if(reducedMotion.matches){x=target;returning=false;restoreMode();return;}
  returning=true;dir=Math.sign(target-x);roamTarget=target;mode='walk';
  if(state!=='walk'){state='walk';stateTime=0;}return;
 }
 returning=false;
 if(state==='walk'&&roamTarget!==null)roamTarget=clamp(roamTarget,nearest.min,nearest.max);
 if(!roaming||nearest.dock||reducedMotion.matches||time<roamRestUntil||!['front','idle'].includes(state)||nearest.max-nearest.min<12)return;
 // PikaPika stroll: 1.056–1.32 character sizes, alternating directions.
 const span=actorWidth*1.32*(.8+Math.random()*.2);
 dir=nextRoamDirection;
 roamTarget=clamp(x+dir*span,nearest.min,nearest.max);
 if(Math.abs(roamTarget-x)<1){dir*=-1;roamTarget=clamp(x+dir*span,nearest.min,nearest.max);}
 nextRoamDirection=-dir;mode='walk';state='walk';stateTime=0;
}

/* The input surface is the visible, opaque character silhouette, never the canvas box. */
const hitSvg=document.createElementNS('http://www.w3.org/2000/svg','svg'),hitPath=document.createElementNS('http://www.w3.org/2000/svg','path');
hitSvg.classList.add('tim-mascot__hit');hitSvg.setAttribute('viewBox','0 0 192 96');hitSvg.setAttribute('aria-hidden','true');hitPath.setAttribute('fill','transparent');hitPath.classList.add('tim-mascot__shape');hitSvg.append(hitPath);host.append(hitSvg);
const hitTarget=new THREE.WebGLRenderTarget(192,96,{depthBuffer:true}),hitPixels=new Uint8Array(192*96*4);
const hitMaterial=new THREE.MeshBasicMaterial({color:0xffffff}),hitRay=new THREE.Raycaster(),hitMouse=new THREE.Vector2();
const hitRoots=[headRig,bodyRig,...legs.map(l=>l.foot)];
const hitCache=new Map(),hitPointer={x:NaN,y:NaN};
const hitBatch=createTimHitBatch(scene,hitMaterial,[props,helmetGlass]);
let lastHitAt=-10,lastHitPath='',hoverStroke={x:0,t:-10,dir:0,travel:0,turns:0};
let hitRead=null,asyncHit=typeof renderer.readRenderTargetPixelsAsync==='function';
function commitHitSilhouette(key,generation){
 if(disposed||suspended||generation!==hitGeneration)return;
 let path='';
 for(let yy=0;yy<96;yy++){const row=95-yy;
  for(let xx=0;xx<192;){if(hitPixels[(row*192+xx)*4+3]<128){xx++;continue;}const start=xx++;while(xx<192&&hitPixels[(row*192+xx)*4+3]>=128)xx++;path+='M'+start+' '+yy+'H'+xx+'V'+(yy+1)+'H'+start+'Z';}
 }
 if(path!==lastHitPath){hitPath.setAttribute('d',path);lastHitPath=path;}
 if(key!==null){hitCache.set(key,path);if(hitCache.size>128)hitCache.delete(hitCache.keys().next().value);}
}
function updateHitSilhouette(now){
 if(hitRead||orderPanel)return;
 const near=compact.matches||physical()||document.activeElement===host||Math.abs(hitPointer.x-stageBox.left-x)<actorWidth*1.8&&Math.abs(hitPointer.y-stageBox.top-ground+elevation+actorWidth*.5)<actorWidth;
 if(now-lastHitAt<(near?65:200))return;lastHitAt=now;
 const {key}=hitBatch.update(helmetAmount<.5?[spaceHelmet]:[]),cached=hitCache.get(key);
 if(cached!==undefined){if(cached!==lastHitPath){hitPath.setAttribute('d',cached);lastHitPath=cached;}return;}
 const target=renderer.getRenderTarget();
 try{
  renderer.setRenderTarget(hitTarget);renderer.render(hitBatch.scene,camera);
  const generation=hitGeneration;
  // Keep the first input surface immediate. Subsequent reads wait for the GPU
  // through a fence instead of blocking the animation/input thread.
  if(asyncHit&&lastHitPath){
   hitRead=renderer.readRenderTargetPixelsAsync(hitTarget,0,0,192,96,hitPixels)
    .then(()=>commitHitSilhouette(key,generation))
    .catch(()=>{asyncHit=false;lastHitAt=-10;})
    .finally(()=>{hitRead=null;});
   // Three rebinds the PBO when collecting its result. Do not leave it bound
   // while waiting: a failed async read must still allow the sync fallback.
   const gl=renderer.getContext();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
  }else{
   renderer.readRenderTargetPixels(hitTarget,0,0,192,96,hitPixels);
   commitHitSilhouette(key,generation);
  }
 }finally{renderer.setRenderTarget(target);}
}
function robotHit(event){
 const b=renderer.domElement.getBoundingClientRect();
 hitMouse.set((event.clientX-b.left)/b.width*2-1,1-(event.clientY-b.top)/b.height*2);scene.updateMatrixWorld(true);hitRay.setFromCamera(hitMouse,camera);
 const hit=hitRay.intersectObjects(hitRoots,true).find(h=>{for(let n=h.object;n;n=n.parent){if(!n.visible||n.userData.noPick)return false;}return true;});if(!hit)return null;
 let node=hit.object;while(node&&node!==motionRig){if(node===headRig)return 'head';node=node.parent;}return 'body';
}
function shortTouch(){
 controlsUntil=performance.now()+3000;
 if(time-tapLast<2.5)return;tapLast=time;nextActAt=time+12;
 if(act||physical())return;
 startAct('tap');
}
function beginPet(){
 if(physical()||act&&act.kind!=='pet')return;
 if(act?.kind!=='pet')startAct('pet');
 petUntil=time+.18;
}
function attendToPointer(event){
 if(orderPanel||event.pointerType==='touch'||event.buttons||suspended||menuOpen||physical()||!robotHit(event))return;
 acknowledgeIntroduction();
 attentionHovered=true;attentionUntil=performance.now()+1250;controlsUntil=performance.now()+3000;
 // Explicitly requested scenes can finish; autonomous business yields to the visitor.
 if(act?.automatic)cancelAct();
 if(!act){mode='front';state='front';stateTime=0;roamTarget=null;returning=false;roamRestUntil=time+1.25;}
}
function leaveAttention(){
 if(!attentionHovered)return;attentionHovered=false;attentionUntil=performance.now()+1250;roamRestUntil=Math.max(roamRestUntil,time+1.25);
}
listen(hitPath,'pointerenter',attendToPointer);
listen(hitPath,'pointerleave',leaveAttention);
listen(document,'pointermove',e=>{
 hitPointer.x=e.clientX;hitPointer.y=e.clientY;
 const b=stageBox,px=e.clientX-b.left,py=e.clientY-b.top;
 pointer={x:clamp((px-x)/60,-1,1),y:clamp((ground-actorWidth*(TIM_HEAD_Y/TIM_HEIGHT)-elevation-py)/80,-1,1),until:time+2};
 if(e.pointerType!=='touch'&&!e.buttons&&!physical()){
  if(e.target===hitPath)attendToPointer(e);else leaveAttention();
 }
 if(act?.kind==='follow'&&!e.target.closest('[data-tim-controls]')&&!gesture){playPoint={x:clamp(px,left,right),y:py,until:time+2.2};}
 if(suspended||menuOpen||e.pointerType==='touch'||e.buttons||physical()||Math.abs(headYaw)>.65||act&&act.kind!=='pet')return;
 const wx=(px-x)/scale,wy=(ground-elevation-py)/scale;
 if(Math.abs(wx)>190||wy<310||wy>695){hoverStroke.turns=0;hoverStroke.travel=0;return;}
 if(robotHit(e)!=='head')return;
 petLean=clamp(wx/155,-1,1);
 if(act?.kind==='pet'){petUntil=time+.18;return;}
 if(time-hoverStroke.t>1.2){hoverStroke={x:px,t:time,dir:0,travel:0,turns:0};return;}
 const dx=px-hoverStroke.x,direction=Math.sign(dx);
 if(Math.abs(dx)>1.2){if(hoverStroke.dir&&direction!==hoverStroke.dir)hoverStroke.turns++;hoverStroke.dir=direction;hoverStroke.travel+=Math.abs(dx);hoverStroke.x=px;hoverStroke.t=time;}
 if(hoverStroke.turns>=1&&hoverStroke.travel>actorWidth*.65){beginPet();hoverStroke.turns=0;hoverStroke.travel=0;}
});
listen(document,'pointerleave',()=>{if(act?.kind==='follow')playPoint.until=0;});
listen(document,'pointerdown',e=>{
 if(act?.kind!=='follow'||e.target.closest('[data-tim-controls],.tim-mascot__actor,.tim-mascot__five,a,button,input,textarea,select,[contenteditable=true]')||e.button!==0)return;
 const b=stage.getBoundingClientRect();playPoint={x:clamp(e.clientX-b.left,left,right),y:e.clientY-b.top,until:time+5};
});
function startHold(){
 controlsUntil=0;
 attentionHovered=false;attentionUntil=0;
 cancelAct();state='held';stateTime=0;speed=0;gaitBlend=0;manualTurn=false;vx=0;vy=0;dragVX=0;dragVY=0;
 jetFiring=false;jetThrust=0;host.dataset.motion='held';stage.dataset.holding='true';document.documentElement.setAttribute('data-tim-grabbing','');announce(helmetOn?'Космонавт — полёт нормальный':'В руке — можно раскачать и отпустить');
}
listen(host,'pointerdown',e=>{
 if(orderPanel||vehicleBlend>0||suspended||menuOpen||e.button!==0||e.isPrimary===false||gesture)return;
 const zone=robotHit(e);if(!zone)return;
 acknowledgeIntroduction();
 finishOrderReturn();
 e.preventDefault();host.dataset.pointerFocus='true';host.focus({preventScroll:true});
 const airborne=elevation>.5||state==='air';
 gesture={id:e.pointerId,zone,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,originX:x,originElevation:elevation,moved:airborne,lastMotion:performance.now(),samples:[{x:e.clientX,y:e.clientY,t:performance.now()}]};
 try{host.setPointerCapture(e.pointerId)}catch{}
 host.dataset.pressed='true';
 if(airborne)startHold();
});
listen(host,'pointermove',e=>{
 if(e.pointerType!=='touch'&&!gesture)controlsUntil=performance.now()+1800;
 const g=gesture;if(!g||g.id!==e.pointerId)return;
 const now=performance.now(),dx=e.clientX-g.startX,dy=e.clientY-g.startY;
 if(!g.moved&&Math.hypot(dx,dy)<6)return;
 if(!g.moved){g.moved=true;startHold();g.samples=[{x:g.lastX,y:g.lastY,t:now-16}];}
 e.preventDefault();
 const sample=g.samples[g.samples.length-1],elapsed=Math.max(.008,(now-sample.t)/1000);
 dragVX=clamp((e.clientX-sample.x)/elapsed,-1600,1600);dragVY=clamp((e.clientY-sample.y)/elapsed,-1600,1600);
 x=clamp(g.originX+dx,left,right);elevation=clamp(g.originElevation-dy,0,ceiling);
 if(e.clientX!==g.lastX||e.clientY!==g.lastY)g.lastMotion=now;
 g.lastX=e.clientX;g.lastY=e.clientY;g.samples.push({x:e.clientX,y:e.clientY,t:now});
 while(g.samples.length>2&&g.samples[0].t<now-110)g.samples.shift();
});
function finishDrag(cancelled=false){
 const g=gesture;if(!g)return;
 const now=performance.now();gesture=null;host.dataset.pressed='false';stage.dataset.holding='false';document.documentElement.removeAttribute('data-tim-grabbing');
 try{if(host.hasPointerCapture(g.id))host.releasePointerCapture(g.id)}catch{}
 if(!g.moved){if(!cancelled)shortTouch();return;}
 if(elevation<0){vx=vy=0;jetFiring=jetArmed=false;host.dataset.motion='idle';restoreMode();return;}
 let throwX=0,throwY=0;
 if(!cancelled&&!reducedMotion.matches&&now-g.lastMotion<100&&g.samples.length>1){
  const first=g.samples[0],tail=g.samples[g.samples.length-1],seconds=Math.max(.016,(tail.t-first.t)/1000);
  const rawX=(tail.x-first.x)/seconds,rawY=(first.y-tail.y)/seconds;
  throwX=clamp(Math.sign(rawX)*Math.max(0,Math.abs(rawX)-180)*.28,-360,360);
  throwY=clamp(Math.sign(rawY)*Math.max(0,Math.abs(rawY)-180)*.33,-480,480);
 }
 landingSeverity=0;forceRecovery=false;jetArmed=helmetOn;jetFiring=false;jetThrust=0;vx=throwX;vy=throwY;bounces=0;state='air';stateTime=0;host.dataset.motion='air';
 if(elevation<.5&&vy<=0){elevation=0;impact=Math.min(1,Math.abs(vy)/750);impactAge=0;state='land';vx=0;vy=0;}
 if(Math.abs(vx)>20)dir=Math.sign(vx);
}
listen(host,'pointerup',e=>{if(gesture?.id===e.pointerId){e.preventDefault();finishDrag();}});
listen(host,'pointercancel',e=>{if(gesture?.id===e.pointerId)finishDrag(true);});
listen(host,'lostpointercapture',e=>{if(gesture?.id===e.pointerId)finishDrag(true);});
listen(host,'dragstart',e=>e.preventDefault());
listen(host,'focus',()=>{
 if(host.dataset.pointerFocus==='true')return;
 acknowledgeIntroduction();controlsUntil=performance.now()+3500;
});
listen(host,'keydown',e=>{
 if(orderPanel)return;
 host.dataset.pointerFocus='false';
 if(e.key==='Escape'){if(gesture)finishDrag(true);else{cancelAct();restoreMode();}e.preventDefault();}
 if((e.key===' '||e.key==='Enter')&&!e.repeat&&!physical()){e.preventDefault();shortTouch();}
});
if(fiveTarget){listen(fiveTarget,'pointerdown',e=>{e.stopPropagation();});
listen(fiveTarget,'click',e=>{
 e.stopPropagation();if(act?.kind!=='five'||act.contactAt!==undefined)return;
 act.contactAt=act.t;act.duration=act.t+1.7;fiveTarget.hidden=true;announce('Пять!');
});}
listen(window,'blur',()=>finishDrag(true));


listen(window,'site:route-ready',refreshTerritory);
listen(window,'site:projection-start',event=>{
 if(orderPanel||disposed||suspended||physical()||menuOpen||reducedMotion.matches)return;
 startAct('projection');const sceneAct=act,projection=event.detail;act.projection=projection;
 projection.origin=()=>{
  if(disposed||suspended||act!==sceneAct)return null;
 const point=headRig.localToWorld(v(0,-6,roundSurface(0,-6)+4)),box=stageBox;
  return{x:box.left+x+point.x*scale,y:box.top+ground-elevation-point.y*scale,size:actorWidth};
 };
 projection.finish=()=>{
  if(act!==sceneAct)return;
  if(!reducedMotion.matches&&!suspended&&!disposed)startAct('boot');
  else{cancelAct();restoreMode();}
 };
 event.preventDefault();
});
function syncSuspension(){
 const field=document.activeElement?.matches('input,textarea,select,[contenteditable=true]')&&!document.activeElement.closest('[data-tim-controls]');
 const blocked=Boolean(document.hidden||!orderPanel&&(document.body.hasAttribute('data-scroll-locked')||compact.matches&&field));
 hitGeneration++;suspended=blocked;writeData(stage,'suspended',String(blocked));territoryDirty=true;
 partsThought.suspend(blocked);
 cancelAnimationFrame(frameId);clearTimeout(frameTimer);frameId=frameTimer=0;
 if(blocked){attentionHovered=false;attentionUntil=0;finishDrag(true);releaseJetSurface();onMenu(false);}
 else if(!disposed){last=frameClock=performance.now();queueFrame();if(helmetDeferredTask){const task=helmetDeferredTask;helmetDeferredTask=null;queueHelmetWarmup(task);}}
}
const lockObserver=new MutationObserver(syncSuspension);lockObserver.observe(document.body,{attributes:true,attributeFilter:['data-scroll-locked']});
listen(document,'visibilitychange',syncSuspension);
listen(document,'focusin',syncSuspension);
listen(document,'focusout',()=>queueMicrotask(()=>{if(!disposed)syncSuspension()}));
listen(compact,'change',()=>{resize();syncSuspension()});
listen(reducedMotion,'change',()=>{if(reducedMotion.matches){invitationBlend=invitationScreenBlend=0;walkArmAngles.fill(0);}if(!orderPanel){cancelAct();restoreMode();}});
function frame(now){
 frameId=0;
 if(disposed||suspended)return;
 const stillOrder=orderPanel?.phase==='open';
 if(reducedMotion.matches&&(!act||stillOrder)&&!physical()&&(!orderPanel||stillOrder)&&now>Math.max(staticFrameUntil,controlsUntil+80,attentionUntil+1600))return;
 const scripted=act&&(act.kind!=='order'||orderPanel?.phase!=='open');
 const orderPointing=orderPanel?.phase==='open'&&orderPanel.load==='loaded'&&time-orderPanel.readyAt<1.6;
 const blinking=!reducedMotion.matches&&(time>nextBlink-.12||time-blinkStart<.38);
 const active=Boolean(now<staticFrameUntil||blinking||scripted||orderPointing||orderReturn||vehicleBlend>0||helmetAmount>.001&&helmetAmount<.999||physical()||state==='walk'||state==='prepare'||state==='turn'||state==='greet'||speed>.01||gaitBlend>.01||hasAttention()||awaitingIntroduction&&!reducedMotion.matches&&time>.4&&(time-.4)%4.8<3.45);
 const interval=1000/(active?30:12),elapsed=now-frameClock;
 if(elapsed<interval-.5){queueFrame(active?0:Math.max(0,interval-elapsed-4));return;}
 frameClock=now-Math.max(0,elapsed-interval)%interval;
 inFrame=true;
 try{
 if(orderReturn&&now-orderReturn.start>=420)orderReturn=null;
 const dt=Math.min(active ? .08 : .12,(now-last)/1000);last=now;time+=reducedMotion.matches&&(!act||orderPanel||isAnimalScene(act.kind))&&!physical()?0:dt;stateTime+=dt;impactAge+=dt;updateOrderPanel(dt);updateAct(dt);
 if(!orderPanel?.travel&&vehicleBlend>0){vehicleBlend=reducedMotion.matches?0:Math.max(0,vehicleBlend-dt/.82);if(!orderPanel)writeData(stage,'vehicle',vehicleBlend>0?'unfold':'robot');}
 if(territoryDirty&&now-lastTerritoryAt>120)refreshTerritory();
 updateRoaming();
 if(!physical()){
  // The bottom of the viewport supports the full body, regardless of content width.
  elevation=reducedMotion.matches?0:elevation*Math.exp(-dt*7);
  writeData(stage,'docked',String(currentLane().dock&&insideLane()));
 }else writeData(stage,'docked','false');
 let targetSpeed=0,turnProgress=0;
 const attending=hasAttention()&&vehicleBlend<=0;writeData(stage,'attention',String(attending));
 writeData(stage,'orderOffer',String(!orderPanel&&vehicleBlend<=0&&!physical()&&(attentionHovered||now<attentionUntil||orderTriggerAttention)));
 if(attending){
  yaw+=(0-yaw)*(1-Math.exp(-dt*7));headYaw+=(pointer.x*.22-headYaw)*(1-Math.exp(-dt*9));announce('Смотрит на тебя');
 }else if(state==='scene'&&act){
  if(orderPanel&&!reducedMotion.matches){
   if(orderPanel.phase==='approach')targetSpeed=orderPanel.travel||vehicleBlend>0?0:clamp(Math.abs(orderPanel.targetX-x)/35,.3,1);
   else if(orderPanel.phase!=='open')targetSpeed=clamp(orderPanel.stepDistance/Math.max(dt,.001)/130,0,1);
  }
  if(act.kind==='follow')targetSpeed=Math.abs(followDistance)>5?clamp(Math.abs(followDistance)/(90*scale),.12,1):0;
  yaw+=(actTarget.yaw-yaw)*(1-Math.exp(-dt*6));headYaw+=(actTarget.headYaw-headYaw)*(1-Math.exp(-dt*7));announce(orderPanel?.travel?({fold:'Складывается в машинку',drive:'Едет к окну заказа',unfold:'Раскладывается обратно'})[orderPanel.travel.phase]:act.kind==='five'&&act.contactAt!==undefined?'Пять!':actLabels[act.kind]);
 }else if(state==='held'){
  yaw+=(clamp(dragVX/2400,-.34,.34)-yaw)*(1-Math.exp(-dt*6));
  headYaw+=(clamp(dragVX/2800,-.25,.25)-headYaw)*(1-Math.exp(-dt*7));
  dragVX*=Math.exp(-dt*5);dragVY*=Math.exp(-dt*5);announce(helmetOn?'Космонавт — полёт нормальный':'В руке — можно раскачать и отпустить');
 }else if(state==='air'){
  const gravity=compact.matches?1600:1850;
  if(jetArmed&&!jetFiring&&vy<-140&&(stateTime>.18||elevation<150))jetFiring=true;
  if(jetFiring){
   const descentSpeed=clamp(ceiling*.62,250,480);
   const targetVy=-clamp(Math.sqrt(2*420*Math.max(elevation-1,0)),28,descentSpeed);
   const rate=Math.max(8.5,Math.max(0,-vy-descentSpeed)/Math.max(elevation-10,10)*1.8),before=vy;
   vy+=(targetVy-vy)*(1-Math.exp(-dt*Math.min(rate,48)));
   jetThrust=clamp(.58+Math.max(0,(vy-before)/Math.max(dt,.001))/1800,.58,1);
  }else{vy-=gravity*dt;jetThrust=0}
  elevation+=vy*dt;x+=vx*dt;vx*=Math.exp(-dt*(jetFiring?5.5:2.8));
  if(x<left){x=left;vx=Math.abs(vx)*.2;rollVelocity-=.65}
  if(x>right){x=right;vx=-Math.abs(vx)*.2;rollVelocity+=.65}
  if(elevation>ceiling){elevation=ceiling;vy=-Math.abs(vy)*.25}
  if(elevation<=0){
   elevation=0;const hit=Math.max(0,-vy);impactAge=0;
   if(jetFiring){jetLandedAt=time;jetFiring=false;jetArmed=false;jetThrust=0;impact=.16;landingSeverity=0;forceRecovery=false;state='land';stateTime=0;vx=0;vy=0;host.dataset.motion='land'}
   else{
    landingSeverity=Math.max(landingSeverity,clamp(hit/800,0,1));impact=clamp(hit/850,.15,1);
    if(hit>400&&bounces===0&&!reducedMotion.matches){vy=hit*.16;vx*=.62;bounces++;elevation=.1}
    else{state='land';stateTime=0;vx=0;vy=0;host.dataset.motion='land'}
   }
  }
  const flightYaw=jetFiring?0:clamp(vx/1500,-.55,.55);yaw+=(flightYaw-yaw)*(1-Math.exp(-dt*6));headYaw+=(flightYaw*.8-headYaw)*(1-Math.exp(-dt*7));
  announce(jetFiring?'Тормозит двигателями — мягкая посадка':vy>50?'Летит — его можно поймать':'Готовится приземлиться');
 }else if(state==='land'){
  const target=mode==='front'?0:dir;yaw+=(target-yaw)*(1-Math.exp(-dt*3));headYaw+=(target-headYaw)*(1-Math.exp(-dt*4));
  announce(stateTime<.35?'Мягко приземлился':'Выпрямляется');
  if(stateTime>.7){host.dataset.motion='idle';if(pendingScene){const kind=pendingScene;pendingScene=null;startAct(kind,true)}else if(forceRecovery||landingSeverity>.55){forceRecovery=false;landingSeverity=0;startAct('recover',true)}else restoreMode()}
 }else if(state==='greet'){
  yaw+=(0-yaw)*(1-Math.exp(-dt*6));headYaw+=(0-headYaw)*(1-Math.exp(-dt*7));
  announce('Привет!');
  if(stateTime>1)restoreMode();
 }else if(state==='press'){announce('Подними его мышью или пальцем')}
 else if(state==='walk'&&mode==='walk'){
  const remaining=dir*((roamTarget??(dir>0?right:left))-x);targetSpeed=clamp(remaining/(62*scale),.22,1);
  if(remaining<2.2*scale){state='rest';stateTime=0;targetSpeed=0;roamRestUntil=time+8+Math.random()*10;roamTarget=null;}
  yaw+=(dir-yaw)*(1-Math.exp(-dt*5));headYaw+=(dir-headYaw)*(1-Math.exp(-dt*6));announce(dir>0?'Идёт направо':'Идёт налево');
 }else if(state==='rest'){announce('Останавливается');if(stateTime>.85)restoreMode()}
 else if(state==='prepare'){yaw+=(dir-yaw)*(1-Math.exp(-dt*5));headYaw+=(dir-headYaw)*(1-Math.exp(-dt*6));announce('Готовится повернуться');if(stateTime>1.2){yaw=dir;headYaw=dir;state='turn';stateTime=0}}
 else if(state==='turn'){
  turnProgress=clamp(stateTime/1.65,0,1);yaw=dir*(1-2*smooth(clamp((turnProgress-.10)/.84,0,1)));headYaw=dir*(1-2*smooth(clamp((turnProgress-.015)/.67,0,1)));
  announce('Разворачивается');
  if(turnProgress>=1){dir*=-1;state=manualTurn?'idle':'walk';stateTime=0;manualTurn=false;void 0}
 }else{const target=mode==='front'?0:dir;yaw+=(target-yaw)*(1-Math.exp(-dt*3));headYaw+=(target-headYaw)*(1-Math.exp(-dt*3.5));announce(mode==='front'?'Анфас — живая стойка':'Строгий профиль')}
 if(gesture&&!gesture.moved)targetSpeed=0;
 const walkingPace=orderPanel?.phase==='approach'?8:returning?2.8:2.2;
 speed+=(targetSpeed-speed)*(1-Math.exp(-dt*(attending?18:orderPanel||orderReturn?16:4.5)));if(!attending&&(state==='walk'||act?.kind==='follow')&&!(gesture&&!gesture.moved)){
  const moved=x+dir*110*scale*speed*dt*walkingPace;
  x=clamp(roamTarget!==null&&state==='walk'?(dir>0?Math.min(moved,roamTarget):Math.max(moved,roamTarget)):moved,left,right);
 }
 let orderStep=orderPanel?.stepDistance||0;
 if(orderPanel?.phase==='approach'&&!orderPanel.travel&&vehicleBlend<=0&&!physical()){
  const distance=orderPanel.targetX-x,step=Math.min(Math.abs(distance),Math.max(175,actorWidth*1.85)*speed*dt);
  x+=Math.sign(distance)*step;orderStep=step;
 }
 const orderTarget=orderPanel?(orderPanel.phase==='closing'?1-cue(orderPanel.t,ORDER_RELEASE_FROM,ORDER_RELEASE_TO):1):0;
 orderMotion+=(orderTarget-orderMotion)*(1-Math.exp(-dt*14));
 orderGrip+=((orderPanel?.grip||0)-orderGrip)*(1-Math.exp(-dt*18));
 const leanTarget=orderPanel&&!reducedMotion.matches?(orderPanel.forceSide*.36*orderPanel.effort||0):0;
 orderLean+=(leanTarget-orderLean)*(1-Math.exp(-dt*14));
 if(orderMotion<.0001)orderMotion=0;
 const strideTarget=40+((orderPanel?.phase==='approach'?78:130)-40)*orderMotion;
 orderStride+=(strideTarget-orderStride)*(1-Math.exp(-dt*18));
 orderSwing+=((orderPanel?.phase==='approach'?74:23)-orderSwing)*(1-Math.exp(-dt*18));
 gaitBlend+=(speed-gaitBlend)*(1-Math.exp(-dt*(attending?12:orderPanel||orderReturn?18:5)));
 if(vehicleBlend>0){speed=gaitBlend=0;if(!orderPanel?.travel)yaw=headYaw=vehicleYaw;}
 // Longer planted strides keep the ordinary arm cycle from becoming a fast
 // wrist vibration. Order approach/push still uses its measured travel cycle.
 phase=(phase+(orderPanel?orderStep/((orderPanel.phase==='approach'?190:260)*scale):dt*speed/1.62*walkingPace))%1;
 writeData(stage,'walking',String(Boolean(!attending&&(state==='walk'||act?.kind==='follow'&&speed>.05||orderPanel&&speed>.05))));
 writeData(stage,'controlsVisible',String(now<controlsUntil));
 jetPower+=((jetFiring?jetThrust:0)-jetPower)*(1-Math.exp(-dt*(jetFiring?18:14)));
 const jetStabilize=clamp(jetPower*1.8,0,1);
 const isHeld=state==='held',airborne=state==='air',greeting=state==='greet';
 heldBlend+=((isHeld?1:airborne?.88:0)-heldBlend)*(1-Math.exp(-dt*(state==='land'?16:10)));
 const targetRoll=isHeld?-clamp(dragVX/1900,-.38,.38)+Math.sin(time*6)*.018:airborne&&!jetFiring?-clamp(vx/2200,-.31,.31):0;
 rollVelocity+=((targetRoll-roll)*90-rollVelocity*10)*dt;roll=clamp(roll+rollVelocity*dt,-.48,.48);
 const pivot=500*heldBlend;motionRig.rotation.z=roll;motionRig.position.set(Math.sin(roll)*pivot,(1-Math.cos(roll))*pivot,0);
 const breath=Math.sin(time*Math.PI*2/3.8),gait=Math.sin(phase*Math.PI*2),turning=state==='turn';
 const landBend=impact*Math.sin(clamp(impactAge/.35,0,1)*Math.PI)*22;
 const inviteTime=Math.max(0,time-.4)%4.8;
 const inviting=awaitingIntroduction&&vehicleBlend<=0&&!act&&!physical()&&!orderPanel&&!reducedMotion.matches&&time>.4;
 const invitation=inviting?cue(inviteTime,0,.26)*(1-cue(inviteTime,2.75,3.25)):0;
 invitationBlend+=(invitation-invitationBlend)*(1-Math.exp(-dt*14));
 invitationScreenBlend+=((inviting?cue(inviteTime,0,.18)*(1-cue(inviteTime,2.93,3.2)):0)-invitationScreenBlend)*(1-Math.exp(-dt*18));
 const hello=vehicleBlend>0?0:Math.max(greeting?Math.sin(clamp(stateTime,0,1)*Math.PI):0,invitationBlend);
 const invitePose=!act&&!physical()&&!orderPanel?invitationBlend:0;
 const inviteLean=Math.sin(inviteTime*Math.PI*2/1.1)*.055*invitePose;
 const inviteDip=(.5+.5*Math.sin(inviteTime*Math.PI*2/1.1))*12*invitePose;
 writeData(stage,'introducing',String(awaitingIntroduction));
 const bob=4.4*Math.cos(phase*Math.PI*4)*gaitBlend-breath*1.6-(turning?Math.sin(turnProgress*Math.PI)*1.8:0)-landBend+heldBlend*7-inviteDip;
 const sway=2.2*Math.sin(time*.62)*(1-gaitBlend)+gait*1.8*gaitBlend+(turning?-dir*Math.sin(turnProgress*Math.PI*2)*5:0);
 bodyRig.position.set(sway,bob+pose.bodyY,0);
 const torsoLean=orderLean+pose.bodyRoll+inviteLean;
 const shoulderRoll=.55+1.55*orderMotion;
 setRigRotation(bodyRig,pose.bodyPitch,yaw*Math.PI/2,(-gait*shoulderRoll*gaitBlend-Math.sin(time*.55)*.3)*Math.PI/180+torsoLean);
 headRig.position.set(sway*.45+yaw*3*gaitBlend,TIM_HEAD_Y+bob*.65-Math.sin(time*.6)*.5+pose.headY,0);
 if(torsoLean){headRig.position.x-=Math.sin(torsoLean)*TIM_HEAD_Y;headRig.position.y-=(1-Math.cos(torsoLean))*TIM_HEAD_Y;}
 setRigRotation(headRig,pose.headPitch,headYaw*Math.PI/2,(1.2-yaw*.5+gait*.85*gaitBlend-Math.sin(time*.73)*.55*(1-gaitBlend)+hello*6)*Math.PI/180-roll*.18+pose.headRoll+torsoLean);
 vehicle.applyBody(vehicleBlend,vehicleYaw*Math.PI/2,vehicleDistance);
 if(time>nextBlink){blinkStart=time;nextBlink=time+2.6+Math.random()*3.6}
 const animalAct=isAnimalScene(act?.kind)?act:null;
 const age=time-blinkStart,still=reducedMotion.matches&&(!act||orderPanel||animalAct)&&!physical();
 const opening=!still&&age>=0&&age<.19?Math.max(.04,1-Math.sin(age/.19*Math.PI)*.98):1;
 const screenBlink=animalAct&&!reducedMotion.matches?(animalAct.t<.42?1-cue(animalAct.t,.22,.42):cue(animalAct.t,animalAct.duration-.42,animalAct.duration-.18)):1;
 let lx=attending||time<pointer.until?pointer.x*5:Math.sin(time*.48)*1.5,ly=attending||time<pointer.until?pointer.y*3:Math.sin(time*.4)*1.1;
 if(isHeld){lx=clamp(-dragVX/220,-4,4);ly=3}
 if(airborne){lx=clamp(vx/200,-4,4);ly=vy<0?-3:2}
 if(actTarget&&!attending){lx=actTarget.gaze[0];ly=actTarget.gaze[1]}
 const gazeFollow=orderPanel||orderReturn?1-Math.exp(-dt*10):1;
 gazeX+=(lx-gazeX)*gazeFollow;gazeY+=(ly-gazeY)*gazeFollow;
 const bootEyes=act?.kind==='boot'?cue(act.t,2.12,2.3):1;
 robot.expression({open:opening*screenBlink*bootEyes,left:pose.eyeL,right:pose.eyeR,happy:pose.joy>.52,gazeX,gazeY,alert:heldBlend});
 vehicle.applyEyes(opening*screenBlink*bootEyes,gazeX,gazeY);
 bodyRig.updateMatrix();bodyInverse.copy(bodyRig.matrix).invert();
 for(let i=0;i<2;i++){
  const side=i?1:-1,p=(phase+i*.5)%1;
  let stride=0,lift=0,footAngle=0;
  const stepLength=orderStride+15*(1-orderMotion),stepLift=12+58*orderMotion;
  if(p<.62)stride=stepLength*(1-2*p/.62);else{const q=(p-.62)/.38;stride=-stepLength+stepLength*2*smooth(q);lift=Math.sin(Math.PI*q)*stepLift;footAngle=-Math.sin(Math.PI*q)*(6+11*orderMotion)}
  if(orderPanel?.phase==='opening')stride*=-1;
  let footYaw=yaw,pivotLift=0;
  if(turning){const first=(dir>0?0:1)===i,q=clamp((turnProgress-(first?.09:.37))/.56,0,1);footYaw=dir*(1-2*smooth(q));pivotLift=Math.sin(q*Math.PI)*12}
  const wiggle=Math.sin(time*(isHeld?4.6:6)+i*Math.PI),hangEnergy=isHeld?(.22+.78*Math.exp(-stateTime*2)+clamp(Math.abs(dragVX)/900,0,.6)):1;
  const hangLift=heldBlend*(9+wiggle*5*hangEnergy)*(1-jetStabilize);
  const footPos=v(side*(72+heldBlend*5+jetStabilize*5+pose.floorSit*18),0,stride*gaitBlend+heldBlend*wiggle*8*(1-jetStabilize)+pose.sit*27+pose.floorSit*80).applyAxisAngle(axisY,footYaw*Math.PI/2);
  footPos.y=lift*gaitBlend+pivotLift+hangLift+pose.sit*(2+Math.sin(time*3.6+i*Math.PI)*2)+pose.floorSit*(10-Math.sin(time*3.6+i*Math.PI)*2);
  footPos.x+=side*18*orderGrip;
  legs[i].foot.position.copy(footPos);legs[i].foot.rotation.set((-footAngle*gaitBlend+heldBlend*wiggle*7*(1-jetStabilize))*Math.PI/180+pose.sit*(-.08+.08*Math.sin(time*3.6+i*Math.PI))+pose.floorSit*(-.34-.08*Math.sin(time*3.6+i*Math.PI)),footYaw*Math.PI/2+side*.025*(1-gaitBlend)+side*.08*pose.floorSit,side*heldBlend*.06*(1-jetStabilize));
  // A low fore/aft pendulum around the fixed shoulder. Do not add a lateral
  // lift: with these short paddles it reads as pulling the arm up to the head.
  const armCycle=Math.cos(phase*Math.PI*2);
  const swingTarget=(i?-1:1)*armCycle*gaitBlend*(.28+(orderSwing-23)*.002);
  walkArmAngles[i]+=(swingTarget-walkArmAngles[i])*(1-Math.exp(-dt*14));
  const naturalArm=walkArmRotations[i].setFromAxisAngle(axisX,walkArmAngles[i]);
  const hand=robot.arms[i].grip.clone().applyQuaternion(naturalArm).add(robot.arms[i].group.position);
  if(heldBlend>.001){const startled=isHeld?Math.exp(-stateTime*2.8):.45;hand.lerp(v(side*258,316+startled*35+wiggle*7*hangEnergy,26),heldBlend);}
  if(jetStabilize>0)hand.lerp(v(side*266,275,26),jetStabilize*.7);
  const wave=i===1&&!act&&!physical()&&!orderPanel?hello:0;
  if(wave>0){
   const angle=1.71+.20*Math.sin(inviteTime*Math.PI*4);
   const waveHand=robot.arms[i].grip.clone().applyAxisAngle(axisZ,angle).add(robot.arms[i].group.position);waveHand.z=38;
   hand.lerp(waveHand,wave);
  }
  if(i===0&&invitePose>0)hand.lerp(v(-240,340,55),invitePose*.48);
  const scripted=scriptedHands[i];if(scripted.mix>.001)hand.lerp(scripted.point.clone().applyMatrix4(bodyInverse),scripted.mix);
  const gesturing=heldBlend>.001||jetStabilize>.001||wave>.001||i===0&&invitePose>.001||scripted.mix>.001;
  if(gesturing)robot.aimArm(i,hand,handWorld[i],naturalArm);else robot.rotateArm(i,naturalArm,handWorld[i]);
  handWorld[i].applyMatrix4(bodyRig.matrix);
 }
 vehicle.applyLimbs(vehicleBlend,vehicleYaw*Math.PI/2);
 positionOrderPanel();updateProps();
 const animalVisible=animalAct&&(reducedMotion.matches||animalAct.t>=.42&&animalAct.t<animalAct.duration-.42);
 const animalReveal=animalAct&&!reducedMotion.matches?cue(animalAct.t,.42,.65)*(1-cue(animalAct.t,animalAct.duration-.65,animalAct.duration-.42)):1;
 const bootAct=act?.kind==='boot'?act:null;
 const bootReveal=bootAct?1-cue(bootAct.t,1.87,2.12):0;
 const helloScreen=!act&&!physical()&&!orderPanel&&!reducedMotion.matches&&invitationScreenBlend>.015;
 const displayFace=bootAct&&bootReveal>.001?'boot':animalVisible?animalAct.kind:helloScreen?'hello':null;
 robot.setScreenFace(displayFace,bootAct?bootAct.t:helloScreen?inviteTime:reducedMotion.matches?1.6:Math.max(0,(animalAct?.t||0)-.42),bootAct?bootReveal:helloScreen?invitationScreenBlend:animalReveal);
 const projectionPower=act?.projection?.power||0;projectorFace.visible=projectionPower>.01;
 if(act?.kind==='projection')robot.setEyesVisible(false);
 if(projectorFace.visible)for(const [material,opacity]of projectorMaterials)material.opacity=opacity*projectionPower;
 writeData(host,'face',act?.kind==='projection'?'projector':displayFace|| (batteryFace.visible?'battery':'eyes'));
 writeData(stage,'projecting',String(act?.kind==='projection'));
 const returnProgress=orderReturn?smooth(clamp((now-orderReturn.start)/420,0,1)):1;
 const drawX=orderReturn?orderReturn.x+(x-orderReturn.x)*returnProgress:x,drawGround=orderReturn?orderReturn.ground+(ground-orderReturn.ground)*returnProgress:ground;
 if(orderReturn){orderReturn.drawX=drawX;orderReturn.drawGround=drawGround;}
 writeStyle(host,'transform','translate('+(drawX-840*scale/2)+'px,'+(drawGround-800*scale-elevation)+'px)');
 const shadowScale=1-clamp(elevation/(ceiling||1),0,1)*.55,shadowWidth=actorWidth*(.4+.6*vehicleBlend)*shadowScale;
 writeStyle(shadow,'transform','translate('+(drawX-shadowWidth/2)+'px,'+(drawGround-2)+'px)');writeStyle(shadow,'width',shadowWidth+'px');writeStyle(shadow,'height',Math.max(2.4,actorWidth*.035*shadowScale)+'px');writeStyle(shadow,'filter','blur('+Math.max(.5,1.3+elevation*.012)+'px)');writeStyle(shadow,'opacity',String((.16+gaitBlend*.025)*(1-clamp(elevation/500,0,.7))*(1-clamp(-elevation/(actorWidth*.3),0,1))));

 for(const [key,value]of [['--tim-x',drawX+'px'],['--tim-top',(drawGround-TIM_HEIGHT*scale-elevation)+'px'],['--tim-size',actorWidth+'px']])if(stage.style.getPropertyValue(key)!==value)stage.style.setProperty(key,value);
 writeData(stage,'side',x<stageBox.width/2?'left':'right');
 partsThought.update({x:drawX,headTop:drawGround-TIM_HEIGHT*scale-elevation,viewportWidth:stageBox.width,
  canShow:!orderPanel&&!orderReturn&&vehicleBlend<=0&&!physical()&&!menuOpen&&!attentionHovered&&now>=attentionUntil&&!orderTriggerAttention&&(!act||isAnimalScene(act.kind))&&speed<.04&&gaitBlend<.04&&!['walk','prepare','turn','rest','greet'].includes(state)});
 if(partsButton){
  const visible=carryBlend>.05&&partsAvailable&&(!act||isAnimalScene(act.kind))&&!physical()&&!menuOpen&&partsButton.textContent.trim();
  writeStyle(partsButton,'width',currentLane().boardWidth+'px');writeStyle(partsButton,'left',x+'px');writeStyle(partsButton,'top',(ground-elevation-738*scale)+'px');
  writeStyle(partsButton,'transform','translate(-50%, -100%) perspective(600px) rotateY('+(yaw*12)+'deg)');
  writeStyle(partsButton,'opacity',String(carryBlend));writeStyle(partsButton,'visibility',visible?'visible':'hidden');
  writeStyle(partsButton,'pointerEvents',visible&&carryBlend>.8?'auto':'none');if(partsButton.tabIndex!==(visible?0:-1))partsButton.tabIndex=visible?0:-1;if(partsButton.getAttribute('aria-hidden')!==String(!visible))partsButton.setAttribute('aria-hidden',String(!visible));
 }

 if(fiveTarget&&act?.kind==='five'&&act.contactAt===undefined&&act.t>.9&&act.t<act.duration-.8){
  const handIndex=act.side>0?1:0,palm=motionRig.localToWorld(handWorld[handIndex].clone().add(v(0,-6,25)));
  if(fiveTarget.hidden)fiveTarget.hidden=false;fiveTarget.style.left=(x+palm.x*scale)+'px';fiveTarget.style.top=(ground-palm.y*scale-elevation)+'px';
 }else if(fiveTarget&&!fiveTarget.hidden)fiveTarget.hidden=true;
 if(playDot){const dotHidden=!(act?.kind==='follow'&&time<playPoint.until);if(playDot.hidden!==dotHidden)playDot.hidden=dotHidden;if(!playDot.hidden){playDot.style.left=playPoint.x+'px';playDot.style.top=playPoint.y+'px';}}
 updateHelmet(dt);updateJetEffects();updateHitSilhouette(now);renderer.render(scene,camera);
 }finally{
  inFrame=false;queueFrame(active?0:Math.max(0,interval-(performance.now()-frameClock)-4));
 }
}
syncSuspension();
queueHelmetWarmup(()=>prepareHelmet());
return {
 openOrderPanel(...args){wake();return openOrderPanel(...args);},closeOrderPanel(...args){wake();return closeOrderPanel(...args);},cancelOrderPanel(...args){wake();return cancelOrderPanel(...args);},
 setOrderTriggerAttention(value){wake();orderTriggerAttention=Boolean(value);writeData(stage,'orderOffer',String(!orderPanel&&vehicleBlend<=0&&!physical()&&(orderTriggerAttention||attentionHovered||performance.now()<attentionUntil)));if(value&&!orderPanel&&!physical()&&vehicleBlend<=0){if(act?.automatic)cancelAct();if(!act)restoreMode();controlsUntil=performance.now()+3000;}},
 setOrderLoadState(value){wake();if(!orderPanel)return;orderPanel.load=value;if(value==='loaded'&&orderPanel.phase==='open')orderPanel.readyAt=time;},
 acknowledgeIntroduction(){wake();acknowledgeIntroduction();},
 setHeight(value){sizePx=clamp(Number(value)||125,75,125);resize();},
 setPartsAvailable(value){wake();partsAvailable=Boolean(value);refreshTerritory();},
 setPartsThoughtAvailable(value){partsThought.setAvailable(value);},
 setWalking(value){wake();roaming=autoScenes=Boolean(value);if(!physical()&&!act)restoreMode();},
 setMenuOpen(value){wake();menuOpen=Boolean(value);if(menuOpen&&!physical()&&!act)restoreMode();},
 play(kind){
  wake();
  if(kind==='follow'||kind==='projection'||kind==='stretch'&&reducedMotion.matches)return false;
  if(kind==='stop'){cancelAct();restoreMode();return;}
  if(kind==='turn'){
   if(physical())return;cancelAct();mode='profile';manualTurn=true;state='prepare';stateTime=0;roamTarget=null;return;
  }
  if(kind==='pet'){petLean=0;petUntil=time+.8;}
  return startAct(kind);
 },
 destroy(){
  if(disposed)return;disposed=true;partsThought.destroy();cancelAct();cancelOrderPanel();document.documentElement.removeAttribute('data-tim-grabbing');cancelAnimationFrame(frameId);clearTimeout(frameTimer);lifetime.abort();resizeObserver.disconnect();contentObserver.disconnect();lockObserver.disconnect();
  if(helmetWarmIdle!==null)cancelIdleCallback(helmetWarmIdle);if(helmetWarmTimer!==null)clearTimeout(helmetWarmTimer);
  helmetDeferredTask=null;
  try{if(gesture&&host.hasPointerCapture(gesture.id))host.releasePointerCapture(gesture.id)}catch{}
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of [object.material].flat().filter(Boolean)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  const releaseGraphics=()=>{
   textures.forEach(texture=>texture.dispose());geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
   robot.dispose();hitBatch.dispose();hitTarget.dispose();hitMaterial.dispose();renderer.dispose();renderer.forceContextLoss();
  };
  // Let an in-flight PBO read release its fence/buffer before losing the context.
  const pendingGraphics=[hitRead,helmetCompile].filter(Boolean);
  if(pendingGraphics.length)Promise.allSettled(pendingGraphics).then(releaseGraphics);else releaseGraphics();
  hitCache.clear();renderer.domElement.remove();hitSvg.remove();jetCanvas.remove();
  if(fiveTarget)fiveTarget.hidden=true;if(playDot)playDot.hidden=true;host.removeAttribute('data-pressed');host.removeAttribute('data-activity');stage.removeAttribute('data-suspended');stage.removeAttribute('data-projecting');
  if(partsButton){partsButton.style.visibility='hidden';partsButton.style.pointerEvents='none';partsButton.tabIndex=-1;partsButton.setAttribute('aria-hidden','true');}
 }
};
}


