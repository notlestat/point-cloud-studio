import test from 'node:test';import assert from 'node:assert/strict';
import {imagePoints,parsePLY,archPoints,validateProject,DEFAULTS,MAX_POINTS} from '../core.js';
test('image sampling preserves aspect, orientation, alpha and explicit depth independently of colour',()=>{
 const rgba=new Uint8ClampedArray([255,0,0,255,0,255,0,0,0,0,255,255,255,255,255,255]);
 const depth=new Uint8ClampedArray([255,255,255,255,0,0,0,255,0,0,0,255,128,128,128,255]);
 const p=imagePoints(rgba,2,2,160,depth);assert.equal(p.length,24);assert.equal(p[0],-.5);assert.equal(p[1],.5);assert.equal(p[2],.5);assert.equal(p[3],1);assert.equal(p[9],-.5);assert.equal(p[10],-.5);
 assert.deepEqual(p,imagePoints(rgba,2,2,160,depth));
});
const ply=rows=>`ply\nformat ascii 1.0\nelement vertex ${rows.length}\nproperty float z\nproperty uchar blue\nproperty float x\nproperty float y\nproperty uchar red\nproperty uchar green\nend_header\n${rows.join('\n')}\n`;
test('PLY maps named fields and centres geometry without flattening depth',()=>{const p=parsePLY(ply(['0 0 10 0 255 0','2 255 14 4 0 0']));assert.equal(p.originalCount,2);assert.deepEqual([...p.points.slice(0,7)],[-1,-1,-.5,1,0,0,Math.fround(.2126)]);assert.equal(p.points[10],.5);});
test('PLY rejects binary, malformed and non-finite vertices before replacing source',()=>{
 assert.throws(()=>parsePLY(ply(['NaN 0 0 0 0 0'])),/Invalid coordinates/);assert.throws(()=>parsePLY(ply(['0 0 0 0 0 0'])),/same position/);
 assert.throws(()=>parsePLY(ply(['0 0 0 0 0 0','1 300 1 1 0 0'])),/Invalid colour/);
 assert.throws(()=>parsePLY(ply(['0 0 0 0 0 0','1 0 1 1 0 0']).replace('ascii','binary_little_endian')),/ASCII/);
 assert.throws(()=>parsePLY(ply(['0 0 0 0 0 0','1 0 1 1 0 0']).replace('vertex 2','vertex 3')),/fewer/);
});
test('generated example is deterministic and bounded',()=>{const p=archPoints(1000);assert.equal(p.length,8000);assert.deepEqual(p,archPoints(1000));assert.ok([...p].every(Number.isFinite));});
test('dense image stays inside renderer point budget',()=>{const rgba=new Uint8ClampedArray(520*520*4).fill(255);assert.ok(imagePoints(rgba,520,520,500).length/8<=MAX_POINTS);});
const project=()=>({app:'point-cloud-studio',version:1,settings:{...DEFAULTS},camera:{yaw:0,pitch:0,distance:3,panX:0,panY:0},time:3,source:{kind:'demo',name:'Example'},depthMap:null});
test('project validation permits round trip and rejects external source URLs, invalid camera and unsafe settings',()=>{
 const p=project();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))).settings,DEFAULTS);
 p.source={kind:'image',name:'Photo',data:'https://example.com/photo.png'};assert.throws(()=>validateProject(p),/embedded/);
 p.source={kind:'demo',name:'Example'};p.camera.distance=0;assert.throws(()=>validateProject(p),/camera/);p.camera.distance=3;p.settings.echoes=1.5;assert.throws(()=>validateProject(p),/whole number/);
});
