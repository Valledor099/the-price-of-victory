// Synthetic venue ambience, percussion and bell. No downloaded audio or samples.
export class Sound {
  enabled=true;
  async start(){
    if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
      const buf=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate), data=buf.getChannelData(0);
      let prev=0;for(let i=0;i<data.length;i++){prev=(prev+.04*(Math.random()*2-1))/1.04;data[i]=prev*5;}
      const noise=this.ctx.createBufferSource();noise.buffer=buf;noise.loop=true;
      const filter=this.ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=720;filter.Q.value=.6;
      this.crowd=this.ctx.createGain();this.crowd.gain.value=0;noise.connect(filter).connect(this.crowd).connect(this.master);noise.start();
    }
    await this.ctx.resume();this.volume();
  }
  volume(){if(this.master)this.master.gain.setTargetAtTime(this.enabled?.54:0,this.ctx.currentTime,.025);}
  ambience(level){if(this.crowd)this.crowd.gain.setTargetAtTime(level,this.ctx.currentTime,.18);}
  tone(freq,duration,level=.15,type='sine',end=freq){
    if(!this.ctx)return;const now=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(end,now+duration);
    g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(level,now+.008);g.gain.exponentialRampToValueAtTime(.001,now+duration);
    o.connect(g).connect(this.master);o.start();o.stop(now+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  bell(){[526,844,1177].forEach((f,i)=>this.tone(f,1.6-i*.28,.21/(i+1)));}
  beat(i){this.tone([110,110,146.8,130.8][i%4],.17,.11,'triangle',55);if(i%2===0)this.tone(64,.13,.25,'sine',34);}
}
