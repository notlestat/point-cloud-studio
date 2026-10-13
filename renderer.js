// Column-major Rz * Ry * Rx, applied around the source origin before camera orbit.
export function rotationMatrix(x=0,y=0,z=0){
 const radians=v=>(v%360)*Math.PI/180;
 const cx=Math.cos(radians(x)),sx=Math.sin(radians(x)),cy=Math.cos(radians(y)),sy=Math.sin(radians(y)),cz=Math.cos(radians(z)),sz=Math.sin(radians(z));
 return new Float32Array([cz*cy,sz*cy,-sy,cz*sy*sx-sz*cx,sz*sy*sx+cz*cx,cy*sx,cz*sy*cx+sz*sx,sz*sy*cx-cz*sx,cy*cx]);
}
const VERTEX=`#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aColour;in float aLight;in float aSeed;
uniform float uYaw,uPitch,uDistance,uAspect,uDepth,uInvert,uSize,uOpacity,uThreshold,uColour,uScatter,uWave,uTime,uEnergy,uScale;
uniform vec2 uPan;uniform float uEcho;
uniform mat3 uRotation;
out vec4 vColour;
void main(){
 vec3 p=aPosition;p.z*=uDepth*uInvert;
 float t=uTime;float s=aSeed*173.0;
 p+=vec3(sin(s*3.1),cos(s*4.7),sin(s*7.3))*uScatter;
 p.z+=sin(p.x*7.0+t*2.0+s*.03)*cos(p.y*5.0-t)*uWave;
 p*=1.0+uEnergy*.12;
 p+=vec3(sin(s+t),cos(s*1.3+t),sin(s*2.1-t))*uEnergy*.045;p.x+=uEcho;
 p=uRotation*p;
 float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
 p=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);
 p=vec3(p.x,cp*p.y-sp*p.z,sp*p.y+cp*p.z);
 p.xy+=uPan;float z=uDistance-p.z;
 float near=.05,far=30.0,f=1.85;
 gl_Position=vec4(p.x*f/uAspect,p.y*f,(far+near)/(far-near)*z-2.0*far*near/(far-near),z);
 gl_PointSize=clamp(uSize*uScale*3.0/max(z,.1),.5,48.0);
 vec3 colour=aColour;
 if(uColour>1.5)colour=vec3(.64,.88,.96)*(0.35+0.65*aLight);
 else if(uColour>.5)colour=vec3(.94,.95,.91)*(0.35+0.65*aLight);
 float alpha=aLight<uThreshold?0.0:uOpacity;
 vColour=vec4(colour,alpha);
}`;
const FRAGMENT=`#version 300 es
precision highp float;in vec4 vColour;out vec4 outColour;
void main(){float r=length(gl_PointCoord-.5)*2.0;if(r>1.0||vColour.a==0.0)discard;float a=(1.0-smoothstep(.45,1.0,r))*vColour.a;outColour=vec4(vColour.rgb,a);}`;
export class PointRenderer {
 constructor(canvas){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true,alpha:false});
  if(!gl)throw new Error('This browser cannot start WebGL2. Try Chrome or Safari with graphics acceleration enabled.');
  const compile=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};
  const program=this.program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  this.buffer=gl.createBuffer();this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [name,n,offset] of [['aPosition',3,0],['aColour',3,12],['aLight',1,24],['aSeed',1,28]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,32,offset);}
  this.uniforms={};for(const key of ['Yaw','Pitch','Distance','Aspect','Depth','Invert','Size','Opacity','Threshold','Colour','Scatter','Wave','Time','Energy','Scale','Pan','Echo'])this.uniforms[key]=gl.getUniformLocation(program,'u'+key);
  this.uniforms.Rotation=gl.getUniformLocation(program,'uRotation');
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,1);this.count=0;
 }
 setPoints(points){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);this.count=points.length/8;}
 draw(settings,camera,time,energy=0,width=null,height=null,motionPhase=null){
  const gl=this.gl,canvas=this.canvas;const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  width=width??Math.max(1,Math.round(rect.width*dpr));height=height??Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.bindVertexArray(this.vao);
  const values={Yaw:camera.yaw,Pitch:camera.pitch,Distance:camera.distance,Aspect:width/height,Depth:settings.depth,Invert:settings.invert?-1:1,Size:settings.size,Opacity:settings.opacity,Threshold:settings.threshold,Colour:settings.colour,Scatter:settings.scatter,Wave:settings.wave,Time:motionPhase??time*settings.speed,Energy:energy*settings.response,Scale:height/760};
  for(const [key,value]of Object.entries(values))gl.uniform1f(this.uniforms[key],value);
  gl.uniform2f(this.uniforms.Pan,camera.panX,camera.panY);
  gl.uniformMatrix3fv(this.uniforms.Rotation,false,rotationMatrix(settings.rotationX,settings.rotationY,settings.rotationZ));
  for(let i=0;i<settings.echoes;i++){gl.uniform1f(this.uniforms.Echo,(i-(settings.echoes-1)/2)*settings.spacing);gl.drawArrays(gl.POINTS,0,this.count);}
 }
 destroy(){this.gl.deleteBuffer(this.buffer);this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
