import test from 'node:test';import assert from 'node:assert/strict';
import { DEFAULTS, validateProject } from '../core.js';
import { emptyTimeline, evaluateTrack, evaluateScene, putKey, moveKey, removeKey, integrateTrack, motionAtTime, validateTimeline } from '../timeline.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('numeric keys interpolate at arbitrary scrub times and hold before/after endpoints',()=>{
 let t=putKey(emptyTimeline(),'depth',2,0);t=putKey(t,'depth',8,2);
 close(evaluateTrack(.7,t.tracks.depth,5,'depth'),1);close(evaluateTrack(.7,t.tracks.depth,0,'depth'),0);close(evaluateTrack(.7,t.tracks.depth,10,'depth'),2);
 t=putKey(t,'depth',2,0,'smooth');close(evaluateTrack(.7,t.tracks.depth,3.5,'depth'),.3125);
 t=putKey(t,'depth',2,0,'hold');close(evaluateTrack(.7,t.tracks.depth,7.99,'depth'),0);close(evaluateTrack(.7,t.tracks.depth,8,'depth'),2);
});
test('discrete settings hold until their key and echo count stays integral',()=>{
 let t=putKey(emptyTimeline(),'sampling',0,160);t=putKey(t,'sampling',5,500);assert.equal(evaluateTrack(320,t.tracks.sampling,4.9,'sampling'),160);assert.equal(evaluateTrack(320,t.tracks.sampling,5,'sampling'),500);
 t=putKey(t,'invert',0,false);t=putKey(t,'invert',5,true);assert.equal(evaluateTrack(false,t.tracks.invert,4,'invert'),false);
 t=putKey(t,'echoes',0,1);t=putKey(t,'echoes',10,4);assert.equal(evaluateTrack(1,t.tracks.echoes,5,'echoes'),3);
});
test('moving, replacing and removing keys preserves ordering and rejects collisions',()=>{
 let t=putKey(emptyTimeline(),'scatter',0,0);t=putKey(t,'scatter',5,.5);t=putKey(t,'scatter',5,.3);assert.equal(t.tracks.scatter.length,2);
 const moved=moveKey(t,'scatter',5,7.02);assert.equal(moved.tracks.scatter[1].time,7+1/30);assert.throws(()=>moveKey(t,'scatter',5,0),/already/);assert.equal(t.tracks.scatter[1].time,5);
 t=removeKey(removeKey(t,'scatter',0),'scatter',5);assert.equal(t.tracks.scatter,undefined);
});
test('speed integral is exact across linear/smooth/hold spans and camera orbit pauses continuously',()=>{
 let t=putKey(emptyTimeline(),'speed',0,0);t=putKey(t,'speed',10,2);close(integrateTrack(.35,t.tracks.speed,5),2.5);close(integrateTrack(.35,t.tracks.speed,12),14);
 t=putKey(t,'speed',0,0,'smooth');close(integrateTrack(.35,t.tracks.speed,5),1.875);close(integrateTrack(.35,t.tracks.speed,10),10);
 t=putKey(t,'rotate',0,true);t=putKey(t,'rotate',5,false);const a=motionAtTime(DEFAULTS,t,5),b=motionAtTime(DEFAULTS,t,10);close(a.orbit,b.orbit);close(b.phase,10);
 t=putKey(t,'speed',0,1,'hold');close(integrateTrack(.35,t.tracks.speed,5),5);
});
test('scene evaluation is deterministic, independent of playback history and preserves base state',()=>{
 const camera={yaw:0,pitch:0,distance:3,panX:0,panY:0};let t=putKey(emptyTimeline(),'camera.distance',0,3);t=putKey(t,'camera.distance',10,6);t=putKey(t,'opacity',0,0);t=putKey(t,'opacity',10,1);
 const first=evaluateScene(DEFAULTS,camera,t,5);evaluateScene(DEFAULTS,camera,t,9);assert.deepEqual(evaluateScene(DEFAULTS,camera,t,5),first);close(first.camera.distance,4.5);close(first.settings.opacity,.5);assert.equal(camera.distance,3);assert.equal(DEFAULTS.opacity,.65);
});
test('project version 1 migrates, version 2 retains keys and malformed tracks are rejected',()=>{
 const base={app:'point-cloud-studio',version:1,settings:{...DEFAULTS},camera:{yaw:0,pitch:0,distance:3,panX:0,panY:0},time:3,source:{kind:'demo',name:'Example'},depthMap:null};
 assert.deepEqual(validateProject(base).timeline,emptyTimeline());const t=putKey(emptyTimeline(),'depth',3,1);assert.deepEqual(validateProject({...base,version:2,timeline:t}).timeline,t);
 assert.throws(()=>validateProject({...base,version:2}),/timeline/);assert.throws(()=>putKey(t,'depth',3,NaN),/value/);
 assert.throws(()=>validateTimeline({...t,tracks:{depth:[{time:4,value:.1,easing:'linear'},{time:3,value:.2,easing:'linear'}]}}),/ordered/);
 assert.throws(()=>validateTimeline({...t,tracks:{opacity:[{time:1.01,value:.5,easing:'linear'}]}}),/30 fps/);
 assert.throws(()=>validateTimeline({...t,duration:2}),/inside/);assert.throws(()=>putKey(t,'resolution',3,1920),/track/);
});
