import test from 'node:test';import assert from 'node:assert/strict';
import {rotationMatrix} from '../renderer.js';import {validateProject,DEFAULTS} from '../core.js';
import {putKey,emptyTimeline,evaluateScene} from '../timeline.js';
const apply=(m,[x,y,z])=>[m[0]*x+m[3]*y+m[6]*z,m[1]*x+m[4]*y+m[7]*z,m[2]*x+m[5]*y+m[8]*z];
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,`${a} != ${b}`));
test('X, Y, Z rotations have distinct right-handed axes and full turns return to identity',()=>{
 near(apply(rotationMatrix(90,0,0),[0,1,0]),[0,0,1]);near(apply(rotationMatrix(0,90,0),[1,0,0]),[0,0,-1]);near(apply(rotationMatrix(0,0,90),[1,0,0]),[0,1,0]);near(apply(rotationMatrix(720,-1080,360),[2,3,4]),[2,3,4]);
});
test('combined rotation applies X then Y then Z and preserves distances',()=>{
 near(apply(rotationMatrix(90,90,0),[0,1,0]),[1,0,0]);const v=[2,3,4],p=apply(rotationMatrix(37,-71,133),v);assert.ok(Math.abs(Math.hypot(...v)-Math.hypot(...p))<1e-6);
});
const project=()=>({app:'point-cloud-studio',version:3,settings:{...DEFAULTS},camera:{yaw:0,pitch:0,distance:3,panX:0,panY:0},time:0,source:{kind:'demo',name:'Example'},depthMap:null,timeline:emptyTimeline()});
test('rotation tracks preserve explicit full turns instead of choosing the shortest path',()=>{
 let t=putKey(emptyTimeline(),'rotationY',0,0);t=putKey(t,'rotationY',10,720);const p=project();assert.equal(evaluateScene(p.settings,p.camera,t,2.5).settings.rotationY,180);assert.equal(evaluateScene(p.settings,p.camera,t,5).settings.rotationY,360);assert.equal(evaluateScene(p.settings,p.camera,t,7.5).settings.rotationY,540);
 assert.deepEqual(validateProject({...p,timeline:t}).timeline,t);
});
test('versions 1 and 2 default missing angles to zero; version 3 strictly validates angles and keys',()=>{
 const p=project();for(const name of ['rotationX','rotationY','rotationZ'])delete p.settings[name];
 for(const version of [1,2]){const old=validateProject({...p,version});assert.equal(old.settings.rotationX,0);assert.equal(old.settings.rotationY,0);assert.equal(old.settings.rotationZ,0);}
 assert.throws(()=>validateProject(p),/rotationX/);p.settings={...DEFAULTS,rotationX:Infinity};assert.throws(()=>validateProject(p),/rotationX/);assert.throws(()=>putKey(emptyTimeline(),'rotationZ',0,2000),/value/);
});
