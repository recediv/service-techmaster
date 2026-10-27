import { smoothPhoneSurfaceNormals } from './phone-surface-normals.mjs';

// A single authored electronics assembly. XY is the device surface, +Y is the camera end,
// +Z is out of the phone. The caller owns the housing, glass, animation and lighting.
export function createDeviceInternals({THREE,ownGeometry,materials,textures}){
  if(!THREE||typeof ownGeometry!=='function'||!materials||!textures)throw new Error('Device internals require resource ownership.');
  const root=new THREE.Group();root.name='DeviceInternals';
  const cache=new Map(),batches=new Map(),dummy=new THREE.Object3D();
  const own=g=>ownGeometry(g),TAU=Math.PI*2,top=.084;
  const material=(name,options,physical=false)=>{const m=physical?new THREE.MeshPhysicalMaterial(options):new THREE.MeshStandardMaterial(options);m.name=name;materials.add(m);return m;};
  const cached=(key,make)=>{if(!cache.has(key))cache.set(key,own(make()));return cache.get(key);};
  let seed=0x58a971;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function scalarTexture(w,h,brushed=false){
    const pixels=new Uint8Array(w*h*4);
    for(let y=0;y<h;y++){const strand=random()*20;for(let x=0;x<w;x++){const i=(y*w+x)*4;const v=brushed?209+strand+random()*6:204+random()*35;pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255;}}
    const texture=new THREE.DataTexture(pixels,w,h,THREE.RGBAFormat);texture.name=brushed?'Satin micrograin':'Ceramic micrograin';texture.colorSpace=THREE.NoColorSpace;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;texture.needsUpdate=true;textures.add(texture);return texture;
  }
  const satin=scalarTexture(256,64,true),grain=scalarTexture(128,128);
  const boardFace=material('Deep petrol solder mask',{color:0x12364b,metalness:.14,roughness:.48,roughnessMap:grain});
  const boardEdge=material('Glass fibre laminate',{color:0x243d45,metalness:0,roughness:.76});
  const boardUnder=material('Lower solder mask',{color:0x1b4555,metalness:.08,roughness:.63});
  const copper=material('Copper laminate and tracks',{color:0xc47b2b,metalness:.8,roughness:.32,envMapIntensity:.85});
  const gold=material('Gold contact plating',{color:0xffbc32,metalness:.65,roughness:.28,envMapIntensity:.95});
  const nickel=material('Satin nickel shielding',{color:0xc4c9cb,metalness:1,roughness:.27,roughnessMap:satin,envMapIntensity:.95});
  const solder=material('Tin solder',{color:0xb0b6b8,metalness:1,roughness:.25,envMapIntensity:.85});
  const graphite=material('Black moulded IC',{color:0x101518,metalness:.02,roughness:.72,roughnessMap:grain,envMapIntensity:.25});
  const chipTop=material('Silicon package cap',{color:0x151b1e,metalness:.08,roughness:.35,roughnessMap:grain,envMapIntensity:.25});
  const substrate=material('IC organic substrate',{color:0x25433a,metalness:.12,roughness:.55});
  const dielectric=material('Capacitor ceramic',{color:0x9e8f73,metalness:0,roughness:.69,roughnessMap:grain});
  const darkCeramic=material('Ferrite and black ceramic',{color:0x25312d,metalness:.05,roughness:.78});
  const tealCeramic=material('Teal power component coating',{color:0x078d99,metalness:.04,roughness:.52,roughnessMap:grain});
  const flexMaterial=material('Polyimide flexible interconnect',{color:0x70411b,metalness:.14,roughness:.49,side:THREE.DoubleSide});
  const whiteInk=material('Solder-mask process markings',{color:0xa0d9d9,metalness:0,roughness:.82});
  const connectorPlastic=material('Connector insulator',{color:0x0d1112,metalness:0,roughness:.76});
  const opticalBlack=material('Optical barrel absorber',{color:0x020406,metalness:0,roughness:.90});

  function rounded(w,h,r=.05){
    const x=-w/2,y=-h/2,s=new THREE.Shape();r=Math.min(r,w/2,h/2);
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);s.closePath();return s;
  }
  function polygon(points){const shape=new THREE.Shape();for(const [i,p]of points.entries())i?shape.lineTo(...p):shape.moveTo(...p);shape.closePath();return shape;}
  function hole(shape,x,y,r){const path=new THREE.Path();path.absarc(x,y,r,0,TAU,true);shape.holes.push(path);}
  function slot(shape,x,y,w,h,r=.02){const path=rounded(w,h,r);const points=path.getPoints(6).map(p=>new THREE.Vector2(p.x+x,p.y+y));shape.holes.push(new THREE.Path(points));}
  function extrusion(shape,depth,bevel=.003,segments=3){
    const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:10,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:segments});smoothPhoneSurfaceNormals(g);g.translate(0,0,-depth/2);return own(g);
  }
  function plate(w,h,d,r=.035,b=.003){return cached(`p:${w}:${h}:${d}:${r}:${b}`,()=>{
    const g=new THREE.ExtrudeGeometry(rounded(w,h,r),{depth:d,steps:1,curveSegments:6,bevelEnabled:b>0,bevelSize:b,bevelThickness:b,bevelSegments:3});smoothPhoneSurfaceNormals(g);return g.translate(0,0,-d/2);
  });}
  const box=cached('box',()=>new THREE.BoxGeometry(1,1,1));
  const unitRounded=plate(1,1,1,.075,.025);
  const unitPassive=plate(1,1,1,.10,.04);
  const cylinder=(r,h,n=20)=>cached(`c:${r}:${h}:${n}`,()=>new THREE.CylinderGeometry(r,r,h,n).rotateX(Math.PI/2));
  const annulus=(r,t,n=24)=>cached(`a:${r}:${t}:${n}`,()=>new THREE.TorusGeometry(r,t,6,n));
  function mesh(name,g,m,p=[0,0,0],parent=root,cast=true){const o=new THREE.Mesh(g,m);o.name=name;o.position.set(...p);o.castShadow=cast;o.receiveShadow=true;parent.add(o);return o;}
  function instance(g,m,p,s=[1,1,1],r=0){
    const key=`${g.id}:${m.id}`;if(!batches.has(key))batches.set(key,{g,m,items:[]});batches.get(key).items.push({p,s,r});
  }
  // Separate the gold caps from crossing copper without changing their XY or size.
  function fanoutVia(x,y,radius){instance(cylinder(radius,.004,12),gold,[x,y,top+.004]);}
  function bar(a,b,width,z,mat,height=.004){const dx=b[0]-a[0],dy=b[1]-a[1];instance(box,mat,[(a[0]+b[0])/2,(a[1]+b[1])/2,z],[Math.hypot(dx,dy),width,height],Math.atan2(dy,dx));}
  function path(points,width,z,mat,height=.004){for(let i=1;i<points.length;i++)bar(points[i-1],points[i],width,z,mat,height);}
  function outlineRect(x,y,w,h,z,mat,width=.009){path([[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2],[x-w/2,y-h/2]],width,z,mat,.003);}

  // Wide, irregular engineering silhouette with service slots and actual plated holes.
  const outline=[[-1.32,-2.91],[-.51,-2.91],[-.51,-2.75],[.49,-2.75],[.49,-2.91],[1.24,-2.91],[1.42,-2.73],[1.42,-1.36],[1.31,-1.25],[1.31,-.70],[1.43,-.58],[1.43,.91],[1.32,1.04],[1.32,2.71],[1.12,2.91],[-1.20,2.91],[-1.42,2.70],[-1.42,1.17],[-1.31,1.06],[-1.31,.45],[-1.43,.32],[-1.43,-2.72]];
  const boardShape=polygon(outline);
  const screwPoints=[[-1.20,-2.65],[1.19,-2.62],[-1.20,2.65],[1.13,2.65],[-1.19,.99],[1.15,-.58]];
  for(const [x,y]of screwPoints)hole(boardShape,x,y,.046);
  slot(boardShape,-.89,-1.07,.11,.34,.035);slot(boardShape,1.14,.99,.095,.33,.025);
  const lower=extrusion(boardShape,.012,0),copperLayer=extrusion(boardShape,.003,0),upper=extrusion(boardShape,.019,0);
  mesh('Lower dielectric',lower,[boardUnder,boardEdge],[0,0,.056]);
  mesh('Continuous internal copper layer',copperLayer,copper,[0,0,.0635]);
  mesh('Main multilayer PCB',upper,[boardFace,boardEdge],[0,0,.0745]);
  for(const [x,y]of screwPoints){instance(annulus(.062,.013,20),gold,[x,y,.086]);instance(cylinder(.033,.008,14),opticalBlack,[x,y,.080]);}

  // Gull-wing leads have an actual bent cross section, rather than flat gold rectangles.
  const leadShape=polygon([[-.077,0],[-.018,0],[.011,.023],[.011,.063],[.043,.063],[.043,.076],[-.003,.076],[-.003,.029],[-.022,.014],[-.077,.014]]);
  const lead=extrusion(leadShape,.019,.001,2);lead.rotateX(Math.PI/2);
  const heroLeadShape=polygon([[-.107,0],[-.026,0],[.014,.027],[.014,.062],[.045,.062],[.045,.078],[-.003,.078],[-.003,.033],[-.031,.016],[-.107,.016]]);
  const heroLead=extrusion(heroLeadShape,.023,.0015,2);heroLead.rotateX(Math.PI/2);
  const chipFootprints=[];
  function packageIC(name,x,y,w,h,{height=.076,quad=true,pitch=.055,cap=false,hero=false}={}){
    const group=new THREE.Group();group.name=name;group.position.set(x,y,0);root.add(group);
    mesh(`${name} substrate`,plate(w+.060,h+.060,.022,.025,.003),substrate,[0,0,.101],group);
    mesh(`${name} moulding`,plate(w,h,height,.045,.006),graphite,[0,0,.123+height/2],group);
    if(cap){
      const cw=w*(hero?.93:.77),ch=h*(name==='Memory package'?.88:hero?.92:.76),cut=name==='Memory package'?.047:.066;
      // Different moulded lid profiles and shallow real recesses catch the studio key.
      const lid=name==='Memory package'
        ?polygon([[-cw/2+cut,-ch/2],[cw/2-.018,-ch/2],[cw/2,-ch/2+.018],[cw/2,ch/2-.018],[cw/2-.018,ch/2],[-cw/2+.018,ch/2],[-cw/2,ch/2-.018],[-cw/2,-ch/2+cut]])
        :polygon([[-cw/2+.018,-ch/2],[cw/2-.018,-ch/2],[cw/2,-ch/2+.018],[cw/2,ch/2-cut],[cw/2-cut,ch/2],[-cw/2+.018,ch/2],[-cw/2,ch/2-.018],[-cw/2,-ch/2+.018]]);
      if(name==='Memory package'){
        slot(lid,.025,-ch*.31,cw*.55,.008,.003);slot(lid,.035,-ch*.25,cw*.36,.007,.0025);
      }else{
        slot(lid,-cw*.31,-.045,.008,ch*.34,.003);slot(lid,cw*.31,.025,.007,ch*.25,.0025);
      }
      mesh(`${name} lid`,extrusion(lid,.010,.002),name==='Memory package'?nickel:chipTop,[0,0,.126+height],group);
    }
    const ny=Math.max(4,Math.floor((h-.065)/pitch));
    for(let i=0;i<ny;i++)for(const side of [-1,1]){
      const py=y+(i/(ny-1)-.5)*(h-.065);instance(hero?heroLead:lead,solder,[x+side*w/2,py,top+.005],[1,1,1],side<0?0:Math.PI);
      instance(box,gold,[x+side*(w/2+(hero?.063:.046)),py,top+.004],[hero?.129:.094,hero?.034:.029,.006]);
    }
    if(quad){const nx=Math.max(4,Math.floor((w-.065)/pitch));for(let i=0;i<nx;i++)for(const side of [-1,1]){
      const px=x+(i/(nx-1)-.5)*(w-.065);instance(hero?heroLead:lead,solder,[px,y+side*h/2,top+.005],[1,1,1],side<0?Math.PI/2:-Math.PI/2);
      instance(box,gold,[px,y+side*(h/2+(hero?.063:.046)),top+.004],[hero?.034:.029,hero?.129:.094,.006]);
    }}
    instance(cylinder(.017,.002,12),whiteInk,[x-w*.32,y-h*.33,.129+height]);
    chipFootprints.push({x,y,w:w+(hero?.28:.22),h:h+(hero?.28:.22)});return group;
  }
  packageIC('Main application processor',.47,.43,.88,.94,{height:.073,pitch:.058,cap:true,hero:true});
  packageIC('Power management',-.64,-.51,.45,.52,{height:.057,pitch:.052});
  packageIC('Memory package',.69,-1.22,.62,.43,{height:.045,quad:true,pitch:.055,cap:true,hero:true});
  packageIC('Radio controller',.72,2.14,.40,.44,{height:.055,pitch:.055});
  packageIC('Audio codec',-.76,-2.40,.36,.31,{height:.045,quad:false,pitch:.052});
  packageIC('Sensor controller',-1.23,-.03,.22,.26,{height:.040,quad:false,pitch:.050});
  packageIC('Power switching',.95,-2.21,.30,.38,{height:.040,quad:false,pitch:.058});

  // A service land sits beside the processor, not on its moulded package.
  // Its trace reaches the real fifth left-hand gull-wing foot (15 rows at .058 pitch).
  const probeContact=new THREE.Vector3(-.245,.2425,top+.008);
  mesh('Diagnostic test land isolation rim',own(new THREE.RingGeometry(.101,.126,48)),connectorPlastic,[probeContact.x,probeContact.y,top+.001],root,false);
  mesh('Diagnostic gold test land',cylinder(.095,.008,32),gold,[probeContact.x,probeContact.y,top+.004],root,false);
  path([[probeContact.x,probeContact.y],[-.060,.2425]],.018,top+.003,gold,.004);

  // Folded, vented RF cans: walls, flanges and top are separately readable pieces.
  function shield(name,x,y,w,h,{cutCorner=false,vents=5,height=.115}={}){
    const group=new THREE.Group();group.name=name;group.position.set(x,y,0);root.add(group);
    const shape=cutCorner?polygon([[-w/2,-h/2],[w/2-.19,-h/2],[w/2,-h/2+.19],[w/2,h/2],[-w/2,h/2]]):rounded(w,h,.050);
    const wall=shape.clone();
    if(cutCorner){const inside=[[-w/2+.035,-h/2+.035],[w/2-.205,-h/2+.035],[w/2-.035,-h/2+.205],[w/2-.035,h/2-.035],[-w/2+.035,h/2-.035]];wall.holes.push(new THREE.Path(inside.reverse().map(p=>new THREE.Vector2(...p))));}
    else slot(wall,0,0,w-.070,h-.070,.025);
    // Seat the folded rim in the solder mask. A floating, downward-facing
    // nickel micro-bevel produced a bright subpixel fringe along this seam.
    // Keep the upper rim height; the separate stamped lid retains its bevel.
    const wallDepth=height+.011;
    mesh(`${name} folded walls`,extrusion(wall,wallDepth,0),nickel,[0,0,top-.002+wallDepth/2],group);
    const lid=shape.clone();for(let i=0;i<vents;i++)hole(lid,-w*.31+i*w*.62/(vents-1),h*.29,.022);
    if(cutCorner)slot(lid,-w*.25,-h*.27,.20,.10,.025);
    mesh(`${name} stamped lid`,extrusion(lid,.014,.005),nickel,[0,0,top+height+.015],group);
    const tabs=[];for(const side of [-1,1])for(let i=0;i<3;i++){const px=x+side*(w/2+.027),py=y+(i-1)*h*.28;instance(unitRounded,solder,[px,py,top+.013],[.055,.074,.026]);tabs.push([px,py]);}
    for(const [px,py]of tabs)instance(box,gold,[px,py,top+.001],[.073,.100,.004]);
    chipFootprints.push({x,y,w:w+.13,h:h+.13});return group;
  }
  shield('Upper radio shield',.72,2.14,.72,.90,{cutCorner:true,vents:6,height:.130});
  shield('Analogue shield',-.73,.61,.58,.36,{cutCorner:true,vents:4,height:.080});
  shield('Low-noise front-end shield',1.01,1.24,.39,.43,{vents:3,height:.072});

  // Display-side repair view: these are the metal backs of the rear camera
  // modules. Their optical barrels face into the rear housing, away from us.
  const cameras=[[-.93,2.37,.245],[-.31,2.06,.228],[-.93,1.65,.205]];
  for(let i=0;i<cameras.length;i++){
    const [x,y,r]=cameras[i],w=r*2+.10,h=r*2+.13;
    mesh(`Camera ${i+1} insulated module body`,plate(w,h,.105,.045,.004),graphite,[x,y,.145]);
    const foldedWall=rounded(w-.014,h-.014,.040);
    slot(foldedWall,0,0,w-.060,h-.060,.026);
    mesh(`Camera ${i+1} folded metal back wall`,extrusion(foldedWall,.080,.002),nickel,[x,y,.156]);
    mesh(`Camera ${i+1} metal back cover`,plate(w-.014,h-.014,.012,.040,.003),nickel,[x,y,.202]);
    // The dark edge is the insulating tape wrapped around the module housing.
    instance(box,graphite,[x-w*.33,y,.214],[.026,h*.75,.006]);
    chipFootprints.push({x,y,w:r*2+.14,h:r*2+.17});
  }
  // Shared camera carrier and the folded flex terminate on the existing FPC
  // latch. Keep the raised bend clear of the coax corridor at z=.180.
  mesh('Camera assembly shared carrier',plate(.080,.23,.026,.012,.002),graphite,[-.93,2.00,.124]);
  mesh('Camera assembly side carrier',plate(.15,.10,.026,.012,.002),graphite,[-.63,1.86,.124]);
  const cameraFlexPath=[[-.93,1.41,.194],[-.93,1.33,.205],[-.73,1.33,.205],[-.57,1.214,.205],[-.48,1.214,.174]];
  const cameraFlexPositions=[],cameraFlexIndices=[],cameraFlexWidth=.085;
  for(let i=0;i<cameraFlexPath.length;i++){
    const before=cameraFlexPath[Math.max(0,i-1)],after=cameraFlexPath[Math.min(cameraFlexPath.length-1,i+1)];
    const dx=after[0]-before[0],dy=after[1]-before[1],length=Math.hypot(dx,dy)||1;
    const [x,y,z]=cameraFlexPath[i],ox=-dy/length*cameraFlexWidth/2,oy=dx/length*cameraFlexWidth/2;
    cameraFlexPositions.push(x+ox,y+oy,z,x-ox,y-oy,z);
    if(i){const a=(i-1)*2,b=i*2;cameraFlexIndices.push(a,a+1,b,a+1,b+1,b);}
  }
  const cameraFlexGeometry=own(new THREE.BufferGeometry());
  cameraFlexGeometry.setAttribute('position',new THREE.Float32BufferAttribute(cameraFlexPositions,3));
  cameraFlexGeometry.setIndex(cameraFlexIndices);cameraFlexGeometry.computeVertexNormals();
  mesh('Camera assembly polyimide flex',cameraFlexGeometry,flexMaterial,[0,0,-.002],root,false);
  mesh('Camera assembly black flex insulation',cameraFlexGeometry,graphite,[0,0,0],root,false);
  mesh('Flash ceramic carrier',plate(.16,.16,.030,.025,.003),dielectric,[-.28,2.66,.115]);
  mesh('Flash diffuser',cylinder(.058,.018,18),whiteInk,[-.28,2.66,.141]);

  // Gold coaxial sockets, crystal can, real wire-wound ferrite toroid and power inductors.
  function coax(x,y){instance(cylinder(.072,.025,20),solder,[x,y,.103]);instance(annulus(.052,.011,20),gold,[x,y,.121]);instance(cylinder(.026,.027,16),connectorPlastic,[x,y,.121]);instance(cylinder(.010,.031,12),gold,[x,y,.124]);}
  coax(-1.13,-1.42);coax(1.10,.55);coax(.07,2.66);
  mesh('Oscillator nickel can',plate(.35,.18,.060,.055,.008),nickel,[-.52,1.02,.132]);
  for(const x of [-.65,-.39])instance(box,gold,[x,1.02,.091],[.060,.20,.009]);
  const coilX=-.82,coilY=-1.77;
  mesh('Toroidal ferrite core',annulus(.125,.043,32),darkCeramic,[coilX,coilY,.139]);
  const coilCurve=new(class extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){
    const major=t*TAU,turn=t*TAU*12,r=.125+Math.cos(turn)*.048;return target.set(coilX+Math.cos(major)*r,coilY+Math.sin(major)*r,.139+Math.sin(turn)*.048);
  }})();
  mesh('Wound copper on toroidal inductor',own(new THREE.TubeGeometry(coilCurve,192,.007,5,false)),copper,[0,0,0]);
  for(const x of [-.98,-.66]){instance(box,gold,[x,-2.04,.088],[.09,.11,.006]);instance(unitRounded,solder,[x,-2.01,.101],[.06,.095,.025]);}
  for(const [x,y,w,h]of[[-.19,-.68,.18,.19],[-.19,-1.03,.18,.19],[.25,-2.08,.19,.21]]){
    instance(unitRounded,tealCeramic,[x,y,.139],[w,h,.085]);for(const side of [-1,1])instance(box,solder,[x+side*w*.40,y,.109],[w*.20,h*.88,.039]);
    outlineRect(x,y,w*.56,h*.58,.185,chipTop,.008);chipFootprints.push({x,y,w:w+.08,h:h+.08});
  }

  function passive(x,y,angle=0,size=0,type=0){
    const w=[.075,.096,.123][size%3],h=[.039,.046,.055][size%3],d=[.031,.037,.043][size%3];
    instance(unitPassive,type%4===0?graphite:type%4===1?darkCeramic:dielectric,[x,y,top+.005+d/2],[w,h,d],angle);
    for(const side of [-1,1]){
      const dx=Math.cos(angle)*side*w*.40,dy=Math.sin(angle)*side*w*.40;
      instance(unitRounded,solder,[x+dx,y+dy,top+.005+d/2],[w*.23,h+.006,d+.003],angle);
      instance(box,gold,[x+dx*1.19,y+dy*1.19,top+.001],[w*.33,h+.022,.004],angle);
    }
  }
  // Several deliberately laid-out clusters, with breathing room for routes and connectors.
  const clusters=[
    [-1.24,-.72,1,6,.115,Math.PI/2],[-1.22,-2.23,1,5,.103,Math.PI/2],
    [.03,-1.48,1,5,.108,Math.PI/2],[.31,-1.82,6,1,.122,0],
    [.10,1.07,6,1,.127,0],[.05,.33,1,6,.112,Math.PI/2],
    [1.17,-1.66,1,7,.112,Math.PI/2],[-.43,1.32,5,1,.122,0],
    [-1.24,1.15,4,1,.110,0],[.21,2.74,7,1,.124,0],
    [-.67,-1.16,4,1,.104,0],[.22,-2.46,5,1,.132,0]
  ];
  const busy=(x,y)=>chipFootprints.some(o=>Math.abs(x-o.x)<o.w/2+.045&&Math.abs(y-o.y)<o.h/2+.035)||Math.hypot(x-coilX,y-coilY)<.23;
  let part=0;
  for(const [x,y,nx,ny,spacing,angle]of clusters)for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
    const px=x+i*spacing,py=y+j*spacing;if(px>1.27||py>2.79||busy(px,py))continue;passive(px,py,angle,part%3,part++);
  }
  for(const [x,y,a,s,t]of[[-.29,-.17,0,2,2],[-.51,-.08,Math.PI/2,0,0],[-.92,-.06,0,1,3],[.82,-.51,0,0,2],[1.08,-.32,Math.PI/2,1,1],[1.12,.09,Math.PI/2,1,2],[-.54,-2.21,0,0,0],[-.27,-2.26,0,1,2],[.72,1.25,0,0,2]])passive(x,y,a,s,t);
  const capacitors=[[-.05,-.28,.046,.075],[1.16,-1.03,.051,.095],[-1.16,-2.01,.045,.085],[.34,1.21,.043,.080]];
  for(const [x,y,r,h]of capacitors){instance(cylinder(r,h,16),darkCeramic,[x,y,top+h/2+.004]);instance(cylinder(r*.94,.006,16),nickel,[x,y,top+h+.009]);instance(box,solder,[x,y,top+.002],[r*1.9,r*1.8,.008]);bar([x-r*.65,y],[x+r*.65,y],.008,top+h+.014,graphite,.003);}

  // Flat fine traces and staggered vias express the actual scale without luminous decoration.
  const traces=[
    [[-.18,-2.71],[-.18,-2.42],[-.35,-2.25],[-.35,-.94],[-.45,-.76]],
    [[-.27,-.51],[-.12,-.51],[.16,-.23],[.47,-.23],[.47,-.09]],
    [[.95,.65],[1.18,.65],[1.25,.72],[1.25,1.61],[1.15,1.71]],
    [[.91,-1.64],[1.25,-1.64],[1.25,-2.40],[.99,-2.66]],
    [[-.39,1.52],[-.09,1.52],[.11,1.32],[.11,1.14]],
    [[-.65,1.28],[-.65,1.13],[-.26,.74],[-.26,.39]],
    [[.87,-.60],[1.05,-.60],[1.22,-.43],[1.22,.31]]
  ];
  traces.forEach(points=>path(points,.012,top+.003,copper,.004));
  for(let lane=0;lane<6;lane++){
    const offset=lane*.028;
    path([[.08+offset,-.15],[.08+offset,-.43],[.25+offset,-.60],[.25+offset,-.65]],.009,top+.003,copper,.003);
    path([[-1.22+offset,.15],[-1.22+offset,-.20],[-1.05+offset,-.37]],.008,top+.003,copper,.003);
  }
  // Authored fan-outs visibly join lead pads to local vias, connectors and power zones.
  for(let lane=0;lane<7;lane++){
    const py=.43+(lane/6-.5)*.66,px=1.075+lane*.018;
    path([[.965,py],[px,py],[px+.065,py-.065],[px+.065,-.37+lane*.035]],.010,top+.003,copper,.003);
    fanoutVia(px+.065,-.37+lane*.035,.020);
  }
  for(let lane=0;lane<6;lane++){
    const px=.47+(lane/5-.5)*.60,turnY=-.17-lane*.027;
    path([[px,-.105],[px,turnY],[px-.12,turnY-.12],[.07-lane*.025,turnY-.12]],.010,top+.003,copper,.003);
    fanoutVia(.07-lane*.025,turnY-.12,.018);
  }
  for(let lane=0;lane<5;lane++){
    const px=.69+(lane/4-.5)*.42,py=-1.60-lane*.029;
    path([[px,-1.485],[px,py],[px+.11,py-.11],[1.12,py-.11]],.010,top+.003,copper,.003);
    instance(box,gold,[1.13,py-.11,top+.003],[.055,.032,.007]);
  }
  const powerBranches=[
    [[-.99,-1.59],[-1.08,-1.49],[-1.08,-1.11],[-1.04,-.93]],
    [[-.65,-1.59],[-.49,-1.43],[-.49,-1.08],[-.60,-.97]],
    [[-.31,-.68],[-.07,-.68],[.05,-.80],[.05,-1.04]],
    [[-.31,-1.03],[-.06,-1.03],[.06,-1.15],[.23,-1.15]]
  ];
  powerBranches.forEach(points=>{path(points,.014,top+.003,copper,.004);const [x,y]=points.at(-1);instance(cylinder(.024,.005,12),gold,[x,y,top+.003]);});
  for(let i=0;i<38;i++){
    const side=i%2?-1:1,x=side*(1.20+(i%3)*.035),y=-2.38+Math.floor(i/2)*.259;
    if(busy(x,y))continue;instance(annulus(.014,.004,12),gold,[x,y,top+.002]);
  }
  // Gold test lands are grouped near the connector, not sprinkled across the hero.
  for(let i=0;i<9;i++)instance(cylinder(.027,.004,14),gold,[-.30+i*.075,-2.46,top+.002]);

  function connector(name,x,y,w,h,pins=12,angle=0){
    const group=new THREE.Group();group.name=name;group.position.set(x,y,0);group.rotation.z=angle;root.add(group);
    mesh(`${name} body`,plate(w,h,.057,.022,.003),connectorPlastic,[0,0,.124],group);
    mesh(`${name} latch`,plate(w*.94,h*.37,.022,.012,.002),nickel,[0,h*.24,.160],group);
    for(let i=0;i<pins;i++){
      const px=(i/(pins-1)-.5)*(w-.065),py=-h*.24;
      instance(box,gold,[x+px*Math.cos(angle)-py*Math.sin(angle),y+px*Math.sin(angle)+py*Math.cos(angle),.157],[.018,h*.32,.012],angle);
    }
    return group;
  }
  connector('Display FPC connector',.30,-1.98,.54,.16,15);
  connector('Battery service connector',-.67,-1.29,.46,.15,10);
  connector('Camera flex connector',-.48,1.18,.48,.14,13);
  // Bent polyimide tab with individually exposed contact fingers, no bitmap labels.
  const flexShape=polygon([[-.26,-.11],[.26,-.11],[.26,.11],[.19,.11],[.19,.33],[-.15,.33],[-.15,.19],[-.26,.19]]);
  mesh('Folded polyimide tail',extrusion(flexShape,.009,.001),flexMaterial,[.31,-2.13,.107]);
  for(let i=0;i<9;i++)instance(box,gold,[.19+i*.029,-1.86,.115],[.017,.10,.007]);

  // The port is a board-mounted connector, not an entire phone chassis.
  const usbShell=rounded(.65,.29,.080);slot(usbShell,0,0,.54,.19,.055);
  const usbGeometry=extrusion(usbShell,.31,.006);usbGeometry.rotateX(Math.PI/2);
  mesh('USB-C nickel socket',usbGeometry,nickel,[0,-2.71,.165]);
  mesh('USB-C insulator',plate(.45,.20,.022,.015,.003),connectorPlastic,[0,-2.74,.157]);
  for(let i=0;i<12;i++)instance(box,gold,[-.185+i*.0336,-2.77,.173],[.015,.17,.008]);
  for(const x of [-.37,.37])instance(unitRounded,solder,[x,-2.71,.104],[.10,.25,.040]);

  // A coax cable follows the clear board-edge corridor and lands on the real sockets.
  const coaxCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.13,-1.42,.135),new THREE.Vector3(-1.35,-1.25,.132),new THREE.Vector3(-1.37,-.65,.126),new THREE.Vector3(-1.37,.24,.126),new THREE.Vector3(-1.25,.43,.145),new THREE.Vector3(-1.25,.96,.180),new THREE.Vector3(-1.11,1.15,.180),new THREE.Vector3(-.77,1.30,.180),new THREE.Vector3(.07,1.30,.180),new THREE.Vector3(.07,2.66,.135)]);
  mesh('Shielded coax interconnect',own(new THREE.TubeGeometry(coaxCurve,64,.012,6,false)),connectorPlastic,[0,0,0],root,false);

  // Local contact occlusion grounds the components without a full-screen AO pass.
  // A single soft footprint texture and one merged mesh are shared by all large parts.
  const aoSize=256,aoPixels=new Uint8Array(aoSize*aoSize*4);
  for(let y=0;y<aoSize;y++)for(let x=0;x<aoSize;x++){
    const u=(x+.5)/aoSize-.5,v=(y+.5)/aoSize-.5;
    const dx=Math.max(0,Math.abs(u)-.30),dy=Math.max(0,Math.abs(v)-.30),distance2=dx*dx+dy*dy;
    const edge=Math.max(Math.abs(u),Math.abs(v)),t=Math.max(0,Math.min(1,(edge-.46)/.04));
    const alpha=Math.exp(-distance2/.0098)*(1-t*t*(3-2*t));aoPixels[(y*aoSize+x)*4+3]=Math.round(alpha*255);
  }
  const aoTexture=new THREE.DataTexture(aoPixels,aoSize,aoSize,THREE.RGBAFormat);aoTexture.name='Soft component contact footprint';aoTexture.colorSpace=THREE.NoColorSpace;
  aoTexture.magFilter=THREE.LinearFilter;aoTexture.minFilter=THREE.LinearMipmapLinearFilter;aoTexture.generateMipmaps=true;aoTexture.needsUpdate=true;textures.add(aoTexture);
  const aoMaterial=new THREE.MeshBasicMaterial({name:'Local component contact occlusion',color:0x000000,map:aoTexture,transparent:true,opacity:.28,depthWrite:false,toneMapped:false});materials.add(aoMaterial);
  const aoPositions=[],aoNormals=[],aoUv=[],aoIndices=[];
  const aoFootprints=chipFootprints.filter((part,i,all)=>!all.some((other,j)=>i!==j&&other.w>part.w&&other.h>part.h&&Math.abs(part.x-other.x)+part.w/2<other.w/2&&Math.abs(part.y-other.y)+part.h/2<other.h/2));
  aoFootprints.push({x:coilX,y:coilY,w:.36,h:.36});
  for(const {x,y,w,h}of aoFootprints){
    const width=w+.14,height=h+.14,originalLeft=x-width/2,originalBottom=y-height/2;
    // Keep translucent shadows on the continuous supported part of the PCB, not in empty air.
    const left=Math.max(-1.29,originalLeft),right=Math.min(1.29,x+width/2),bottom=Math.max(-2.69,originalBottom),up=Math.min(2.69,y+height/2);
    if(right<=left||up<=bottom)continue;
    const index=aoPositions.length/3,z=top+.002,u0=(left-originalLeft)/width,u1=(right-originalLeft)/width,v0=(bottom-originalBottom)/height,v1=(up-originalBottom)/height;
    aoPositions.push(left,bottom,z,right,bottom,z,right,up,z,left,up,z);aoNormals.push(0,0,1,0,0,1,0,0,1,0,0,1);aoUv.push(u0,v0,u1,v0,u1,v1,u0,v1);aoIndices.push(index,index+1,index+2,index,index+2,index+3);
  }
  const aoGeometry=own(new THREE.BufferGeometry());aoGeometry.setAttribute('position',new THREE.Float32BufferAttribute(aoPositions,3));aoGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(aoNormals,3));aoGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(aoUv,2));aoGeometry.setIndex(aoIndices);
  const contactAo=mesh('Local component contact occlusion',aoGeometry,aoMaterial,[0,0,0],root,false);contactAo.receiveShadow=false;contactAo.renderOrder=-1;

  // One tiny generated material atlas for laser etch and PCB reference designators.
  // These are component positions, not invented brands, model names or specifications.
  // Canvas generation is local and works in the OffscreenCanvas worker as well as the fallback.
  const atlasCanvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(512,512):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(atlasCanvas){
    atlasCanvas.width=atlasCanvas.height=512;const ctx=atlasCanvas.getContext('2d');
    if(ctx){
      ctx.clearRect(0,0,512,512);ctx.textBaseline='middle';
      const entries=[
        {text:'U1',x:0,y:0,color:'#adc4cb',font:28},
        {text:'U3',x:128,y:0,color:'#adc4cb',font:26},
        {text:'U2',x:256,y:0,color:'#98d7dc',font:30},
        {text:'C1',x:0,y:128,color:'#98d7dc',font:30},
        {text:'R1',x:128,y:128,color:'#98d7dc',font:30}
      ];
      entries.forEach(({text,x,y,color,font},i)=>{
        ctx.fillStyle=color;ctx.font=`400 ${font}px monospace`;ctx.fillText(text,x+18,y+49);
        if(i<2){ctx.globalAlpha=.48;ctx.fillRect(x+18,y+76,i===0?60:44,2);ctx.fillRect(x+18,y+84,i===0?37:58,1);ctx.globalAlpha=1;}
      });
      const atlas=new THREE.CanvasTexture(atlasCanvas);atlas.name='Device laser etch and designators';atlas.colorSpace=THREE.SRGBColorSpace;atlas.magFilter=THREE.LinearFilter;atlas.minFilter=THREE.LinearMipmapLinearFilter;atlas.generateMipmaps=true;atlas.anisotropy=4;textures.add(atlas);
      const etchMaterial=material('Laser etch and PCB ink',{map:atlas,color:0xffffff,metalness:0,roughness:.86,transparent:true,opacity:.66,alphaTest:.015,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
      const positions=[],normals=[],uv=[],indices=[];
      const labels=[
        [.435,.490,.2075,.37,.145,0],
        [.670,-1.195,.1795,.28,.110,1],
        [-.62,-1.025,top+.0015,.15,.058,2],
        [-.055,-.430,top+.0015,.12,.051,3],
        [1.12,-1.805,top+.0015,.12,.051,4]
      ];
      for(const [x,y,z,w,h,id]of labels){
        const index=positions.length/3,entry=entries[id],left=entry.x/512,right=(entry.x+128)/512,bottom=1-(entry.y+104)/512,up=1-entry.y/512;
        positions.push(x-w/2,y-h/2,z,x+w/2,y-h/2,z,x+w/2,y+h/2,z,x-w/2,y+h/2,z);normals.push(0,0,1,0,0,1,0,0,1,0,0,1);uv.push(left,bottom,right,bottom,right,up,left,up);indices.push(index,index+1,index+2,index,index+2,index+3);
      }
      const labelGeometry=own(new THREE.BufferGeometry());labelGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));labelGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));labelGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));labelGeometry.setIndex(indices);
      mesh('Subtle laser etch and board designators',labelGeometry,etchMaterial,[0,0,0],root,false);
    }
  }

  // Batch all repeated physical components after authored placements are complete.
  for(const {g,m,items}of batches.values()){
    const object=new THREE.InstancedMesh(g,m,items.length);object.name=`${m.name} instances`;object.castShadow=m!==whiteInk;object.receiveShadow=true;
    items.forEach(({p,s,r},i)=>{dummy.position.set(...p);dummy.rotation.set(0,0,r);dummy.scale.set(...s);dummy.updateMatrix();object.setMatrixAt(i,dummy.matrix);});object.instanceMatrix.needsUpdate=true;root.add(object);
  }
  const signalPaths=[
    [[0,-2.54,.102],[0,-2.37,.102],[-.35,-2.02,.102],[-.35,-.94,.102],[-.51,-.94,.102],[-.64,-.83,.102]],
    [[-.30,-.51,.102],[-.12,-.51,.102],[.16,-.23,.102],[.47,-.23,.102],[.47,-.10,.102]],
    [[.97,.65,.102],[1.18,.65,.102],[1.25,.72,.102],[1.25,1.62,.102],[1.15,1.888,.102],[1.107,1.888,.112]],
    [[.47,-.10,.102],[.47,-.35,.102],[.69,-.57,.102],[.94,-.57,.102],[1.09,-.72,.102],[1.09,-1.10,.102]]
  ].map(path=>path.map(p=>new THREE.Vector3(...p)));
  const focusLocal=new THREE.Vector3(.47,.43,.211),focusPoint=focusLocal.clone();
  function update(){root.updateWorldMatrix(true,false);focusPoint.copy(focusLocal);root.localToWorld(focusPoint);}
  update();return {root,focusPoint,signalPaths,probeContact,update};
}
