export function liveCameraError(error){
 const messages={NotAllowedError:'Camera permission was denied. Allow this page to use your camera in the browser, and check camera access for the browser in macOS System Settings.',NotFoundError:'No camera was found. Connect a camera or choose the default camera and try again.',NotReadableError:'The camera could not start. Close other apps using it and check camera access in macOS System Settings.',OverconstrainedError:'The selected camera is unavailable. Choose the default camera and try again.',SecurityError:'Camera access is blocked. Open Point Cloud Studio at its local browser address.'};
 return new Error(messages[error?.name]??error?.message??'Camera could not start.');
}
export class LiveCamera {
 constructor({mediaDevices=globalThis.navigator?.mediaDevices,video=globalThis.document?.createElement('video'),onEnded=()=>{}}={}){
  this.mediaDevices=mediaDevices;this.video=video;this.onEnded=onEnded;this.stream=null;this.pending=false;this.generation=0;
  if(video){video.muted=true;video.playsInline=true;}
 }
 get active(){return !!this.stream;}
 async devices(){return (await this.mediaDevices?.enumerateDevices?.()??[]).filter(d=>d.kind==='videoinput');}
 async start(deviceId=''){
  this.stop();const generation=this.generation;
  if(!this.mediaDevices?.getUserMedia)throw new Error('Camera access is unavailable in this browser. Open the local studio in Chrome or Safari.');
  this.pending=true;
  try{
   const video={width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}};
   if(deviceId)video.deviceId={exact:deviceId};else video.facingMode='user';
   const stream=await this.mediaDevices.getUserMedia({audio:false,video});
   if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return false;}
   this.stream=stream;this.video.srcObject=stream;
   for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(generation===this.generation){this.stop();this.onEnded();}},{once:true});
   let playing=false,playError=null;
   Promise.resolve(this.video.play()).then(()=>{playing=true;},error=>{playError=error;});
   const deadline=Date.now()+10000;
   const ready=await new Promise((resolve,reject)=>{
    const poll=()=>{
     if(generation!==this.generation){resolve(false);return;}
     if(playError){reject(playError);return;}
     if(playing&&this.video.readyState>=2&&this.video.videoWidth>0&&this.video.videoHeight>0){resolve(true);return;}
     if(Date.now()>deadline){reject(new Error('The camera opened but no video frames arrived. Stop it and try again.'));return;}
     setTimeout(poll,50);
    };poll();
   });
   if(generation!==this.generation||!ready)return false;
   this.pending=false;return true;
  }catch(error){if(generation!==this.generation)return false;this.stop();throw liveCameraError(error);}
 }
 stop(){
  ++this.generation;this.pending=false;
  this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
  if(this.video){this.video.pause();this.video.srcObject=null;}
 }
}
