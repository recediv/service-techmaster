import { smoothPhoneSurfaceNormals } from './phone-surface-normals.mjs';
import { createPhoneTechCircuits } from './phone-tech-circuits.mjs';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10);};
const TAU=Math.PI*2;

// Procedural geometry only: no logos, labels, photograph planes or external assets.
export function createPhoneAssembly({THREE,scene,ownGeometry,materials,textures}){
  if(!THREE||!scene||typeof ownGeometry!=='function'||!materials||!textures)throw new Error('Phone assembly requires scene resource ownership.');
  const root=new THREE.Group();root.name='PhoneExplodedAssembly';scene.add(root);
  const focusPoint=new THREE.Vector3(),dummy=new THREE.Object3D(),unitY=new THREE.Vector3(0,1,0);
  const va=new THREE.Vector3(),vb=new THREE.Vector3(),delta=new THREE.Vector3();
  const geometryCache=new Map(),layers=[],routes=[],coaxCurves=[],ribbons=[];
  let cycleTime=0,expansion=0,phase='closed',inspection=0;
  const liftedShields=[];
  const own=g=>ownGeometry(g);
  const std=options=>{const m=new THREE.MeshStandardMaterial(options);materials.add(m);return m;};
  const physical=options=>{const m=new THREE.MeshPhysicalMaterial(options);materials.add(m);return m;};
  const cached=(key,create)=>{if(!geometryCache.has(key))geometryCache.set(key,own(create()));return geometryCache.get(key);};

  function rounded(w,h,r){
    const s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/2,h/2);
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
  }
  function polygon(points){const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();return s;}
  function circleHole(shape,x,y,r){const p=new THREE.Path();p.absarc(x,y,r,0,TAU,true);shape.holes.push(p);}
  function rectangularHole(shape,w,h,r,x=0,y=0){const p=rounded(w,h,r);const points=p.getPoints(24).map(v=>new THREE.Vector2(v.x+x,v.y+y));shape.holes.push(new THREE.Path(points));}
  function extrude(shape,depth,bevel=.006,segments=2){
    const contour=shape.getPoints(8);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const p of contour){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
    const large=maxX-minX>=2.5||maxY-minY>=4;
    const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:large?18:8,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:Math.max(segments,large?5:3)});smoothPhoneSurfaceNormals(g);g.translate(0,0,-depth/2);return own(g);
  }
  function plate(w,h,d,r=.08,bevel=.005){return cached(`plate:${w}:${h}:${d}:${r}:${bevel}`,()=>{const large=w>=2.5||h>=4;const g=new THREE.ExtrudeGeometry(rounded(w,h,r),{depth:d,steps:1,curveSegments:large?18:8,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:large?5:3});smoothPhoneSurfaceNormals(g);return g.translate(0,0,-d/2);});}
  function ring(w,h,iw,ih,d,r=.08,bevel=.004){const s=rounded(w,h,r);rectangularHole(s,iw,ih,Math.max(.01,r-(w-iw)/2));return extrude(s,d,bevel);}
  function box(){return cached('unit-box',()=>new THREE.BoxGeometry(1,1,1));}
  function cyl(r,h,segments=24){return cached(`cyl:${r}:${h}:${segments}`,()=>{const g=new THREE.CylinderGeometry(r,r,h,segments);return g.rotateX(Math.PI/2);});}
  function torus(r,t,segments=32){return cached(`torus:${r}:${t}:${segments}`,()=>new THREE.TorusGeometry(r,t,6,segments));}
  function mesh(g,m,parent=root,p=[0,0,0],cast=true){const o=new THREE.Mesh(g,m);o.position.set(...p);o.castShadow=cast;o.receiveShadow=true;o.userData.skipDofDepth=Boolean(m.transparent&&m.opacity<.65||m.transmission>.5);parent.add(o);return o;}
  function instanced(g,m,items,parent=root,cast=false){
    const o=new THREE.InstancedMesh(g,m,items.length);
    items.forEach((item,i)=>{dummy.position.set(...item.p);dummy.rotation.set(0,0,item.r||0);dummy.scale.set(...(item.s||[1,1,1]));dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);if(item.c!==undefined)o.setColorAt(i,new THREE.Color(item.c));});
    o.instanceMatrix.needsUpdate=true;if(o.instanceColor)o.instanceColor.needsUpdate=true;o.castShadow=cast;o.receiveShadow=true;o.userData.skipDofDepth=Boolean(m.transparent&&m.opacity<.65||m.transmission>.5);parent.add(o);return o;
  }
  function layer(name,closed,open,order,x=0,y=0){const g=new THREE.Group();g.name=name;root.add(g);layers.push({g,closed,open,order,x,y});return g;}
  function lineSegments(points,width,z,items,height=.008){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];items.push({p:[(a[0]+b[0])/2,(a[1]+b[1])/2,z],r:Math.atan2(dy,dx),s:[Math.hypot(dx,dy),width,height]});}}
  function curveChain(curve,radius,mat,count=28,parent=root){
    const geometry=cached(`chain:${radius}`,()=>new THREE.CylinderGeometry(radius,radius,1,8));const object=new THREE.InstancedMesh(geometry,mat,count);object.frustumCulled=false;object.castShadow=true;object.receiveShadow=true;parent.add(object);coaxCurves.push({curve,object,count});return object;
  }
  function ribbon(curve,width,mat){
    const segments=16,positions=new Float32Array((segments+1)*12),indices=[];
    for(let i=0;i<segments;i++)for(const [a,b]of[[0,1],[1,2],[2,3],[3,0]]){const j=i*4,k=(i+1)*4;indices.push(j+a,k+a,k+b,j+a,k+b,j+b);}
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));g.setIndex(indices);const object=mesh(g,mat,root,[0,0,0]);object.frustumCulled=false;ribbons.push({curve,width,geometry:g,segments});return object;
  }

  // A small procedural material map gives long satin highlights instead of flat CAD silver.
  const noise=new Uint8Array(256*64*4);let seed=32019;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<64;y++){const row=random()*22;for(let x=0;x<256;x++){const i=(y*256+x)*4,v=180+row+random()*12;noise[i]=noise[i+1]=noise[i+2]=v;noise[i+3]=255;}}
  const brushing=new THREE.DataTexture(noise,256,64,THREE.RGBAFormat);brushing.wrapS=brushing.wrapT=THREE.RepeatWrapping;brushing.repeat.set(3,2);brushing.colorSpace=THREE.NoColorSpace;brushing.magFilter=THREE.LinearFilter;brushing.minFilter=THREE.LinearMipmapLinearFilter;brushing.generateMipmaps=true;brushing.anisotropy=4;brushing.needsUpdate=true;textures.add(brushing);
  const silver=physical({color:0xd0dbe1,metalness:1,roughness:.33,envMapIntensity:.65,roughnessMap:brushing,anisotropy:.10});
  const steel=std({color:0x6d7d88,metalness:1,roughness:.42,envMapIntensity:.65,roughnessMap:brushing});
  const ceramic=std({color:0x12191e,metalness:.06,roughness:.68});
  const gasket=std({color:0x070c10,metalness:0,roughness:.85});
  const pcbMat=std({color:0xaebfbd,metalness:.23,roughness:.42});
  const chipMat=std({color:0x0b141c,metalness:.12,roughness:.41});
  const passiveMat=std({color:0xffffff,metalness:.16,roughness:.55});
  const gold=std({color:0xd3ad69,metalness:1,roughness:.26});
  const copper=std({color:0x936a49,metalness:1,roughness:.34});
  const foil=std({color:0x18232c,metalness:.08,roughness:.64,roughnessMap:brushing});
  const flex=std({color:0x20160d,metalness:.08,roughness:.45,side:THREE.DoubleSide});
  const backMat=physical({color:0xd9e9ee,metalness:0,roughness:.14,transmission:.74,thickness:.025,transparent:true,opacity:.54,depthWrite:false,envMapIntensity:.32,specularIntensity:.45,clearcoat:.18,clearcoatRoughness:.22});
  const oledMat=physical({color:0x031427,metalness:.12,roughness:.18,transmission:0,thickness:.018,transparent:false,opacity:1,depthWrite:true,envMapIntensity:.18,specularIntensity:.35,clearcoat:.15,clearcoatRoughness:.20});
  const glassMat=physical({color:0xeafaff,metalness:0,roughness:.10,transmission:0,thickness:.022,ior:1.45,envMapIntensity:.08,specularIntensity:.08,clearcoat:0,transparent:true,opacity:.10,depthWrite:false});
  glassMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nfloat edgeFresnel=1.0-clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.0,1.0);\ndiffuseColor.a *= 0.16+0.84*pow(edgeFresnel,4.0);');};
  glassMat.customProgramCacheKey=()=> 'phone-clear-fresnel-glass-v1';
  const glassEdge=physical({color:0xe3f5f8,metalness:0,roughness:.17,transmission:.75,thickness:.025,ior:1.5,envMapIntensity:.3,specularIntensity:.4,clearcoat:.1,clearcoatRoughness:.18,depthWrite:false});
  const lensMat=physical({color:0xe1efff,metalness:0,roughness:.015,transmission:.92,thickness:.045,ior:1.52,envMapIntensity:.7,clearcoat:.3,iridescence:.3,iridescenceThicknessRange:[210,360],attenuationColor:0x9bbbd4,attenuationDistance:.4,depthWrite:false});
  const opticsAbsorber=new THREE.MeshBasicMaterial({color:0x01040a});materials.add(opticsAbsorber);
  const cyan=std({color:0x237d8c,metalness:.45,roughness:.30,emissive:0x0ba9c8,emissiveIntensity:.25});
  const coral=std({color:0x984c35,metalness:.40,roughness:.33,emissive:0xff674c,emissiveIntensity:.12});
  const pulseMat=std({color:0xa1edf2,metalness:.25,roughness:.25,emissive:0x50d9eb,emissiveIntensity:4.0});

  const chassis=layer('Machined chassis',0,0,0),back=layer('Rear glass and charging coil',-.16,-.55,0,-.12,-.12);
  const battery=layer('Twin-cell battery',-.065,.32,1,.14,-.16),board=layer('Shaped logic board',-.045,.95,2,-.18,.10);
  const stiffener=layer('Open midframe and thermal bridge',.084,2.34,3,.38,.42),oled=layer('OLED module',.147,2.45,4,.38,.42);
  const front=layer('Cover glass',.282,2.80,5,.38,.42),screws=layer('Captive screws',.090,1.85,3,-.18,.10);

  // Four real rails/corner arcs leave actual holes through the lower port wall.
  for(const x of [-1.5525,1.5525])mesh(plate(.145,5.73,.24,.025,.008),silver,chassis,[x,0,0]);
  mesh(plate(2.33,.145,.24,.025,.008),silver,chassis,[0,3.2525,0]);
  const bottom=rounded(2.33,.24,.015);rectangularHole(bottom,.57,.105,.045,0,-.014);
  for(const sign of [-1,1])for(let i=0;i<5;i++)circleHole(bottom,sign*(.53+i*.125),-.005,.025);
  const bottomGeometry=extrude(bottom,.145,.005);bottomGeometry.rotateX(Math.PI/2);mesh(bottomGeometry,silver,chassis,[0,-3.2525,0]);
  const cornerShape=new THREE.Shape();cornerShape.absarc(0,0,.46,0,Math.PI/2,false);cornerShape.lineTo(0,.315);cornerShape.absarc(0,0,.315,Math.PI/2,0,true);cornerShape.closePath();
  const corner=extrude(cornerShape,.24,.008);
  for(const [x,y,r]of[[1.165,2.865,0],[-1.165,2.865,Math.PI/2],[-1.165,-2.865,Math.PI],[1.165,-2.865,Math.PI*1.5]]){const part=mesh(corner,silver,chassis,[x,y,0]);part.rotation.z=r;}
  const floorShape=rounded(2.97,6.32,.33),coilWindow=new THREE.Path(),coilAngle=Math.acos(.18/1.03),coilTop=Math.sqrt(1.03**2-.18**2)-.40;
  coilWindow.moveTo(-.18,1.15);coilWindow.lineTo(.18,1.15);coilWindow.lineTo(.18,coilTop);coilWindow.absarc(0,-.40,1.03,coilAngle,Math.PI-coilAngle,true);coilWindow.lineTo(-.18,1.15);coilWindow.closePath();floorShape.holes.push(coilWindow);
  mesh(extrude(floorShape,.024,.003),steel,chassis,[0,0,-.120]);
  mesh(ring(3.00,6.34,2.91,6.25,.008,.35,.002),gasket,chassis,[0,0,.107]);
  const rails=[];for(const x of [-1.435,1.435])rails.push({p:[x,0,-.055],s:[.035,5.82,.075]});instanced(box(),steel,rails,chassis,true);
  for(const [x,y,h]of[[-1.635,.95,.72],[-1.635,-.02,.72],[1.635,.44,1.05]]){
    mesh(plate(.035,h+.08,.105,.017,.004),gasket,chassis,[x,y,0]);mesh(plate(.045,h,.084,.02,.005),silver,chassis,[x*1.008,y,.003]);
  }
  const antenna=[];for(const x of [-1.554,1.554])for(const y of [-2.47,2.47])antenna.push({p:[x,y,0],s:[.15,.027,.247]});instanced(box(),gasket,antenna,chassis);
  // USB tongue and its contacts sit behind the through-cut, not painted on the wall.
  mesh(plate(.64,.40,.10,.06,.006),gasket,chassis,[0,-3.025,-.015]);
  mesh(plate(.42,.16,.027,.012,.002),ceramic,chassis,[0,-3.195,-.015]);
  const usbPins=[];for(let i=0;i<12;i++)usbPins.push({p:[-.18+i*.0327,-3.208,.003],s:[.016,.12,.008]});instanced(box(),gold,usbPins,chassis);
  const lowerBoard=polygon([[-1.37,-3.14],[-.44,-3.14],[-.44,-2.93],[.44,-2.93],[.44,-3.14],[1.37,-3.14],[1.37,-2.70],[-1.37,-2.70]]);
  mesh(extrude(lowerBoard,.018,.003),pcbMat,chassis,[0,0,-.045]);
  mesh(plate(.67,.38,.105,.055,.008),ceramic,chassis,[-.92,-2.86,.016]);
  mesh(plate(.83,.32,.105,.055,.008),steel,chassis,[.89,-2.87,.016]);
  const grille=[];for(let i=0;i<8;i++)grille.push({p:[-.92+(i-3.5)*.063,-2.86,.077],s:[.024,.23,.005]});instanced(box(),gasket,grille,chassis);

  const cameraPositions=[[-1.02,2.55],[-.42,2.16],[-1.02,1.73]];
  const rearShape=rounded(3.18,6.56,.425);for(const [x,y]of cameraPositions)circleHole(rearShape,x,y,.234);
  mesh(extrude(rearShape,.018,.003),backMat,back);
  const island=rounded(1.47,1.97,.24);for(const [x,y]of cameraPositions)circleHole(island,x+.78,y-2.16,.236);
  mesh(extrude(island,.025,.005),steel,back,[-.78,2.16,.021]);
  const ferrite=mesh(cyl(1.01,.010,64),ceramic,back,[0,-.40,.017]);
  const spiral=new (class extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){const a=t*TAU*12,r=.73+t*.22;return target.set(Math.cos(a)*r,Math.sin(a)*r-.40,.030);}})();
  mesh(own(new THREE.TubeGeometry(spiral,192,.007,4,false)),copper,back,[0,0,0],false);
  mesh(plate(.30,.68,.012,.04,.002),flex,back,[0,.78,.030]);

  for(const cy of [.19,-1.63]){
    mesh(plate(2.11,1.73,.108,.12,.008),foil,battery,[.30,cy,.030]);
    mesh(plate(1.98,.045,.008,.012,.001),gasket,battery,[.30,cy-.805,.091]);
    const folds=[];for(let i=0;i<12;i++)for(const side of [-1,1])folds.push({p:[.30+side*.985,cy-.69+i*.125,.088],r:side*.18,s:[.075,.005,.003]});instanced(box(),steel,folds,battery);
  }
  mesh(plate(.24,.56,.014,.025,.002),flex,battery,[-.82,-.66,.032]);
  // Generic battery identification is printed as geometry, without a bitmap or invented specs.
  const printed=[],ink=std({color:0x9aabb5,metalness:0,roughness:.85});
  const letters={
    L:[[[0,1],[0,0],[.50,0]]],
    i:[[[.25,.68],[.25,0]],[[.25,1],[.25,.91]]],
    '-':[[[0,.42],[.45,.42]]],
    o:[[[.05,0],[.05,.65],[.50,.65],[.50,0],[.05,0]]],
    n:[[[.05,0],[.05,.65],[.50,.65],[.50,0]]]
  };
  for(const cy of [.19,-1.63]){
    let x=.30-.25;
    for(const letter of 'Li-ion'){
      for(const path of letters[letter])lineSegments(path.map(([px,py])=>[x+px*.13,cy-.28+py*.18]),.006,.096,printed,.001);
      x+=.092;
    }
    lineSegments([[.30,cy+.38],[.12,cy+.09],[.48,cy+.09],[.30,cy+.38]],.006,.096,printed,.001);
    lineSegments([[.30,cy+.23],[.30,cy+.10]],.006,.096,printed,.001);
    lineSegments([[1.06,cy+.60],[1.24,cy+.60]],.008,.096,printed,.001);
    lineSegments([[-.65,cy+.60],[-.47,cy+.60]],.008,.096,printed,.001);
    lineSegments([[-.56,cy+.51],[-.56,cy+.69]],.008,.096,printed,.001);
  }
  instanced(box(),ink,printed,battery);

  const pcbOutline=[[-1.43,-2.57],[-.94,-2.57],[-.94,.88],[-.73,1.09],[.26,1.09],[.26,1.28],[1.40,1.28],[1.40,2.98],[-1.43,2.98]];
  const boardShape=polygon(pcbOutline);for(const [x,y]of[[-1.25,-2.36],[-1.25,2.79],[1.21,2.78],[.43,1.45]])circleHole(boardShape,x,y,.046);
  for(const [x,y]of cameraPositions)circleHole(boardShape,x,y,.145);
  const pcbGeometry=extrude(boardShape,.030,.004);mesh(pcbGeometry,pcbMat,board);mesh(pcbGeometry,copper,board,[0,0,-.018]);
  const mounting=[];for(const [x,y]of[[-1.25,-2.36],[-1.25,2.79],[1.21,2.78],[.43,1.45]])mounting.push({p:[x,y,.022],s:[1,1,1]});instanced(torus(.061,.015,18),gold,mounting,board);
  const chips=[[-1.18,-1.98,.28,.46],[-1.18,-1.28,.26,.42],[-1.18,-.60,.28,.43],[-1.18,.10,.28,.43],[-1.16,.72,.29,.30],[.86,2.57,.59,.48],[.90,1.84,.54,.43],[.27,2.77,.26,.24],[.30,2.12,.22,.26],[.72,1.44,.34,.18]];
  const chipBodies=[],pins=[],passives=[],passiveEnds=[];
  for(const [x,y,w,h]of chips){
    chipBodies.push({p:[x,y,.053],s:[w,h,.062]});
    const n=Math.max(4,Math.floor(h/.065));for(let i=0;i<n;i++)for(const side of [-1,1])pins.push({p:[x+side*(w/2+.014),y+(i/(n-1)-.5)*(h-.04),.030],s:[.045,.021,.019]});
  }
  instanced(plate(1,1,1,.07,.018),chipMat,chipBodies,board,true);instanced(box(),gold,pins,board);
  function passive(x,y,rotation=0,index=0){const w=index%3===0?.090:.066,h=.042;passives.push({p:[x,y,.038],r:rotation,s:[w,h,.031],c:index%4===0?0x9c8b6c:index%4===1?0x73828c:0x202b31});for(const d of [-w*.40,w*.40])passiveEnds.push({p:[x+Math.cos(rotation)*d,y+Math.sin(rotation)*d,.038],r:rotation,s:[w*.23,h+.005,.033]});}
  for(let group=0;group<5;group++)for(let i=0;i<7;i++)passive(i%2?-1.367:-.997,-2.15+group*.65+i*.061,Math.PI/2,i+group);
  for(let i=0;i<14;i++){passive(1.28,1.43+i*.102,Math.PI/2,i);passive(.39,1.56+i*.092,Math.PI/2,i+1);}
  for(let i=0;i<12;i++)passive(-.10+i*.115,2.88,0,i);
  instanced(box(),passiveMat,passives,board);instanced(box(),steel,passiveEnds,board);
  // Shaped RF shield lids have folded rims and actual small ventilation holes.
  for(const [x,y,w,h]of[[.88,2.53,.74,.63],[.90,1.85,.70,.56]]){
    mesh(ring(w,h,w-.07,h-.07,.050,.055,.004),steel,board,[x,y,.065]);
    const lid=rounded(w-.014,h-.014,.05);for(let i=0;i<5;i++)circleHole(lid,-w*.30+i*w*.15,h*.24,.016);
    const shieldLid=mesh(extrude(lid,.012,.003),silver,board,[x,y,.099]);
    if(y<2)liftedShields.push({mesh:shieldLid,x,y});
  }
  const traces=[],lights=[];
  const signalPaths=[[[1.20,2.70],[.50,2.70],[.30,2.50],[.30,1.35],[.20,1.25],[-.77,1.25],[-1.03,.99],[-1.03,-2.25]],[[-1.32,2.64],[-1.32,1.30],[-1.27,1.17],[-1.27,-1.90]],[[1.24,1.48],[1.06,1.48],[.89,1.31],[.38,1.31],[.20,1.31],[.20,1.13],[-.78,1.13]]];
  signalPaths.forEach((points,index)=>{lineSegments(points,.021,.024,traces,.006);lineSegments(points,.008,.030,lights,.004);const path=points.map(p=>new THREE.Vector3(p[0],p[1],.044));const length=[0];for(let i=1;i<path.length;i++)length.push(length.at(-1)+path[i].distanceTo(path[i-1]));routes.push({path,length});});
  instanced(box(),copper,traces,board);instanced(box(),cyan,lights,board);
  const diagnosticRing=mesh(ring(.62,.51,.58,.47,.004,.035,.001),cyan,board,[.90,1.84,.086],false);diagnosticRing.visible=false;
  const padItems=[];for(let i=0;i<18;i++)padItems.push({p:[-1.405,-2.15+i*.26,.023],s:[.045,.075,.008]});for(let i=0;i<10;i++)padItems.push({p:[.38+i*.092,2.965,.024],s:[.058,.030,.009]});instanced(box(),gold,padItems,board);
  // Triple camera modules include ceramic shoulders, machined rings and recessed optical glass.
  const cameraFeet=[],cameraBodies=[],cameraRings=[],innerRings=[],lenses=[],lensCenters=[];
  for(const [x,y]of cameraPositions){cameraFeet.push({p:[x,y,.037],s:[.58,.59,.052]});cameraBodies.push({p:[x,y,.087],s:[1,1,1]});cameraRings.push({p:[x,y,.128],s:[1,1,1]});innerRings.push({p:[x,y,.137],s:[1,1,1]});lenses.push({p:[x,y,.143],s:[1,1,1]});lensCenters.push({p:[x,y,.149],s:[1,1,1]});}
  instanced(plate(1,1,1,.12,.015),steel,cameraFeet,board,true);instanced(cyl(.239,.080,36),ceramic,cameraBodies,board,true);instanced(torus(.225,.018,36),silver,cameraRings,board);instanced(torus(.172,.011,32),steel,innerRings,board);
  instanced(cyl(.174,.006,32),opticsAbsorber,cameraPositions.map(([x,y])=>({p:[x,y,.134],s:[1,1,1]})),board);
  const opticalDome=own(new THREE.SphereGeometry(1,36,16,0,TAU,0,Math.PI/2));opticalDome.rotateX(Math.PI/2);opticalDome.scale(.178,.178,.025);instanced(opticalDome,lensMat,lenses,board);
  mesh(cyl(.065,.028,24),backMat,board,[-.40,2.65,.110]);

  const midShape=rounded(2.95,6.30,.33);rectangularHole(midShape,2.32,3.83,.13,.29,-.73);rectangularHole(midShape,1.44,1.70,.22,-.68,2.15);rectangularHole(midShape,.79,1.66,.08,.91,2.10);
  mesh(extrude(midShape,.014,.003),steel,stiffener);
  mesh(plate(1.00,.57,.009,.05,.002),copper,stiffener,[.88,2.30,.015]);
  mesh(plate(.62,.30,.028,.025,.002),gasket,board,[.88,2.40,.123]);
  // A deep-blue OLED under the routed electronic layer, with a separate glass cover.
  mesh(ring(3.10,6.44,2.94,6.28,.025,.40,.005),ceramic,oled);
  const oledShape=rounded(3.015,6.335,.355);rectangularHole(oledShape,.49,.082,.038,0,2.91);circleHole(oledShape,.37,2.905,.037);
  mesh(extrude(oledShape,.012,.003),oledMat,oled,[0,0,.012]);
  mesh(ring(3.10,6.44,3.06,6.39,.009,.40,.0015),silver,oled,[0,0,.022]);
  mesh(plate(.47,.060,.009,.028,.001),gasket,oled,[0,2.91,.014]);
  mesh(cyl(.031,.008,20),lensMat,oled,[.37,2.905,.015]);
  mesh(plate(3.16,6.53,.012,.425,.003),glassMat,front,[0,0,0],false);

  const screwLocations=[[-1.29,2.91],[1.29,2.91],[-1.29,-2.91],[1.29,-2.91],[-1.36,.22],[1.36,.22]];
  const posts=[],shaft=[],head=[],thread=[],slots=[];
  for(const [x,y]of screwLocations){posts.push({p:[x,y,-.052],s:[1,1,1]});shaft.push({p:[x,y,-.062],s:[1,1,1]});head.push({p:[x,y,.016],s:[1,1,1]});for(let i=0;i<3;i++)thread.push({p:[x,y,-.120+i*.025],s:[1,1,1]});for(const r of [0,Math.PI/2])slots.push({p:[x,y,.041],r,s:[.061,.014,.005]});}
  const bossShape=new THREE.Shape();bossShape.absarc(0,0,.075,0,TAU,false);circleHole(bossShape,0,0,.036);
  instanced(extrude(bossShape,.10,.003),silver,posts,chassis,true);instanced(cyl(.026,.145,12),steel,shaft,screws,true);instanced(cyl(.059,.044,20),silver,head,screws,true);instanced(torus(.027,.005,12),steel,thread,screws);instanced(box(),gasket,slots,screws);

  const coax=new THREE.CubicBezierCurve3(new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3());curveChain(coax,.018,gasket,32);
  const batteryFlex=new THREE.CubicBezierCurve3(new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3());ribbon(batteryFlex,.21,flex);
  const displayFlex=new THREE.CubicBezierCurve3(new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3());ribbon(displayFlex,.235,flex);
  const flexContacts=[];for(let i=0;i<8;i++)flexContacts.push({p:[-.87,-.74+i*.025,.053],s:[.13,.010,.006]});instanced(box(),gold,flexContacts,battery);
  const cableConnector=mesh(plate(.26,.30,.035,.025,.003),ceramic,board,[-1.15,-.65,.05]);
  mesh(plate(.23,.17,.035,.025,.003),ceramic,board,[1.20,1.42,.05]);
  mesh(cyl(.043,.035,16),gold,board,[-1.28,1.10,.035]);mesh(cyl(.043,.035,16),gold,chassis,[-.95,-2.80,.005]);
  const screenConnector=mesh(plate(.30,.29,.028,.025,.003),ceramic,oled,[1.12,1.10,-.030]);
  const pulseGeometry=own(new THREE.SphereGeometry(.018,8,6)),pulses=new THREE.InstancedMesh(pulseGeometry,pulseMat,routes.length*12);pulses.frustumCulled=false;board.add(pulses);
  const techCircuits=createPhoneTechCircuits({THREE,ownGeometry,materials,chassis,board,oled,chipGeometry:plate(1,1,1,.07,.018)});

  function layerExpansion(item,t){
    const out=smooth((t-1.20)/3.35),backIn=smooth((t-9.40)/3.35);return out*(1-backIn);
  }
  function update(time=0){
    const absolute=Number.isFinite(time)?time:0;cycleTime=((absolute%14)+14)%14;
    expansion=layerExpansion(layers.find(item=>item.g===board),cycleTime);
    phase=cycleTime<1.15||cycleTime>=13.0?'closed':cycleTime<4.90?'exploding':cycleTime<9.35?'inspection':'assembling';
    const coverExpansion=layerExpansion(layers.find(item=>item.g===front),cycleTime);
    for(const item of layers){const e=item.g===oled||item.g===front?coverExpansion:layerExpansion(item,cycleTime);item.g.position.set(item.x*e,item.y*e,THREE.MathUtils.lerp(item.closed,item.open,e));}
    oled.rotation.x=-.025*coverExpansion;front.rotation.x=-.025*coverExpansion;stiffener.rotation.x=oled.rotation.x;
    root.rotation.z=-.105+Math.sin(absolute*TAU/14)*.024;root.rotation.y=.035+Math.cos(absolute*TAU/14)*.010;
    const inspect=smooth((cycleTime-4.9)/.55)*(1-smooth((cycleTime-8.8)/.50));inspection=inspect;
    oledMat.opacity=1;
    techCircuits.update(absolute,.36+inspect*.64,coverExpansion);
    for(const lid of liftedShields){lid.mesh.position.set(lid.x+inspect*.36,lid.y,.099+inspect*.18);}
    diagnosticRing.visible=inspect>.015;
    cyan.emissiveIntensity=.18+inspect*1.30;coral.emissiveIntensity=.07+inspect*.26;
    coax.v0.set(-1.28+board.position.x,1.10+board.position.y,board.position.z+.055);coax.v1.set(-1.56+board.position.x*.6,.10,board.position.z*.58+.03);coax.v2.set(-1.48,-2.10,board.position.z*.26+.03);coax.v3.set(-.95,-2.80,.018);
    batteryFlex.v0.set(-.79+battery.position.x,-.65+battery.position.y,battery.position.z+.044);batteryFlex.v1.set(-.94+battery.position.x,-.65+battery.position.y,battery.position.z+.075);batteryFlex.v2.set(-1.17+board.position.x,-.65+board.position.y,board.position.z+.030);batteryFlex.v3.set(-1.15+board.position.x,-.65+board.position.y,board.position.z+.055);
    displayFlex.v0.set(1.20+board.position.x,1.42+board.position.y,board.position.z+.055);displayFlex.v1.set(1.57+board.position.x,1.42+board.position.y,board.position.z+.12);displayFlex.v2.set(1.62+oled.position.x,1.10+oled.position.y,oled.position.z-.18);displayFlex.v3.set(1.12,1.10,-.025).applyEuler(oled.rotation).add(oled.position);
    for(const item of coaxCurves){for(let i=0;i<item.count;i++){item.curve.getPoint(i/item.count,va);item.curve.getPoint((i+1)/item.count,vb);dummy.position.copy(va).add(vb).multiplyScalar(.5);delta.copy(vb).sub(va);const length=delta.length();dummy.quaternion.setFromUnitVectors(unitY,delta.normalize());dummy.scale.set(1,length*1.03,1);dummy.updateMatrix();item.object.setMatrixAt(i,dummy.matrix);}item.object.instanceMatrix.needsUpdate=true;}
    for(const item of ribbons){const positions=item.geometry.attributes.position;for(let i=0;i<=item.segments;i++){item.curve.getPoint(i/item.segments,va);for(let corner=0;corner<4;corner++){const y=(corner===0||corner===3?-1:1)*item.width/2,z=corner<2?.006:-.006;positions.setXYZ(i*4+corner,va.x,va.y+y,va.z+z);}}positions.needsUpdate=true;item.geometry.computeVertexNormals();item.geometry.computeBoundingSphere();}
    let n=0;for(const route of routes)for(let trail=0;trail<12;trail++){
      const total=route.length.at(-1),distance=((absolute*1.45-trail*.065)%total+total)%total;let segment=1;while(segment<route.length.length-1&&route.length[segment]<distance)segment++;
      dummy.position.copy(route.path[segment-1]).lerp(route.path[segment],(distance-route.length[segment-1])/(route.length[segment]-route.length[segment-1]));dummy.quaternion.identity();dummy.scale.setScalar(inspect*(1-trail/13));dummy.updateMatrix();pulses.setMatrixAt(n++,dummy.matrix);
    }pulses.instanceMatrix.needsUpdate=true;
    // Geometry is parented once; report a real world-space point on the logic board.
    root.updateWorldMatrix(true,true);focusPoint.set(.48,1.10,front.position.z*.55+board.position.z*.45+.10);root.localToWorld(focusPoint);
  }
  function getState(){let meshes=0,triangles=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});return {cycleTime,expansion,phase,meshes,triangles:Math.round(triangles),layers:Object.fromEntries(layers.map(item=>[item.g.name,{x:item.g.position.x,y:item.g.position.y,z:item.g.position.z}]))};}
  update(0);
  return {root,update,focusPoint,getState,getInspection:()=>inspection};
}
