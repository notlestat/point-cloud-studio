import { RANGES } from './settings.js';

// Keep this module independent of the DOM and renderer so scrubbing/export share one evaluator.
export const FPS = 30;
export const EFFECTS = {
 sampling:{label:'Sampling',choices:[160,320,500]},size:{label:'Point size'},opacity:{label:'Opacity'},
 threshold:{label:'Remove dark points'},colour:{label:'Colour',choices:[0,1,2]},depth:{label:'Depth'},
 invert:{label:'Invert depth',boolean:true},scatter:{label:'Scatter'},wave:{label:'Wave'},
 echoes:{label:'Echoes',integer:true},spacing:{label:'Echo spacing'},speed:{label:'Motion speed'},
 rotate:{label:'Camera orbit',boolean:true},response:{label:'Audio response'},
 rotationX:{label:'X rotation',unit:'°'},rotationY:{label:'Y rotation',unit:'°'},rotationZ:{label:'Z rotation',unit:'°'},
 'camera.yaw':{label:'Camera rotation',range:[-1000,1000]},'camera.pitch':{label:'Camera tilt',range:[-1.4,1.4]},
 'camera.distance':{label:'Camera distance',range:[1.4,12]},'camera.panX':{label:'Camera pan X',range:[-10,10]},
 'camera.panY':{label:'Camera pan Y',range:[-10,10]}
};
export const emptyTimeline = () => ({duration:10,fps:FPS,tracks:{}});
export const snapTime = time => Math.round(time*FPS)/FPS;
export const atKey = (keys,time) => keys?.find(k=>Math.abs(k.time-time)<1/(FPS*100));
export const isDiscrete = key => !!(EFFECTS[key]?.choices||EFFECTS[key]?.boolean);
export function validateTimeline(value){
 if(!value||value.fps!==FPS||!Number.isFinite(value.duration)||value.duration<1||value.duration>60||Math.abs(snapTime(value.duration)-value.duration)>1e-6||!value.tracks||typeof value.tracks!=='object'||Array.isArray(value.tracks))throw new Error('Invalid animation timeline. Use a 1–60 second clip at 30 fps.');
 const timeline=emptyTimeline();timeline.duration=value.duration;let total=0;
 for(const [name,keys] of Object.entries(value.tracks)){
  const meta=EFFECTS[name];if(!Object.hasOwn(EFFECTS,name)||!Array.isArray(keys)||keys.length>600)throw new Error('Invalid or oversized animation track.');
  total+=keys.length;if(total>10000)throw new Error('Too many keyframes.');
  let previous=-1;const copied=[];
  for(const key of keys){
   if(!key||!Number.isFinite(key.time)||key.time<0||key.time>timeline.duration||Math.abs(snapTime(key.time)-key.time)>1e-6||key.time<=previous||!['linear','smooth','hold'].includes(key.easing))throw new Error('Keyframe times must be unique, ordered and inside the clip on a 30 fps frame.');
   let valid;
   if(meta.boolean)valid=typeof key.value==='boolean';
   else if(meta.choices)valid=meta.choices.includes(key.value);
   else{const range=meta.range??RANGES[name];valid=typeof key.value==='number'&&Number.isFinite(key.value)&&key.value>=range[0]&&key.value<=range[1]&&(!meta.integer||Number.isInteger(key.value));}
   if(!valid)throw new Error(`Invalid ${meta.label} keyframe value.`);
   copied.push({time:key.time,value:key.value,easing:isDiscrete(name)?'hold':key.easing});previous=key.time;
  }
  if(copied.length)timeline.tracks[name]=copied;
 }
 return timeline;
}
export function evaluateTrack(base,keys,time,name){
 if(!keys?.length)return base;
 if(time<=keys[0].time)return keys[0].value;
 let a=keys[0];
 for(let i=1;i<keys.length;i++){
  const b=keys[i];if(time<b.time){
   if(isDiscrete(name)||a.easing==='hold')return a.value;
   let t=(time-a.time)/(b.time-a.time);if(a.easing==='smooth')t=t*t*(3-2*t);
   const value=a.value+(b.value-a.value)*t;return EFFECTS[name]?.integer?Math.round(value):value;
  }a=b;
 }
 return a.value;
}
export function evaluateScene(settings,camera,timeline,time){
 const result={settings:{...settings},camera:{...camera}};
 for(const [name,keys]of Object.entries(timeline.tracks)){
  if(name.startsWith('camera.')){const field=name.slice(7);result.camera[field]=evaluateTrack(camera[field],keys,time,name);}
  else result.settings[name]=evaluateTrack(settings[name],keys,time,name);
 }
 return result;
}
export function putKey(timeline,name,time,value,easing='linear'){
 const t=snapTime(Math.max(0,Math.min(timeline.duration,time)));if(t>timeline.duration+1e-6)throw new Error('Keyframe is outside the clip.');
 const keys=(timeline.tracks[name]??[]).filter(key=>!atKey([key],t));
 keys.push({time:t,value,easing:isDiscrete(name)?'hold':easing});keys.sort((a,b)=>a.time-b.time);
 const next={...timeline,tracks:{...timeline.tracks,[name]:keys}};return validateTimeline(next);
}
export function removeKey(timeline,name,time){
 const tracks={...timeline.tracks};tracks[name]=(tracks[name]??[]).filter(key=>!atKey([key],time));if(!tracks[name].length)delete tracks[name];return {...timeline,tracks};
}
export function moveKey(timeline,name,from,to){
 const key=atKey(timeline.tracks[name],from);if(!key)throw new Error('Select a keyframe first.');
 const target=snapTime(to);if(target<0||target>timeline.duration)throw new Error('Keyframe is outside the clip.');
 if(Math.abs(from-target)>1e-6&&atKey(timeline.tracks[name],target))throw new Error('There is already a keyframe at that time.');
 return putKey(removeKey(timeline,name,from),name,target,key.value,key.easing);
}
// Integral of linear or smoothstep interpolation. Motion speed changes stay continuous.
export function integrateTrack(base,keys,time){
 if(time<=0)return 0;if(!keys?.length)return base*time;
 let total=keys[0].value*Math.min(time,keys[0].time);
 for(let i=0;i<keys.length&&time>keys[i].time;i++){
  const a=keys[i],b=keys[i+1];const dt=Math.min(time,b?.time??time)-a.time;
  if(!b||a.easing==='hold'){total+=a.value*dt;continue;}
  const span=b.time-a.time,u=dt/span;
  total+=a.value*dt+(b.value-a.value)*span*(a.easing==='smooth'?u**3-.5*u**4:.5*u**2);
 }
 return total;
}
export function motionAtTime(settings,timeline,time){
 const speed=timeline.tracks.speed,rotate=timeline.tracks.rotate;
 const phase=integrateTrack(settings.speed,speed,time);
 const boundaries=[0,...(rotate??[]).map(k=>k.time).filter(t=>t>0&&t<time),time];let orbit=0;
 for(let i=1;i<boundaries.length;i++)if(evaluateTrack(settings.rotate,rotate,boundaries[i-1],'rotate'))orbit+=integrateTrack(settings.speed,speed,boundaries[i])-integrateTrack(settings.speed,speed,boundaries[i-1]);
 return {phase,orbit};
}
