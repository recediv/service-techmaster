import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { createDeviceShowcase as createPhoneAssembly } from './device-showcase.mjs';
import { createDevicePlatform as createPhoneLabStage } from './device-platform.mjs';
import { createPhoneReflectionStudio } from './phone-reflection-studio.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Resolve transparent silhouette coverage independently of FXAA's colour tests
// with one symmetric premultiplied-RGBA kernel;
// keep the usual FXAA path for fully opaque details inside the device.
const heroEdgeShader={...FXAAShader,name:'RepairLabCoverageResolve',fragmentShader:FXAAShader.fragmentShader.replace(
  'gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );',
  `vec4 c = Sample( tDiffuse, vUv );
   vec4 n = Sample( tDiffuse, vUv + resolution * vec2( 0.0, 1.0 ) );
   vec4 e = Sample( tDiffuse, vUv + resolution * vec2( 1.0, 0.0 ) );
   vec4 s = Sample( tDiffuse, vUv + resolution * vec2( 0.0, -1.0 ) );
   vec4 w = Sample( tDiffuse, vUv + resolution * vec2( -1.0, 0.0 ) );
   vec4 ne = Sample( tDiffuse, vUv + resolution * vec2( 1.0, 1.0 ) );
   vec4 nw = Sample( tDiffuse, vUv + resolution * vec2( -1.0, 1.0 ) );
   vec4 se = Sample( tDiffuse, vUv + resolution * vec2( 1.0, -1.0 ) );
   vec4 sw = Sample( tDiffuse, vUv + resolution * vec2( -1.0, -1.0 ) );
   float minCoverage = min( min( min( c.a, min( n.a, e.a ) ), min( s.a, w.a ) ), min( min( ne.a, nw.a ), min( se.a, sw.a ) ) );
   if ( minCoverage < 0.9999 ) {
     gl_FragColor = ( c * 4.0 + ( n + e + s + w ) * 2.0 + ne + nw + se + sw ) * 0.0625;
   } else {
     gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );
   }`
)};
let decodedEnvironmentCache=null;
function loadEnvironmentData(url,source){
  if(decodedEnvironmentCache?.url===url)return decodedEnvironmentCache.promise;
  const entry={url,promise:null};
  entry.promise=Promise.resolve(source||fetch(url,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('Studio environment unavailable');return r.arrayBuffer();})).then(buffer=>new HDRLoader().parse(buffer)).catch(error=>{if(decodedEnvironmentCache===entry)decodedEnvironmentCache=null;throw error;});
  decodedEnvironmentCache=entry;return entry.promise;
}
// A real object in a reflection studio; HDR is lighting, never a backdrop image.
export function createRepairLabScene(initialHost,{reducedMotion=false,onReady,onError,onAssetReady,environmentUrl,environmentSource,canvas:providedCanvas,workerMode=false,pixelRatio}={}){
  const constructorStarted=performance.now();
  const startup={rendererSetupMs:0,buildMs:0,composerSetupMs:0,environmentRequestAndParseMs:0,pmremSubmitMs:0,firstFrameSubmitMs:0,constructorToReadyMs:0,compileSubmitMs:0,compileWaitMs:0,maxPrepareTaskMs:0,maxPrepareTaskLabel:'',prepareLongTasks:[],parallelShaderCompile:false,fallbackVariantsPrepared:0,attachToReadyMs:0,totalPreparationYieldMs:0,preparationYieldCount:0,prepareStepCount:0,pbrWarmupMs:0,depthWarmupMs:0,postWarmupMs:0,targetAllocationMs:0,programIntrospectionMs:0};
  let firstFrameSubmitted=false;
  let renderer=null,scene=null,camera=null,observer=null,pmrem=null,environment=null,composer=null,outputPass=null,renderPass=null,fxaa=null;
  let host=null,callbacks={onReady,onError,onAssetReady},attachStarted=constructorStarted,attachId=0,assetNotifiedId=-1;
  let environmentReady=false,preparation=null,prepareTimer=0,prepareDelayResolve=null;
  let prepareChannel=null,prepareTicket=0,prepareSliceStarted=performance.now();
  let sceneTarget=null,postTarget=null,warmTarget=null,warmGeometry=null;
  const preparationWaiters=new Set();
  const introspectedPrograms=new Set();
  let maxColorSamples=0;
  let destroyed=false,failed=false,loaded=false,ready=false,visible=true,shaderFailure=null;
  let frameId=0,lastFrame=0,elapsed=0,width=0,height=0,scroll=0;
  let frameUsesTimer=false,captureBusy=false;
  const lifetime=new AbortController(),geometries=new Set(),materials=new Set(),textures=new Set();
  const pointer=new THREE.Vector2(),pointerTarget=new THREE.Vector2(),zero=new THREE.Vector2(),drawingSize=new THREE.Vector2();
  let pointerActive=false;
  const cameraTarget=new THREE.Vector3(),cameraPosition=new THREE.Vector3(),focusPoint=new THREE.Vector3();
  let phone=null,stage=null,wireframe=null,shadowLight=null,inspectionLight=null;
  const framingPoints=[],projectionPoint=new THREE.Vector3();
  let poseTime=.5,poseView='beauty';

  const api={
    setPointer(x,y,active=true){if(destroyed||reducedMotion)return;pointerTarget.set(clamp(Number(x)||0,-1,1),clamp(Number(y)||0,-1,1));pointerActive=Boolean(active);schedule();},
    setScroll(value){if(destroyed)return;scroll=clamp(Number(value)||0,0,1);if(!reducedMotion)schedule();},
    setVisible(value){if(destroyed)return;visible=Boolean(value);cancelFrame();lastFrame=0;wakePreparation();if(visible){resumePreparation();schedule();}},
    resize,destroy,captureFrame,captureFrameAsync,attach,detach,
    isUsable(){return !destroyed&&!failed&&Boolean(renderer)&&!renderer.getContext().isContextLost();},
    getStats(){
      let meshes=0,instances=0,triangles=0;
      scene?.traverse(object=>{if(!object.isMesh)return;meshes++;const n=object.isInstancedMesh?object.count:1;instances+=n;const g=object.geometry;triangles+=n*(g.index?g.index.count:g.attributes.position.count)/3;});
      return {scene:'diagnostic-workspace',cycleSeconds:14,phoneState:phone?.getState?.(),ready,loaded,meshes,instances,triangles:Math.round(triangles),postprocessing:Boolean(composer),antialiasSamples:sceneTarget?.samples||0,fxaaFallback:Boolean(fxaa?.enabled&&!sceneTarget?.samples),finalEdgeResolve:Boolean(fxaa?.enabled),frameDrawCallsIncludingPasses:renderer?.info.render.calls||0,frameTrianglesIncludingPasses:renderer?.info.render.triangles||0,environment:Boolean(environment),time:poseTime,startup:{...startup}};
    },
  };

  function ownGeometry(geometry){geometries.add(geometry);return geometry;}
  function basic(options){const mat=new THREE.MeshBasicMaterial(options);materials.add(mat);return mat;}
  function listen(node,type,handler,options={}){node.addEventListener(type,handler,{...options,signal:lifetime.signal});}
  function build(){
    const context={THREE,scene,ownGeometry,materials,textures};
    phone=createPhoneAssembly(context);
    stage=createPhoneLabStage({...context,device:phone});
    phone.update(8);
    const framingBox=new THREE.Box3();
    for(const part of phone.root.children){
      if(part===stage.root)continue;
      framingBox.setFromObject(part);
      if(framingBox.isEmpty())continue;
      for(const x of [framingBox.min.x-.035,framingBox.max.x+.035])for(const y of [framingBox.min.y-.035,framingBox.max.y+.035])for(const z of [framingBox.min.z-.035,framingBox.max.z+.035])framingPoints.push(new THREE.Vector3(x,y,z));
    }
    phone.update(.5);
    const sky=new THREE.HemisphereLight(0xf6faff,0x65737d,.28);sky.position.set(0,0,1);scene.add(sky);
    const key=new THREE.DirectionalLight(0xfff8f0,3.2);
    key.position.set(-5.2,-6.8,11);key.target.position.set(0,0,.1);key.castShadow=true;
    // Keep the broad ground-shadow filter; changing it to PCFSoft in temporal
    // A/B did not resolve component shimmer and narrowed the ground penumbra.
    key.shadow.mapSize.set(2048,2048);key.shadow.radius=4;key.shadow.bias=-.0001;key.shadow.normalBias=.009;
    Object.assign(key.shadow.camera,{left:-5,right:5,top:6,bottom:-6,near:1,far:30});key.shadow.camera.updateProjectionMatrix();key.shadow.autoUpdate=false;
    scene.add(key,key.target);shadowLight=key;
    const fill=new THREE.DirectionalLight(0xe0efff,.35);fill.position.set(8,-3,5);scene.add(fill);
    const rim=new THREE.DirectionalLight(0xf0f8ff,1.2);rim.position.set(-1,8,7);scene.add(rim);
    inspectionLight=new THREE.SpotLight(0xff4528,0,3,.9,.35,2);scene.add(inspectionLight,inspectionLight.target);
    wireframe=basic({color:0x255f71,wireframe:true,toneMapped:false});
  }
  function updateCamera(view='beauty',w=width,h=height){
    const mobile=w<=730;camera.aspect=w/Math.max(1,h);
    cameraTarget.set(0,0,.30);camera.fov=mobile?40:28;
    if(view==='side'){cameraPosition.set(10.5,-11.0,6.5);cameraTarget.set(0,0,1.6);camera.fov=32;}
    else if(mobile)cameraPosition.set(8.0,-14.0,14.3);
    else cameraPosition.set(7.4,-13.0,10.8);
    if(view!=='side'&&!reducedMotion){
      cameraPosition.x+=pointer.x*.32;
      cameraPosition.y+=pointer.y*.23;
      cameraPosition.z+=scroll*.22;
    }
    camera.position.copy(cameraPosition);camera.lookAt(cameraTarget);camera.updateMatrixWorld();camera.updateProjectionMatrix();
    if(view!=='side'){
      const rect=mobile?{left:-.06,right:1.08,top:.16,bottom:.80}:{left:.30,right:1.10,top:.11,bottom:.81};
      const bounds=()=>{
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
        for(const point of framingPoints){projectionPoint.copy(point).project(camera);minX=Math.min(minX,projectionPoint.x);maxX=Math.max(maxX,projectionPoint.x);minY=Math.min(minY,projectionPoint.y);maxY=Math.max(maxY,projectionPoint.y);}
        return {minX,maxX,minY,maxY};
      };
      let projected=bounds();
      const fit=Math.min(2*(rect.right-rect.left)/Math.max(.001,projected.maxX-projected.minX),2*(rect.bottom-rect.top)/Math.max(.001,projected.maxY-projected.minY));
      if(Number.isFinite(fit)&&fit>0){camera.fov=clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/fit)),18,70);camera.updateProjectionMatrix();projected=bounds();}
      camera.projectionMatrix.elements[8]=(projected.minX+projected.maxX)/2-(rect.left+rect.right-1);
      camera.projectionMatrix.elements[9]=(projected.minY+projected.maxY)/2-(1-rect.top-rect.bottom);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    camera.updateMatrixWorld();
  }
  function updatePose(time,view='beauty'){
    if(!phone)return;poseTime=time;poseView=view;
    phone.update(time);stage?.update?.(time);
    if(phone.focusPoint)focusPoint.copy(phone.focusPoint);else focusPoint.set(0,0,1.3);
    if(inspectionLight){inspectionLight.intensity=5.5*(phone.getInspection?.()||0);inspectionLight.target.position.copy(focusPoint);inspectionLight.position.set(focusPoint.x+.4,focusPoint.y-.5,focusPoint.z+.9);}
    updateCamera(view);
  }
  function isHidden(){return !workerMode&&typeof document!=='undefined'&&document.hidden;}
  function canPrepare(){return !destroyed&&!failed&&!captureBusy&&Boolean(renderer&&host)&&visible&&!isHidden()&&width>0&&height>0;}
  function wakePreparation(){
    prepareTicket++;
    if(prepareTimer){clearTimeout(prepareTimer);prepareTimer=0;}
    const resolve=prepareDelayResolve;prepareDelayResolve=null;resolve?.();
    for(const resolve of preparationWaiters)resolve();preparationWaiters.clear();
  }
  async function waitForActive(){
    let suspended=false;
    while(!canPrepare()){if(destroyed||failed)throw new Error('Repair lab preparation cancelled.');suspended=true;await new Promise(resolve=>preparationWaiters.add(resolve));}
    if(suspended)prepareSliceStarted=performance.now();
  }
  async function yieldPreparation(delay=0,force=false){
    if(destroyed||failed)throw new Error('Repair lab preparation cancelled.');
    await waitForActive();
    if(!delay&&!force&&performance.now()-prepareSliceStarted<5)return;
    const started=performance.now();startup.preparationYieldCount++;
    await new Promise(resolve=>{
      prepareDelayResolve=resolve;
      if(delay||typeof MessageChannel==='undefined'){prepareTimer=setTimeout(()=>{prepareTimer=0;prepareDelayResolve=null;resolve();},delay);return;}
      if(!prepareChannel){prepareChannel=new MessageChannel();prepareChannel.port1.onmessage=event=>{if(event.data!==prepareTicket||!prepareDelayResolve)return;const ownResolve=prepareDelayResolve;prepareDelayResolve=null;ownResolve();};}
      prepareChannel.port2.postMessage(++prepareTicket);
    });
    startup.totalPreparationYieldMs+=performance.now()-started;prepareSliceStarted=performance.now();
    await waitForActive();
  }
  function prepareTask(action,label='prepare'){
    startup.prepareStepCount++;const started=performance.now();
    try{return action();}finally{const ms=performance.now()-started;if(ms>startup.maxPrepareTaskMs){startup.maxPrepareTaskMs=ms;startup.maxPrepareTaskLabel=label;}if(ms>=50&&startup.prepareLongTasks.length<12)startup.prepareLongTasks.push({label,ms});}
  }
  function notifyAsset(){if(host&&environmentReady&&assetNotifiedId!==attachId){assetNotifiedId=attachId;try{callbacks.onAssetReady?.();}catch{}}}
  function attach(nextHost,options={}){
    if(!api.isUsable()||!nextHost?.getBoundingClientRect||(!workerMode&&!nextHost.appendChild))return false;
    detach();host=nextHost;callbacks={onReady:options.onReady,onError:options.onError,onAssetReady:options.onAssetReady};attachId++;assetNotifiedId=-1;attachStarted=performance.now();
    visible=true;ready=false;elapsed=0;lastFrame=0;scroll=0;pointer.set(0,0);pointerTarget.set(0,0);pointerActive=false;width=height=0;
    if(!workerMode)host.appendChild(renderer.domElement);observer?.observe(host);resize();updatePose(reducedMotion?8.0:.5);wakePreparation();resumePreparation();schedule();return true;
  }
  function detach(){
    cancelFrame();visible=false;ready=false;lastFrame=0;width=height=0;observer?.disconnect();renderer?.domElement.remove?.();host=null;callbacks={};wakePreparation();
  }
  function proxyMesh(object,mat=object.material){
    const proxy=new THREE.Mesh(object.geometry,mat);
    if(object.isInstancedMesh){proxy.isInstancedMesh=true;proxy.instanceMatrix=object.instanceMatrix;proxy.instanceColor=object.instanceColor;proxy.morphTexture=object.morphTexture;}
    return proxy;
  }
  async function submitCompile(objects,targetScene,target=warmTarget,label='compile'){
    const batchSize=startup.parallelShaderCompile?6:1;
    for(let offset=0;offset<objects.length;offset+=batchSize){
      await waitForActive();const group=new THREE.Group();for(const object of objects.slice(offset,offset+batchSize))group.add(object);
      const previousTarget=renderer.getRenderTarget(),started=performance.now();
      try{prepareTask(()=>{renderer.setRenderTarget(target);renderer.compile(group,camera,targetScene);},label);}
      finally{renderer.setRenderTarget(previousTarget);startup.compileSubmitMs+=performance.now()-started;group.clear();}
      let fallbackPrepared=false;
      if(!startup.parallelShaderCompile){
        // Without KHR, isReady() is immediately true. Do not queue every shader
        // before a status/uniform query: drivers can synchronize that entire queue.
        for(const program of renderer.info.programs){
          if(introspectedPrograms.has(program))continue;
          await waitForActive();const introspectionStarted=performance.now();
          prepareTask(()=>{program.getUniforms();program.getAttributes();},`introspect:${program.name||program.type}:${program.id}`);
          startup.programIntrospectionMs+=performance.now()-introspectionStarted;introspectedPrograms.add(program);startup.fallbackVariantsPrepared++;fallbackPrepared=true;
          if(shaderFailure)throw shaderFailure;
          await yieldPreparation(0,true);
        }
      }
      if(!fallbackPrepared)await yieldPreparation();
    }
  }
  async function warmShaders(){
    warmTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    warmGeometry=ownGeometry(new THREE.PlaneGeometry(2,2));
    // Allocate targets before queuing shader work to avoid mixing allocations
    // with pending driver compilation. Per-task timings identify any actual stall.
    const targets=[warmTarget,sceneTarget,postTarget];
    for(const target of targets){await waitForActive();const started=performance.now();prepareTask(()=>renderer.initRenderTarget(target),`target:${target.texture.name||target===warmTarget&&'warm'||'depth'}`);startup.targetAllocationMs+=performance.now()-started;await yieldPreparation();}
    const objects=[];scene.traverse(object=>{if(object.isMesh)objects.push(object);});
    let stageStarted=performance.now();
    await submitCompile(objects.map(object=>proxyMesh(object)),scene,warmTarget,'compile:PBR');
    startup.pbrWarmupMs=performance.now()-stageStarted;stageStarted=performance.now();
    const shadowDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.BackSide});materials.add(shadowDepth);
    await submitCompile(objects.filter(object=>object.castShadow).map(object=>proxyMesh(object,shadowDepth)),scene,warmTarget,'compile:shadow');
    startup.depthWarmupMs=performance.now()-stageStarted;stageStarted=performance.now();
    // OutputPass configures these exact defines on its first render (r180, fixed ACES/sRGB).
    outputPass.material.defines={SRGB_TRANSFER:'',ACES_FILMIC_TONE_MAPPING:''};outputPass.material.needsUpdate=true;
    const postScene=new THREE.Scene();
    const postMaterials=[outputPass.material];
    await submitCompile(postMaterials.map(mat=>new THREE.Mesh(warmGeometry,mat)),postScene,warmTarget,'compile:post');
    if(fxaa.enabled)await submitCompile([new THREE.Mesh(warmGeometry,fxaa.material)],postScene,null,'compile:FXAA');
    startup.postWarmupMs=performance.now()-stageStarted;
    const waitingStarted=performance.now(),programs=[...renderer.info.programs];
    while(true){
      await waitForActive();const pending=prepareTask(()=>programs.some(program=>!program.isReady()),'poll:programs');if(!pending)break;await yieldPreparation(12);
    }
    startup.compileWaitMs+=performance.now()-waitingStarted;
    // Ready programs still need uniform/attribute introspection; one program per task also
    // bounds first-use stalls on drivers without KHR_parallel_shader_compile.
    for(const program of programs){if(introspectedPrograms.has(program))continue;await waitForActive();const started=performance.now();prepareTask(()=>{program.getUniforms();program.getAttributes();},`introspect:${program.name||program.type}:${program.id}`);startup.programIntrospectionMs+=performance.now()-started;introspectedPrograms.add(program);await yieldPreparation();}
    warmTarget.dispose();warmTarget=null;
  }
  function resumePreparation(){
    if(destroyed||failed||!host)return;
    if(loaded){queueMicrotask(()=>{if(host&&!destroyed){notifyAsset();schedule();}});return;}
    if(preparation){wakePreparation();return;}
    preparation=(async()=>{
      await waitForActive();
      let studio=null,environmentData=null;
      if(environmentUrl||environmentSource){const started=performance.now();try{environmentData=await loadEnvironmentData(environmentUrl,environmentSource);}catch{}startup.environmentRequestAndParseMs=performance.now()-started;await waitForActive();}
      try{
        pmrem=new THREE.PMREMGenerator(renderer);
        const started=performance.now();
        if(environmentData){
          const source=new THREE.DataTexture(environmentData.data,environmentData.width,environmentData.height,THREE.RGBAFormat,environmentData.type);source.mapping=THREE.EquirectangularReflectionMapping;source.colorSpace=THREE.LinearSRGBColorSpace;source.minFilter=THREE.LinearFilter;source.magFilter=THREE.LinearFilter;source.flipY=true;source.needsUpdate=true;
          try{environment=prepareTask(()=>pmrem.fromEquirectangular(source),'render:HDR-studio');}finally{source.dispose();}
        }else{studio=createPhoneReflectionStudio(THREE);environment=prepareTask(()=>pmrem.fromScene(studio.scene,.08,.1,100),'render:reflection-studio');}
        startup.pmremSubmitMs=performance.now()-started;
        scene.environment=environment.texture;
        // Three r180 uses scene.environmentIntensity for implicit environment maps.
        // Explicit maps keep the intended per-material reflection balance.
        for(const surface of materials){if(surface.isMeshStandardMaterial){surface.envMap=environment.texture;if(environmentData)surface.envMapRotation.set(Math.PI/2,0,.28);surface.needsUpdate=true;}}
      }finally{studio?.dispose();pmrem?.dispose();pmrem=null;}
      environmentReady=true;notifyAsset();await yieldPreparation();await warmShaders();await waitForActive();if(shaderFailure)throw shaderFailure;loaded=true;schedule();
    })().catch(error=>{if(!destroyed&&!failed)fail(error);});
  }
  function cancelFrame(){if(frameUsesTimer)clearTimeout(frameId);else if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(frameId);frameId=0;}
  function schedule(){
    if(!loaded||!canPrepare()||frameId)return;
    if(typeof requestAnimationFrame==='function'){try{frameUsesTimer=false;frameId=requestAnimationFrame(draw);return;}catch{}}
    frameUsesTimer=true;frameId=setTimeout(()=>draw(performance.now()),16);
  }
  function samplesFor(){return maxColorSamples>=2?Math.min(4,maxColorSamples):0;}
  function configureAntialiasing(){
    if(!composer)return;const samples=samplesFor();
    if(sceneTarget.samples!==samples){sceneTarget.samples=samples;sceneTarget.dispose();}
    // Post effects and subpixel emissive traces need a final edge resolve too.
    if(fxaa){renderer.getDrawingBufferSize(drawingSize);fxaa.enabled=true;fxaa.uniforms.resolution.value.set(1/Math.max(1,drawingSize.x),1/Math.max(1,drawingSize.y));}
  }
  function resize(){
    if(destroyed||!renderer||!host)return;const rect=host.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);
    if(w<1||h<1){width=height=0;cancelFrame();wakePreparation();return;}
    // Resolve fine moving leads/traces at an integer 2x scale, including DPR2
    // screens; 1.5x left these opaque details undersampled. The loop stays 30fps.
    const ratio=2;
    if(width!==w||height!==h||renderer.getPixelRatio()!==ratio){width=w;height=h;renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);composer?.setPixelRatio(ratio);composer?.setSize(w,h);configureAntialiasing(w,h);updateCamera();wakePreparation();schedule();}
  }
  function renderScene(){const started=firstFrameSubmitted?0:performance.now();renderer.info.reset();renderer.shadowMap.needsUpdate=true;if(shadowLight)shadowLight.shadow.needsUpdate=true;if(composer&&poseView!=='wireframe'){composer.readBuffer=sceneTarget;composer.writeBuffer=postTarget;composer.render(0);}else renderer.render(scene,camera);if(!firstFrameSubmitted){firstFrameSubmitted=true;startup.firstFrameSubmitMs=performance.now()-started;}}
  function draw(now){
    frameId=0;if(!loaded||!canPrepare())return;
    if(!reducedMotion&&lastFrame&&now-lastFrame<1000/30){schedule();return;}
    const dt=lastFrame?Math.min(.075,(now-lastFrame)/1000):1/30;lastFrame=now;if(!reducedMotion)elapsed+=dt;
    pointer.lerp(pointerActive?pointerTarget:zero,1-Math.exp(-dt*4));
    updatePose(reducedMotion?8.0:elapsed+.5);
    try{renderScene();if(shaderFailure){fail(shaderFailure);return;}if(!ready&&!destroyed&&host){ready=true;if(!startup.constructorToReadyMs)startup.constructorToReadyMs=performance.now()-constructorStarted;startup.attachToReadyMs=performance.now()-attachStarted;callbacks.onReady?.();}}
    catch(error){fail(error);return;}
    if(!reducedMotion)schedule();
  }
  function beginCapture(options){
    if(!loaded||!canPrepare())return null;
    const saved={width,height,ratio:renderer.getPixelRatio(),time:poseTime,view:poseView,override:scene.overrideMaterial,pointer:pointer.clone(),renderer,attachId};
    const exportWidth=clamp(Math.round(Number(options.width)||width),32,4096),exportHeight=clamp(Math.round(Number(options.height)||height),32,4096),exportRatio=clamp(Number(options.pixelRatio)||1,1,2);
    const time=Number.isFinite(options.time)?Number(options.time):poseTime,view=options.view==='side'?'side':options.view==='wireframe'?'wireframe':'beauty';
    captureBusy=true;cancelFrame();lastFrame=0;
    try{
      width=exportWidth;height=exportHeight;renderer.setPixelRatio(exportRatio);renderer.setSize(width,height,false);composer?.setPixelRatio(exportRatio);composer?.setSize(width,height);configureAntialiasing(width,height);pointer.set(0,0);updatePose(time,view);scene.overrideMaterial=view==='wireframe'?wireframe:null;
      renderScene();
      return saved;
    }catch{finishCapture(saved);return null;}
  }
  function finishCapture(saved){
    captureBusy=false;lastFrame=0;
    if(destroyed||!renderer||saved.renderer!==renderer)return;
    if(scene)scene.overrideMaterial=saved.override;
    if(saved.attachId===attachId){
      try{
        renderer.setPixelRatio(saved.ratio);renderer.setSize(saved.width,saved.height,false);composer?.setPixelRatio(saved.ratio);composer?.setSize(saved.width,saved.height);configureAntialiasing(saved.width,saved.height);
        if(host){width=saved.width;height=saved.height;pointer.copy(saved.pointer);updatePose(saved.time,saved.view);resize();if(visible&&!isHidden())renderScene();}
        else width=height=0;
      }catch{}
    }
    else resize();
    wakePreparation();schedule();
  }
  function captureFrame(options={}){
    if(typeof renderer?.domElement.toDataURL!=='function')return null;
    const saved=beginCapture(options);if(!saved)return null;
    try{return !shaderFailure?renderer.domElement.toDataURL('image/png'):null;}catch{return null;}finally{finishCapture(saved);}
  }
  async function captureFrameAsync(options={}){
    if(typeof renderer?.domElement.convertToBlob!=='function')return captureFrame(options);
    const saved=beginCapture(options);if(!saved)return null;
    try{
      const blob=await saved.renderer.domElement.convertToBlob({type:'image/png'});
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
      for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
      return !destroyed&&host&&saved.attachId===attachId&&!shaderFailure?`data:image/png;base64,${btoa(binary)}`:null;
    }catch{return null;}finally{finishCapture(saved);}
  }
  function fail(error){if(failed||destroyed)return;const callback=callbacks.onError;failed=true;destroy();try{callback?.(error instanceof Error?error:new Error(String(error)));}catch{}}
  function destroy(){
    if(destroyed)return;destroyed=true;detach();lifetime.abort();prepareChannel?.port1.close();prepareChannel?.port2.close();prepareChannel=null;introspectedPrograms.clear();
    shadowLight?.shadow.dispose();scene?.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();geometries.clear();materials.clear();textures.clear();environment?.dispose();pmrem?.dispose();warmTarget?.dispose();outputPass?.dispose();fxaa?.dispose();renderPass?.dispose();composer?.dispose();
    phone=stage=shadowLight=inspectionLight=null;framingPoints.length=0;
    if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove?.();renderer=null;}
  }
  try{
    if(!initialHost?.getBoundingClientRect||(!workerMode&&(!initialHost.appendChild||typeof window==='undefined'))||(workerMode&&!providedCanvas?.getContext))throw new Error('Repair lab scene needs a canvas and sized host.');
    const rendererStarted=performance.now();
    renderer=new THREE.WebGLRenderer({canvas:providedCanvas,alpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
    renderer.setClearColor(0xf5f8f8,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
    renderer.info.autoReset=false;
    startup.parallelShaderCompile=renderer.extensions.has('KHR_parallel_shader_compile');
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
    try{const gl=renderer.getContext(),counts=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES);maxColorSamples=Math.min(renderer.capabilities.maxSamples,Math.max(0,...Array.from(counts||[])));}catch{maxColorSamples=0;}
    renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{shaderFailure=new Error(`Repair lab shader: ${String(gl.getProgramInfoLog(program)||gl.getShaderInfoLog(vertex)||gl.getShaderInfoLog(fragment)||'compilation failed').slice(0,350)}`);};
    const canvas=renderer.domElement;if(!workerMode){canvas.setAttribute('aria-hidden','true');canvas.tabIndex=-1;canvas.style.cssText='display:block;width:100%;height:100%;pointer-events:none;';}
    listen(canvas,'webglcontextlost',event=>{event.preventDefault();fail(new Error('Repair lab graphics context lost.'));});
    scene=new THREE.Scene();scene.environmentIntensity=1;scene.environmentRotation.set(0,0,0);scene.fog=new THREE.Fog(0xf5f8f8,34,70);
    camera=new THREE.PerspectiveCamera(31,1,.05,70);camera.up.set(0,0,1);startup.rendererSetupMs=performance.now()-rendererStarted;
    const buildStarted=performance.now();build();updatePose(.5);startup.buildMs=performance.now()-buildStarted;
    const composerStarted=performance.now();
    postTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:0,depthBuffer:false});postTarget.texture.name='RepairLab.linear-post';
    composer=new EffectComposer(renderer,postTarget);sceneTarget=composer.renderTarget2;sceneTarget.texture.name='RepairLab.linear-scene-MSAA';sceneTarget.depthBuffer=true;sceneTarget.resolveDepthBuffer=false;
    renderPass=new RenderPass(scene,camera);
    outputPass=new OutputPass();
    // MSAA coverage is premultiplied. Tone mapping and sRGB must operate on
    // the covered surface colour, then restore coverage for browser compositing.
    // Otherwise partial pixels become brighter than their alpha at curved edges.
    outputPass.material.fragmentShader=outputPass.material.fragmentShader
      .replace('// tone mapping','gl_FragColor.rgb = gl_FragColor.a > 0.000001 ? gl_FragColor.rgb / gl_FragColor.a : vec3( 0.0 );\n\n\t\t\t// tone mapping')
      .replace(/\n\s*}\s*$/, '\n\t\t\tgl_FragColor.rgb *= gl_FragColor.a;\n\t\t}');
    fxaa=new ShaderPass(heroEdgeShader);fxaa.material.toneMapped=false;fxaa.enabled=true;
    composer.addPass(renderPass);composer.addPass(outputPass);composer.addPass(fxaa);
    if(!workerMode){listen(document,'visibilitychange',()=>{cancelFrame();lastFrame=0;wakePreparation();if(!document.hidden){resumePreparation();schedule();}});listen(window,'resize',resize,{passive:true});if(typeof ResizeObserver==='function')observer=new ResizeObserver(resize);}
    attach(initialHost,{onReady,onError,onAssetReady});startup.composerSetupMs=performance.now()-composerStarted;
  }catch(error){fail(error);}
  return api;
}
