import test from 'node:test';import assert from 'node:assert/strict';
import {LiveCamera,liveCameraError} from '../live-camera.js';
const fixture=()=>{const listeners={},track={stopped:false,stop(){this.stopped=true;},addEventListener(name,callback){listeners[name]=callback;}};const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};const video={readyState:2,videoWidth:640,videoHeight:480,play:async()=>{},pause(){},srcObject:null};return {track,stream,video,listeners};};
test('camera requests video only and releases every track on stop',async()=>{
 const f=fixture();let constraints;const input=new LiveCamera({video:f.video,mediaDevices:{getUserMedia:async c=>{constraints=c;return f.stream;}}});
 assert.equal(await input.start(),true);assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode,'user');assert.equal(input.active,true);input.stop();assert.equal(f.track.stopped,true);assert.equal(f.video.srcObject,null);assert.equal(input.active,false);
});
test('specific device is requested only after explicit selection and devices omit audio',async()=>{
 const f=fixture();let constraints;const input=new LiveCamera({video:f.video,mediaDevices:{getUserMedia:async c=>{constraints=c;return f.stream;},enumerateDevices:async()=>[{kind:'videoinput',deviceId:'camera'},{kind:'audioinput',deviceId:'mic'}]}});
 assert.equal((await input.devices()).length,1);await input.start('chosen');assert.deepEqual(constraints.video.deviceId,{exact:'chosen'});assert.equal(constraints.video.facingMode,undefined);input.stop();
});
test('cancelled permission request cannot activate a late stream',async()=>{
 const f=fixture();let resolve;const input=new LiveCamera({video:f.video,mediaDevices:{getUserMedia:()=>new Promise(r=>{resolve=r;})}});const request=input.start();assert.equal(input.pending,true);input.stop();resolve(f.stream);assert.equal(await request,false);assert.equal(f.track.stopped,true);assert.equal(input.active,false);
});
test('playback failure releases the stream, and denied permissions produce an actionable error',async()=>{
 const f=fixture();f.video.play=async()=>{throw new Error('Video failed');};const input=new LiveCamera({video:f.video,mediaDevices:{getUserMedia:async()=>f.stream}});await assert.rejects(input.start(),/Video failed/);assert.equal(f.track.stopped,true);assert.equal(input.pending,false);
 const denied=new LiveCamera({video:fixture().video,mediaDevices:{getUserMedia:async()=>{throw {name:'NotAllowedError'};}}});await assert.rejects(denied.start(),/permission was denied/);assert.equal(denied.active,false);assert.match(liveCameraError({name:'NotFoundError'}).message,/No camera/);
});
test('disconnect cleans up and notifies the app once',async()=>{
 const f=fixture();let ended=0;const input=new LiveCamera({video:f.video,mediaDevices:{getUserMedia:async()=>f.stream},onEnded:()=>ended++});await input.start();f.listeners.ended();f.listeners.ended();assert.equal(ended,1);assert.equal(input.active,false);assert.equal(f.track.stopped,true);
});
test('cancelling after stream acquisition also cancels video-readiness wait',async()=>{
 const f=fixture();f.video.readyState=0;const input=new LiveCamera({video:f.video,mediaDevices:{getUserMedia:async()=>f.stream}});const request=input.start();await new Promise(r=>setTimeout(r,5));input.stop();assert.equal(await request,false);assert.equal(f.track.stopped,true);
});
