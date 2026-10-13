import { emptyTimeline, validateTimeline } from './timeline.js';
import { DEFAULTS, RANGES, ROTATION_KEYS } from './settings.js';
export { DEFAULTS, RANGES } from './settings.js';
export const MAX_POINTS = 250000;
export function settingsFrom(value,legacyRotation=false) {
  if (!value || typeof value !== 'object') throw new Error('Project settings are missing.');
  const result={...DEFAULTS};
  for (const [key,[min,max]] of Object.entries(RANGES)) {
    if(legacyRotation&&ROTATION_KEYS.includes(key)&&value[key]===undefined)continue;
    if (typeof value[key]!=='number' || !Number.isFinite(value[key]) || value[key]<min || value[key]>max) throw new Error(`Invalid ${key} setting.`);
    result[key]=value[key];
  }
  for (const [key,choices] of Object.entries({sampling:[160,320,500],colour:[0,1,2],resolution:[1920,2400,3840]})) {
    if (!choices.includes(value[key])) throw new Error(`Invalid ${key} setting.`);
    result[key]=value[key];
  }
  for (const key of ['invert','rotate']) { if(typeof value[key]!=='boolean')throw new Error(`Invalid ${key} setting.`);result[key]=value[key]; }
  if(!Number.isInteger(result.echoes))throw new Error('Echoes must be a whole number.');
  return result;
}
export function random(seed=7219) { return ()=>{ seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; }; }
// Eight floats per point: xyz, rgb, luminance, deterministic noise seed.
export function imagePoints(pixels,width,height,sampling,depthPixels=null) {
  if (!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||pixels.length!==width*height*4) throw new Error('Invalid image pixels.');
  if (![160,320,500].includes(sampling)) throw new Error('Invalid sampling.');
  if(depthPixels && depthPixels.length!==pixels.length)throw new Error('Depth map must match sampled image dimensions.');
  const step=Math.max(1,Math.max(width,height)/sampling);
  const rng=random();const out=[];const span=Math.max(width,height);
  for(let y=step/2;y<height;y+=step)for(let x=step/2;x<width;x+=step){
    const i=(Math.floor(y)*width+Math.floor(x))*4;
    if(pixels[i+3]<8)continue;
    const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255;
    const l=r*0.2126+g*0.7152+b*0.0722;
    const d=depthPixels?(depthPixels[i]*0.2126+depthPixels[i+1]*0.7152+depthPixels[i+2]*0.0722)/255:l;
    out.push((x-width/2)/span*2,(height/2-y)/span*2,d-0.5,r,g,b,l,rng());
    if(out.length/8>=MAX_POINTS)return new Float32Array(out);
  }
  return new Float32Array(out);
}
export function archPoints(count=100000) {
  const rng=random(912);const out=new Float32Array(count*8);
  for(let i=0;i<count;i++) {
    let x,y,z;const part=rng();
    if(part<.45){const angle=rng()*Math.PI;const radius=.53+rng()*.22;x=Math.cos(angle)*radius;y=.12+Math.sin(angle)*radius;z=(rng()-.5)*.5;}
    else if(part<.83){x=(rng()<.5?-1:1)*(.53+rng()*.22);y=.12-rng()*1.04;z=(rng()-.5)*.5;}
    else {x=(rng()-.5)*2.25;y=-.96+Math.floor(rng()*3)*.045;z=(rng()-.5)*1.25;}
    const grain=rng(),chip=grain<.03?.035:.004;x+=(rng()-.5)*chip;y+=(rng()-.5)*chip;z+=(rng()-.5)*chip;
    const light=.32+.60*rng();out.set([x,y,z,light*.86,light*.94,light,light,rng()],i*8);
  }
  return out;
}
export function parsePLY(text) {
  if(typeof text!=='string'||text.length>40*1024*1024)throw new Error('PLY files must be smaller than 40 MB.');
  const end=/^end_header\s*$/m.exec(text);if(!end||end.index>65536)throw new Error('PLY header is missing or too large.');
  const header=text.slice(0,end.index).split(/\r?\n/);if(header[0].trim()!=='ply')throw new Error('This is not a PLY file.');
  if(!header.some(s=>s.trim()==='format ascii 1.0'))throw new Error('Use ASCII PLY 1.0. Binary PLY is not supported yet.');
  let n=0,element='',seenVertex=false;const props=[];
  for(const line of header){const p=line.trim().split(/\s+/);if(p[0]==='element'){element=p[1];if(element==='vertex'){if(seenVertex)throw new Error('Duplicate vertex element.');seenVertex=true;n=Number(p[2]);}else if(!seenVertex && Number(p[2])>0)throw new Error('PLY vertices must be the first non-empty element.');}
    if(p[0]==='property' && element==='vertex'){if(p[1]==='list')throw new Error('List properties on vertices are not supported.');props.push(p[2]);}}
  if(!Number.isInteger(n)||n<1||n>2000000)throw new Error('PLY must contain 1 to 2,000,000 vertices.');
  const idx=['x','y','z'].map(x=>props.indexOf(x));if(idx.some(i=>i<0))throw new Error('PLY vertices need x, y and z coordinates.');
  const ci=['red','green','blue'].map(x=>props.indexOf(x));const hasColour=ci.every(i=>i>=0);
  const lines=text.slice(end.index+end[0].length).trim().split(/\r?\n/);if(lines.length<n)throw new Error('PLY has fewer vertices than its header declares.');
  const stride=Math.ceil(n/MAX_POINTS);const points=[];const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];const rng=random(551);
  for(let i=0;i<n;i++){
    const a=lines[i].trim().split(/\s+/).map(Number);if(a.length<props.length)throw new Error(`Incomplete vertex ${i+1}.`);
    const xyz=idx.map(j=>a[j]);if(xyz.some(v=>!Number.isFinite(v)||Math.abs(v)>1e12))throw new Error(`Invalid coordinates at vertex ${i+1}.`);
    xyz.forEach((v,j)=>{lo[j]=Math.min(lo[j],v);hi[j]=Math.max(hi[j],v);});
    const rgb=hasColour?ci.map(j=>a[j]/255):[.75,.8,.83];if(rgb.some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error(`Invalid colour at vertex ${i+1}; use 0–255 RGB.`);
    if(i%stride===0)points.push(...xyz,...rgb,rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,rng());
  }
  const span=Math.max(...hi.map((v,j)=>v-lo[j]));if(span===0)throw new Error('All PLY points occupy the same position.');
  for(let i=0;i<points.length;i+=8)for(let j=0;j<3;j++)points[i+j]=(points[i+j]-(hi[j]+lo[j])/2)*2/span;
  return {points:new Float32Array(points),originalCount:n};
}
export function validateProject(project){
  if(!project||project.app!=='point-cloud-studio'||![1,2,3].includes(project.version))throw new Error('Use a Point Cloud Studio version 1, 2 or 3 project.');
  const settings=settingsFrom(project.settings,project.version<3);
  const c=project.camera;
  if(!c||!['yaw','pitch','distance','panX','panY'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k]))||Math.abs(c.yaw)>1000||Math.abs(c.pitch)>1.5||c.distance<1.4||c.distance>12||Math.abs(c.panX)>10||Math.abs(c.panY)>10)throw new Error('Invalid project camera.');
  if(typeof project.time!=='number'||!Number.isFinite(project.time)||project.time<0||project.time>1e7)throw new Error('Invalid project timeline.');
  const s=project.source;if(!s||!['demo','image','ply'].includes(s.kind)||typeof s.name!=='string'||s.name.length>256)throw new Error('Invalid project source.');
  const validImage=v=>typeof v==='string'&&v.length<18*1024*1024&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
  if(s.kind==='image'&&!validImage(s.data))throw new Error('Project must contain an embedded image.');
  if(s.kind==='ply'&&(typeof s.data!=='string'||s.data.length>40*1024*1024))throw new Error('Project point source is invalid.');
  if(project.depthMap!==null && project.depthMap!==undefined && !validImage(project.depthMap))throw new Error('Project depth map is invalid.');
  const timeline=project.version>=2?validateTimeline(project.timeline):{...emptyTimeline(),duration:Math.max(10,Math.min(60,Math.ceil(project.time)))};
  return {settings,camera:{...c},time:Math.min(project.time,timeline.duration),source:{kind:s.kind,name:s.name,data:s.data},depthMap:project.depthMap??null,timeline};
}
