import { DEFAULTS, imagePoints, archPoints, parsePLY, validateProject } from './core.js';
import { PointRenderer } from './renderer.js';
import { EFFECTS, emptyTimeline, snapTime, atKey, evaluateScene, putKey, removeKey, moveKey, motionAtTime, isDiscrete } from './timeline.js';
import { LiveCamera } from './live-camera.js';
import { ROTATION_KEYS } from './settings.js';
const $=id=>document.getElementById(id);
const canvas=$('canvas');let renderer;
const initialCamera=()=>({yaw:-.22,pitch:.07,distance:3.15,panX:0,panY:0});
let settings={...DEFAULTS},camera=initialCamera(),source={kind:'demo',name:'Generated arch'},raster=null,depthRaster=null,depthData=null,basePoints=null,points=null;
let time=0,playing=false,dirty=true,last=performance.now(),loadVersion=0,contextLost=false,recording=null,recordStarted=0;
let timeline=emptyTimeline(),selectedEffect=null,lastSampling=null,loopPreview=false,recordStopping=false,lockedControls=[];
let audio=null,audioURL=null,audioContext=null,analyser=null,audioSource=null,audioBins=null,energy=0;
const webcam=new LiveCamera({onEnded:()=>{stopWebcam(false);message('Camera disconnected. The last frame is retained; choose a camera and start again.',true);}});
let webcamCanvas=null,lastWebcamSample=-Infinity,lastVideoTime=-1;
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function report(error){console.error(error);message(error.message||String(error),true);}
function sceneAtTime(){const scene=evaluateScene(settings,camera,timeline,time),motion=motionAtTime(settings,timeline,time);scene.camera.yaw+=motion.orbit*.12;scene.phase=motion.phase;return scene;}
function syncControls(){const values=sceneAtTime().settings;for(const key of Object.keys(DEFAULTS)){const el=$(key);if(el.type==='checkbox')el.checked=values[key];else el.value=values[key];if(el.type==='range')el.parentElement.querySelector('output').textContent=Number(values[key]).toFixed(key==='echoes'?0:ROTATION_KEYS.includes(key)?1:2)+(EFFECTS[key]?.unit??'');const angle=$('angle-'+key);if(angle&&document.activeElement!==angle)angle.value=values[key].toFixed(1);const button=$('key-'+key);if(button){const keyed=!!atKey(timeline.tracks[key],time);button.textContent=keyed?'◆':'◇';button.classList.toggle('animated',!!timeline.tracks[key]);button.setAttribute('aria-pressed',String(keyed));button.title=`${keyed?'Delete':'Add'} ${EFFECTS[key].label} keyframe at ${time.toFixed(2)} s`;}}dirty=true;}
function updatePlayhead(){
 $('scrub').max=timeline.duration;$('scrub').value=time;$('playhead').max=timeline.duration;
 if(document.activeElement!==$('playhead'))$('playhead').value=time.toFixed(2);
 $('clock').textContent=`${Math.floor(time/60)}:${(time%60).toFixed(2).padStart(5,'0')}`;
 $('tracks').style.setProperty('--playhead',`${time/timeline.duration*100}%`);
}
function refreshKeyEditor(force=false){
 const key=selectedEffect?atKey(timeline.tracks[selectedEffect],time):null;
 $('selected-key').textContent=selectedEffect?`${EFFECTS[selectedEffect].label}${key?' key':' / between keys'}`:'Select a keyframe';
 $('key-time').disabled=!key;$('key-time').max=timeline.duration;if(force||document.activeElement!==$('key-time'))$('key-time').value=key?key.time.toFixed(5):'';
 $('easing').disabled=!key||isDiscrete(selectedEffect);$('easing').value=key?.easing??'linear';
 $('delete-key').disabled=!key;$('clear-track').disabled=!timeline.tracks[selectedEffect];
}
function renderTimeline(){
 $('duration').value=timeline.duration;$('timeline-ruler').replaceChildren();
 for(let i=0;i<=4;i++){const mark=document.createElement('span');mark.textContent=`${(timeline.duration*i/4).toFixed(1)} s`;$('timeline-ruler').append(mark);}
 const tracks=$('tracks');tracks.replaceChildren();
 for(const [name,keys] of Object.entries(timeline.tracks)){
  const row=document.createElement('div');row.className='track-row';row.classList.toggle('selected',selectedEffect===name);row.dataset.track=name;
  const label=document.createElement('button');label.className='track-label';label.textContent=EFFECTS[name].label;label.onclick=()=>{if(recording)return;selectedEffect=name;renderTimeline();};
  const rail=document.createElement('div');rail.className='track-rail';rail.setAttribute('aria-label',`${EFFECTS[name].label} keyframes`);
  rail.onclick=e=>{if(recording||e.target!==rail)return;selectedEffect=name;const r=rail.getBoundingClientRect();seek((e.clientX-r.left)/r.width*timeline.duration);};
  for(const key of keys){const dot=document.createElement('button');dot.className='key-dot';dot.textContent='◆';dot.style.left=`${key.time/timeline.duration*100}%`;dot.title=`${EFFECTS[name].label}, ${key.time.toFixed(2)} s, ${key.value}`;dot.setAttribute('aria-label',dot.title);dot.dataset.time=key.time;dot.onclick=()=>{if(recording)return;selectedEffect=name;seek(key.time);};rail.append(dot);}
  row.append(label,rail);tracks.append(row);
 }
 if(!tracks.childElementCount){const hint=document.createElement('p');hint.className='timeline-help';hint.textContent='Click ◇ beside an effect to start a track. Move the playhead, then change the effect to add a keyframe.';tracks.append(hint);}
 refreshKeyEditor(true);updatePlayhead();
}
function seek(value){if(recording)return;setPlaying(false);time=Math.max(0,Math.min(timeline.duration,snapTime(value)));if(audio)audio.currentTime=time%Math.max(.001,audio.duration);syncControls();ensureSampling();renderTimeline();}
function toggleKey(name){
 if(recording)return;setPlaying(false);time=snapTime(time);selectedEffect=name;
 const scene=evaluateScene(settings,camera,timeline,time),value=name.startsWith('camera.')?scene.camera[name.slice(7)]:scene.settings[name];
 const current=atKey(timeline.tracks[name],time);
 if(current){timeline=removeKey(timeline,name,time);if(!timeline.tracks[name]){if(name.startsWith('camera.'))camera[name.slice(7)]=current.value;else settings[name]=current.value;}}
 else timeline=putKey(timeline,name,time,value);
 syncControls();ensureSampling();renderTimeline();message(`${EFFECTS[name].label}: ${current?'key removed':'key added'}. Move the playhead and change this control to add another key.`);
}
function editEffect(name,value){
 if(recording)return;if(timeline.tracks[name]){setPlaying(false);time=Math.max(0,Math.min(timeline.duration,snapTime(time)));}
 if(timeline.tracks[name]){const old=atKey(timeline.tracks[name],time);timeline=putKey(timeline,name,time,value,old?.easing??'linear');selectedEffect=name;}
 else settings[name]=value;
 syncControls();ensureSampling();renderTimeline();
}
function editCamera(next){
 if(recording)return;setPlaying(false);time=snapTime(time);
 for(const [field,value]of Object.entries(next)){const name='camera.'+field;if(timeline.tracks[name]){const old=atKey(timeline.tracks[name],time);timeline=putKey(timeline,name,time,value,old?.easing??'linear');}else camera[field]=value;}
 syncControls();renderTimeline();
}
function resetAnimation(){timeline=emptyTimeline();selectedEffect=null;time=0;setPlaying(false);renderTimeline();}
function ensureSampling(){const sampling=sceneAtTime().settings.sampling;if(sampling!==lastSampling)rebuild(sampling);}
function drawScene(width=null,height=null,target=renderer){const scene=sceneAtTime();ensureSampling();target.draw(scene.settings,scene.camera,time,energy,width,height,scene.phase);updatePlayhead();}
function updateWebcamUI(){
 const active=webcam.active&&!webcam.pending;
 $('webcam-start').textContent=webcam.pending?'Cancel camera':active?'Stop camera':'Start camera';
 $('webcam-start').disabled=!!recording&&!active&&!webcam.pending;
 $('webcam-freeze').disabled=!active||!!recording;$('webcam-device').disabled=active||webcam.pending||!!recording;
 $('webcam-indicator').textContent=webcam.pending?'Starting…':active?'Live':'Off';$('webcam-indicator').classList.toggle('active',active);
 $('webcam-status').textContent=webcam.pending?'Allow camera access in the browser prompt, or Cancel camera.':active?'Live points update while motion is paused. Stop camera releases the camera and retains its last frame.':'Camera is off. Start it explicitly to use live video. No microphone is requested.';
}
async function refreshWebcamDevices(){
 const devices=await webcam.devices(),select=$('webcam-device'),value=select.value;select.replaceChildren(new Option('Default camera',''));
 for(let i=0;i<devices.length;i++)select.add(new Option(devices[i].label||`Camera ${i+1}`,devices[i].deviceId));
 if([...select.options].some(o=>o.value===value))select.value=value;
}
function drawSourceThumbnail(){
 const ctx=$('thumb').getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,160,100);
 if(raster){const r=Math.min(160/raster.width,100/raster.height);ctx.drawImage(raster.canvas,(160-raster.width*r)/2,(100-raster.height*r)/2,raster.width*r,raster.height*r);}
 else{ctx.strokeStyle='#bbb';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(45,87);ctx.lineTo(45,43);ctx.arc(80,43,35,Math.PI,0);ctx.lineTo(115,87);ctx.stroke();}
}
function sampleWebcam(now,force=false){
 if(source.kind!=='camera'||!webcam.active||webcam.pending||webcam.video.readyState<2)return false;
 const sampling=sceneAtTime().settings.sampling,interval=sampling===500?100:1000/15;
 if(!force&&(now-lastWebcamSample<interval||webcam.video.currentTime===lastVideoTime))return false;
 const video=webcam.video,scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
 const width=Math.max(1,Math.round(video.videoWidth*scale)),height=Math.max(1,Math.round(video.videoHeight*scale));
 webcamCanvas??=document.createElement('canvas');if(webcamCanvas.width!==width||webcamCanvas.height!==height){webcamCanvas.width=width;webcamCanvas.height=height;}
 const ctx=webcamCanvas.getContext('2d',{willReadFrequently:true});ctx.setTransform($('webcam-mirror').checked?-1:1,0,0,1,$('webcam-mirror').checked?width:0,0);ctx.drawImage(video,0,0,width,height);ctx.setTransform(1,0,0,1,0,0);
 raster={canvas:webcamCanvas,pixels:ctx.getImageData(0,0,width,height).data,width,height,data:null};
 lastWebcamSample=now;lastVideoTime=video.currentTime;rebuild(sampling);drawSourceThumbnail();return true;
}
function stopWebcam(announce=true){
 if(webcam.active||webcam.pending)++loadVersion;
 if(recording)stopRecording();webcam.stop();
 if(source.kind==='camera'&&raster){source={kind:'image',name:'Camera frame',data:raster.canvas.toDataURL('image/png')};previewSource();}
 updateWebcamUI();if(announce)message('Camera stopped. Its last frame is retained as an image; effects and keyframes are preserved.');
}
async function startWebcam(){
 if(recording)throw new Error('Stop recording before starting a camera.');
 const version=++loadVersion,promise=webcam.start($('webcam-device').value),generation=webcam.generation;updateWebcamUI();
 try{
  if(!await promise)return;
  if(version!==loadVersion){if(webcam.generation===generation)webcam.stop();return;}
  source={kind:'camera',name:'Live camera'};depthRaster=depthData=basePoints=null;webcamCanvas=null;lastWebcamSample=-Infinity;lastVideoTime=-1;camera=initialCamera();camera.yaw=camera.pitch=0;
  if(!sampleWebcam(performance.now(),true))throw new Error('Camera opened without a usable frame.');
  seek(0);previewSource();updateWebcamUI();await refreshWebcamDevices().catch(()=>{});if(webcam.active&&source.kind==='camera')message('Camera live. Your video stays local. Effects and keyframes apply to incoming frames.');
 }catch(error){if(webcam.generation===generation)webcam.stop();if(source.kind==='camera'&&raster){source={kind:'image',name:'Camera frame',data:raster.canvas.toDataURL('image/png')};previewSource();}throw error;}
 finally{updateWebcamUI();}
}
function previewSource(){
 $('source-name').textContent=source.name;
 $('source-kind').textContent=source.kind==='camera'?'Live camera relief':source.kind==='image'?'Image relief':source.kind==='ply'?'Imported 3D points':'3D example';
 $('source-detail').textContent=source.kind==='demo'?'Generated 3D arch':source.name;
 $('source-description').textContent=source.kind==='camera'?`${raster.width} × ${raster.height} live video`:source.kind==='image'?`${raster.width} × ${raster.height} sampled image`:source.kind==='ply'?'ASCII PLY / normalised to view':'An original procedural example.';
 $('depth-file').disabled=source.kind!=='image';$('invert').disabled=!['image','camera'].includes(source.kind);if($('key-invert'))$('key-invert').disabled=$('invert').disabled;$('clear-depth').hidden=!depthRaster;
 $('depth-note').textContent=depthRaster?'Depth map active. Brighter areas come forward.': 'Image depth uses brightness. A matching greyscale depth map gives you more control.';
 drawSourceThumbnail();
}
function rebuild(sampling=sceneAtTime().settings.sampling){
 lastSampling=sampling;
 if(source.kind==='image'||source.kind==='camera')points=imagePoints(raster.pixels,raster.width,raster.height,sampling,depthRaster?.pixels);
 else if(source.kind==='demo')points=archPoints(Math.min(250000,Math.round(100000*(sampling/320)**2)));
 else{const stride=sampling===160?4:sampling===320?2:1;points=new Float32Array(Math.ceil(basePoints.length/8/stride)*8);let p=0;for(let i=0;i<basePoints.length;i+=8*stride){points.set(basePoints.subarray(i,i+8),p);p+=8;}}
 renderer.setPoints(points);$('point-count').textContent=`${(points.length/8).toLocaleString()} points`;dirty=true;
}
async function decodeImage(url,targetWidth=null,targetHeight=null){
 const img=new Image();img.src=url;await img.decode();
 if(img.naturalWidth<1||img.naturalHeight<1||img.naturalWidth*img.naturalHeight>64000000)throw new Error('Choose an image with at most 64 megapixels.');
 const scale=Math.min(1,1536/Math.max(img.naturalWidth,img.naturalHeight));
 const width=targetWidth??Math.max(1,Math.round(img.naturalWidth*scale)),height=targetHeight??Math.max(1,Math.round(img.naturalHeight*scale));
 const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,width,height);
 return {canvas:c,pixels:ctx.getImageData(0,0,width,height).data,width,height,data:c.toDataURL('image/png')};
}
async function rasterFromFile(file,width=null,height=null){const url=URL.createObjectURL(file);try{return await decodeImage(url,width,height);}finally{URL.revokeObjectURL(url);}}
function ensureFile(file,limit=40){if(!file)throw new Error('Choose a file.');if(file.size>limit*1024*1024)throw new Error(`Choose a file smaller than ${limit} MB.`);}
async function importSource(file){
 if(recording)throw new Error('Stop recording before changing the source.');
 ensureFile(file);const version=++loadVersion;message(`Opening ${file.name}…`);
 let next,parsed=null,nextRaster=null;
 if(/\.ply$/i.test(file.name)){const data=await file.text();parsed=parsePLY(data);next={kind:'ply',name:file.name,data};}
 else{if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error('Choose a PNG, JPEG, WebP or ASCII PLY file.');nextRaster=await rasterFromFile(file);next={kind:'image',name:file.name,data:nextRaster.data};}
 if(version!==loadVersion)return;
 webcam.stop();updateWebcamUI();source=next;raster=nextRaster;depthRaster=null;depthData=null;basePoints=parsed?.points??null;camera=initialCamera();seek(0);
 if(source.kind==='image'){settings.depth=.7;settings.threshold=.08;camera.yaw=0;camera.pitch=0;}
 syncControls();previewSource();rebuild();message(source.kind==='image'?'Image loaded. Adjust depth, remove dark points and try echoes. Brightness depth is a relief, not a complete 3D scan.':`${parsed.originalCount.toLocaleString()} vertices loaded. Sampling keeps the preview responsive.`);
}
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function saveProject(){
 const savedSource=source.kind==='camera'?{kind:'image',name:'Camera snapshot',data:raster.canvas.toDataURL('image/png')}:source;
 const project={app:'point-cloud-studio',version:3,source:savedSource,depthMap:depthData,settings,camera,time,timeline};
 download(new Blob([JSON.stringify(project)],{type:'application/json'}),'point-study.pointstudio');message('Project saved with its visual source, depth map, camera, settings and keyframes. Audio is not embedded.');
}
async function openProject(file){
 if(recording)throw new Error('Stop recording before opening another project.');
 ensureFile(file,64);const version=++loadVersion;const p=validateProject(JSON.parse(await file.text()));
 let nextRaster=null,nextDepth=null,parsed=null;
 if(p.source.kind==='image'){nextRaster=await decodeImage(p.source.data);if(p.depthMap)nextDepth=await decodeImage(p.depthMap,nextRaster.width,nextRaster.height);}
 else if(p.source.kind==='ply')parsed=parsePLY(p.source.data);
 if(version!==loadVersion)return;
 setPlaying(false);stopAudio();if(audioURL)URL.revokeObjectURL(audioURL);audioSource?.disconnect();analyser?.disconnect();audio=audioURL=audioSource=analyser=audioBins=null;$('audio-play').disabled=true;$('audio-name').textContent='Load a local audio file to move the points with its energy.';
 webcam.stop();updateWebcamUI();source=p.source;raster=nextRaster;depthRaster=nextDepth;depthData=nextDepth?.data??null;basePoints=parsed?.points??null;
 settings=p.settings;camera=p.camera;time=p.time;timeline=p.timeline;selectedEffect=null;syncControls();previewSource();rebuild();renderTimeline();message('Project opened with its visual source, settings and keyframes. Import audio separately if needed.');
}
async function exportPNG(){
 $('png').disabled=true;let exportRenderer;
 try{
  const rect=canvas.getBoundingClientRect(),aspect=rect.width/rect.height,edge=settings.resolution;
  const width=aspect>=1?edge:Math.round(edge*aspect),height=aspect>=1?Math.round(edge/aspect):edge;
  ensureSampling();const scene=sceneAtTime();const out=document.createElement('canvas');exportRenderer=new PointRenderer(out);exportRenderer.setPoints(points);exportRenderer.draw(scene.settings,scene.camera,time,energy,width,height,scene.phase);
  const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG capture failed.');download(blob,'point-study.png');message(`PNG exported at ${width} × ${height} pixels.`);
 }finally{exportRenderer?.destroy();$('png').disabled=false;}
}
function setPlaying(value){if(value&&time>=timeline.duration)time=0;playing=value;$('play').textContent=value?'Pause motion':'Play motion';$('play').setAttribute('aria-pressed',String(value));if(!value)stopAudio();last=performance.now();dirty=true;}
function stopAudio(){if(audio)audio.pause();$('audio-play').textContent='Play audio';energy=0;dirty=true;}
async function importAudio(file){
 ensureFile(file);const url=URL.createObjectURL(file);const next=new Audio(url);next.loop=true;
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Audio could not be decoded. Try MP3 or WAV.')),15000);next.onloadedmetadata=()=>{clearTimeout(timer);resolve();};next.onerror=()=>{clearTimeout(timer);reject(new Error('Audio could not be decoded. Try MP3 or WAV.'));};});}
 catch(e){URL.revokeObjectURL(url);throw e;}
 if(recording){URL.revokeObjectURL(url);return;}
 stopAudio();if(audioURL)URL.revokeObjectURL(audioURL);audioSource?.disconnect();analyser?.disconnect();audioSource=null;analyser=null;audioBins=null;
 audio=next;audioURL=url;$('audio-name').textContent=file.name;$('audio-play').disabled=false;message('Audio ready. Press Play audio to enable sound and reactive motion.');
}
async function toggleAudio(){
 if(!audio)return;if(!audio.paused){stopAudio();return;}
 audioContext??=new AudioContext();await audioContext.resume();
 if(!audioSource){audioSource=audioContext.createMediaElementSource(audio);analyser=audioContext.createAnalyser();analyser.fftSize=1024;audioSource.connect(analyser);analyser.connect(audioContext.destination);audioBins=new Uint8Array(analyser.frequencyBinCount);}
 if(time>=timeline.duration)time=0;audio.currentTime=time%Math.max(.001,audio.duration);await audio.play();setPlaying(true);$('audio-play').textContent='Pause audio';message('Audio is playing locally. Video exports will contain the artwork without sound.');
}
function recordingLock(enabled){
 if(enabled){lockedControls=[...document.querySelectorAll('header button,aside button,aside input,aside select,.timeline button,.timeline input,.timeline select,#fit,#play,#rewind')].map(el=>[el,el.disabled]);for(const [el]of lockedControls)if(el.id!=='webcam-start'||!webcam.active)el.disabled=true;canvas.setAttribute('aria-disabled','true');}
 else{for(const [el,disabled]of lockedControls)if(el.isConnected)el.disabled=disabled;lockedControls=[];canvas.removeAttribute('aria-disabled');updateWebcamUI();}
}
function stopRecording(){if(!recording||recordStopping)return;recordStopping=true;setPlaying(false);recording.stop();}
function toggleRecording(){
 if(recording){stopRecording();return;}
 if(!window.MediaRecorder || !canvas.captureStream)throw new Error('Video recording is unavailable in this browser. PNG export is available.');
 const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw new Error('No supported recording format. Try Chrome.');
 const stream=canvas.captureStream(30),chunks=[];const recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:12000000});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());recording=null;recordStopping=false;recordingLock(false);$('record').textContent='Record video';$('record').classList.remove('recording');refreshKeyEditor();if(chunks.length){download(new Blob(chunks,{type}),type.includes('mp4')?'point-study.mp4':'point-study.webm');message('Clip saved. This recording contains no audio.');}else message('No video frames were recorded.',true);};
 recorder.onerror=()=>{message('Recording failed. Try a shorter capture or export PNG.',true);if(recorder.state!=='inactive')stopRecording();};
 ++loadVersion;if(audio&&!audio.paused)audio.currentTime=0;else stopAudio();time=0;syncControls();renderTimeline();drawScene();
 try{recorder.start(1000);}catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
 recording=recorder;recordStopping=false;recordStarted=performance.now();recordingLock(true);setPlaying(true);$('record').textContent='Stop recording';$('record').classList.add('recording');message(`Recording from 0 to ${timeline.duration} seconds. The clip will save automatically at its end; Stop recording saves a shorter capture.`);
}
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;
 if(contextLost||!renderer||document.hidden)return;
 try{sampleWebcam(now);}catch(error){stopWebcam(false);report(error);}
 if(playing){
  const next=recording?(now-recordStarted)/1000:time+dt;
  if(next>=timeline.duration){time=timeline.duration;if(!recording&&loopPreview){time=next%timeline.duration;if(audio&&!audio.paused)audio.currentTime=time%Math.max(.001,audio.duration);}else if(!recording)setPlaying(false);}
  else time=next;
 }
 if(analyser&&audio&&!audio.paused){analyser.getByteFrequencyData(audioBins);let total=0;for(let i=1;i<80;i++)total+=audioBins[i];energy=energy*.8+total/(79*255)*.2;}
 if(dirty||playing||recording){drawScene();syncControls();dirty=false;if(!recording)refreshKeyEditor();}
 if(recording&&!recordStopping&&time>=timeline.duration)stopRecording();
}
function wireInput(button,input,handler){$(button).onclick=()=>$(input).click();$(input).onchange=async e=>{const file=e.target.files[0];e.target.value='';if(file)try{await handler(file);}catch(error){report(error);}};}
try{
 for(const [name,meta]of Object.entries(EFFECTS)){
  if(name.startsWith('camera.'))continue;
  const control=$(name),label=control.parentElement,button=document.createElement('button');button.id='key-'+name;button.className='key-button';button.type='button';button.textContent='◇';button.setAttribute('aria-label',`${meta.label} keyframe`);button.onclick=e=>{e.preventDefault();e.stopPropagation();toggleKey(name);};
  if(label.classList.contains('check'))label.append(button);
  else{const actions=document.createElement('span');actions.className='control-actions';const display=label.querySelector('output')??(control.tagName==='SELECT'?control:null);if(display)actions.append(display);actions.append(button);label.append(actions);}
  label.htmlFor=name;
  if(ROTATION_KEYS.includes(name)){
   const number=document.createElement('input');number.id='angle-'+name;number.type='number';number.min=-1080;number.max=1080;number.step=.1;number.value=0;number.className='angle-value';number.setAttribute('aria-label',`${meta.label} in degrees`);
   number.onchange=()=>{const value=Number(number.value);if(!Number.isFinite(value)||value< -1080||value>1080){message('Rotation must be between −1080° and 1080°.',true);number.value=sceneAtTime().settings[name];return;}editEffect(name,value);};
   label.querySelector('.control-actions').prepend(number);label.htmlFor=number.id;
  }
 }
 renderer=new PointRenderer(canvas);syncControls();previewSource();rebuild();updateWebcamUI();
 for(const key of Object.keys(DEFAULTS))$(key).addEventListener('input',()=>{const el=$(key);editEffect(key,el.type==='checkbox'?el.checked:Number(el.value));});
 $('play').onclick=()=>{if(!recording)setPlaying(!playing);};$('rewind').onclick=()=>seek(0);
 $('scrub').oninput=()=>seek(Number($('scrub').value));$('playhead').onchange=()=>{const v=Number($('playhead').value);if(Number.isFinite(v))seek(v);};
 $('duration').onchange=()=>{if(recording)return;const value=snapTime(Number($('duration').value)),latest=Math.max(0,...Object.values(timeline.tracks).flat().map(k=>k.time));if(!Number.isFinite(value)||value<1||value>60||value<latest){message(`Duration must be 1–60 seconds and include the last key at ${latest.toFixed(2)} s.`,true);$('duration').value=timeline.duration;return;}setPlaying(false);timeline={...timeline,duration:value};time=Math.min(time,value);syncControls();renderTimeline();};
 $('loop').onchange=()=>{loopPreview=$('loop').checked;};
 for(const [id,direction]of [['prev-key',-1],['next-key',1]])$(id).onclick=()=>{const times=[...new Set(Object.values(timeline.tracks).flat().map(k=>k.time))].sort((a,b)=>a-b);const target=direction<0?times.filter(t=>t<time-.001).at(-1):times.find(t=>t>time+.001);if(target!==undefined)seek(target);};
 $('camera-key').onclick=()=>{if(recording)return;setPlaying(false);time=snapTime(time);const current=evaluateScene(settings,camera,timeline,time).camera;for(const [field,value]of Object.entries(current))timeline=putKey(timeline,'camera.'+field,time,value);selectedEffect='camera.yaw';syncControls();renderTimeline();message('Camera keys added. Move the playhead, then orbit, pan or zoom to add the next camera pose.');};
 $('easing').onchange=()=>{if(recording)return;const key=atKey(timeline.tracks[selectedEffect],time);if(key){timeline=putKey(timeline,selectedEffect,time,key.value,$('easing').value);syncControls();renderTimeline();}};
 $('key-time').onchange=()=>{if(recording)return;try{const value=Number($('key-time').value);timeline=moveKey(timeline,selectedEffect,time,value);seek(value);}catch(e){report(e);refreshKeyEditor(true);}};
 $('delete-key').onclick=()=>{if(selectedEffect)toggleKey(selectedEffect);};
 $('clear-track').onclick=()=>{if(recording||!selectedEffect)return;const scene=evaluateScene(settings,camera,timeline,time);if(selectedEffect.startsWith('camera.'))camera[selectedEffect.slice(7)]=scene.camera[selectedEffect.slice(7)];else settings[selectedEffect]=scene.settings[selectedEffect];const tracks={...timeline.tracks};delete tracks[selectedEffect];timeline={...timeline,tracks};syncControls();ensureSampling();renderTimeline();message('Track cleared. Its current value is retained.');};
 $('fit').onclick=()=>{const next=initialCamera();if(source.kind==='image'||source.kind==='camera'){next.yaw=0;next.pitch=0;}editCamera(next);};
 $('reset').onclick=()=>{settings={...DEFAULTS};resetAnimation();syncControls();rebuild();message('Controls and animation reset. Your source is retained.');};
 $('demo').onclick=()=>{++loadVersion;webcam.stop();updateWebcamUI();source={kind:'demo',name:'Generated arch'};raster=depthRaster=depthData=basePoints=null;settings={...DEFAULTS};camera=initialCamera();resetAnimation();syncControls();previewSource();rebuild();message('Original generated arch loaded with its default controls.');};
 $('rotation-key').onclick=()=>{if(recording)return;setPlaying(false);time=snapTime(time);const values=sceneAtTime().settings;for(const name of ROTATION_KEYS)timeline=putKey(timeline,name,time,values[name],atKey(timeline.tracks[name],time)?.easing??'linear');selectedEffect='rotationX';syncControls();renderTimeline();message('X, Y and Z rotation keys added. Move the playhead and change an angle for the next pose.');};
 $('rotation-reset').onclick=()=>{for(const name of ROTATION_KEYS)editEffect(name,0);message('Rotation set to zero at the playhead. Existing animation tracks are retained.');};
 $('save').onclick=saveProject;$('png').onclick=()=>exportPNG().catch(report);$('record').onclick=()=>{try{toggleRecording();}catch(e){report(e);}};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch{message('Full screen is unavailable in this browser.',true);}};
 document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit full screen':'Full screen';dirty=true;});
 wireInput('import','source-input',importSource);wireInput('open','project-input',openProject);wireInput('audio-file','audio-input',importAudio);
 wireInput('depth-file','depth-input',async file=>{ensureFile(file);if(source.kind!=='image')throw new Error('Import an image before adding a depth map.');const version=++loadVersion;const result=await rasterFromFile(file,raster.width,raster.height);if(version!==loadVersion)return;depthRaster=result;depthData=result.data;previewSource();rebuild();message('Depth map applied. It is stretched to align with your image.');});
 $('clear-depth').onclick=()=>{++loadVersion;depthRaster=depthData=null;previewSource();rebuild();message('Depth now follows image brightness.');};
 $('audio-play').onclick=()=>toggleAudio().catch(report);
 $('webcam-start').onclick=()=>{if(webcam.active||webcam.pending)stopWebcam();else startWebcam().catch(report);};
 $('webcam-freeze').onclick=()=>stopWebcam();
 $('webcam-mirror').onchange=()=>{sampleWebcam(performance.now(),true);dirty=true;};
 navigator.mediaDevices?.addEventListener?.('devicechange',()=>refreshWebcamDevices().catch(()=>{}));
 window.addEventListener('pagehide',()=>webcam.stop());
 const stage=$('stage');stage.addEventListener('dragover',e=>{e.preventDefault();stage.classList.add('dragging');});stage.addEventListener('dragleave',e=>{if(!stage.contains(e.relatedTarget))stage.classList.remove('dragging');});stage.addEventListener('drop',async e=>{e.preventDefault();stage.classList.remove('dragging');const file=e.dataTransfer.files[0];if(file)try{await(/\.(pointstudio|json)$/i.test(file.name)?openProject(file):importSource(file));}catch(error){report(error);}});
 let pointer=null;
 canvas.addEventListener('pointerdown',e=>{if(recording||e.button!==0)return;canvas.focus();canvas.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointermove',e=>{if(recording||!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y,next=evaluateScene(settings,camera,timeline,time).camera;if(e.shiftKey){next.panX=Math.max(-10,Math.min(10,next.panX+dx/canvas.clientHeight*next.distance/1.85*2));next.panY=Math.max(-10,Math.min(10,next.panY-dy/canvas.clientHeight*next.distance/1.85*2));}else{next.yaw=(next.yaw+dx*.005)%(Math.PI*2);next.pitch=Math.max(-1.4,Math.min(1.4,next.pitch+dy*.005));}pointer.x=e.clientX;pointer.y=e.clientY;editCamera(next);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();if(recording)return;const next=evaluateScene(settings,camera,timeline,time).camera;next.distance=Math.min(12,Math.max(1.4,next.distance*Math.exp(e.deltaY*.001)));editCamera(next);},{passive:false});
 canvas.addEventListener('dblclick',()=>$('fit').click());canvas.addEventListener('keydown',e=>{if(recording)return;if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();seek(time+(e.key==='ArrowLeft'?-1:1)/30);}if(e.key==='0')$('fit').click();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;setPlaying(false);stopWebcam(false);stopRecording();message('Graphics context lost. Waiting for the browser to restore it. Your source is retained.',true);});
 canvas.addEventListener('webglcontextrestored',()=>{try{renderer=new PointRenderer(canvas);renderer.setPoints(points);contextLost=false;dirty=true;message('Graphics restored.');}catch(e){report(e);}});
 new ResizeObserver(()=>{dirty=true;}).observe(stage);
 document.addEventListener('visibilitychange',()=>{last=performance.now();dirty=true;if(document.hidden){setPlaying(false);stopRecording();if(webcam.active||webcam.pending)stopWebcam(false);}});
 renderTimeline();
 requestAnimationFrame(frame);
}catch(error){report(error);for(const id of ['png','record','import','save','open','webcam-start'])$(id).disabled=true;}
