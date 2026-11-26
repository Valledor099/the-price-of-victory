// Recordings are bundled for offline playback. See credits in the README.
export class Sound {
  enabled = true;
  level = 0.72;
  crowdLevel = 0;
  applauseMoment = null;

  async prepare() {
    const names = ['bell', 'murmur', 'applause', 'despues-de-la-campana', 'televisor'];
    this.files = Object.fromEntries(await Promise.all(names.map(async name => {
      const response = await fetch('assets/' + name + '.mp3');
      if (!response.ok) throw Error('No se pudo cargar el sonido de ' + name);
      return [name, await response.arrayBuffer()];
    })));
  }

  async start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const ctx = this.ctx;
      this.bus = ctx.createGain();
      const limiter = ctx.createWaveShaper();
      limiter.curve = Float32Array.from({length: 1025}, (_, i) => Math.tanh(1.4 * (2*i/1024-1)));
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.bus.connect(limiter).connect(this.master).connect(ctx.destination);
      this.venue = ctx.createGain();
      this.venue.gain.value = 0;
      const distant = ctx.createBiquadFilter();
      distant.type = 'lowpass';
      distant.frequency.value = 2300;
      this.venue.connect(distant).connect(this.bus);
      this.loading = this.loadSamples();
    }
    await this.ctx.resume();
    this.volume();
    await this.loading;
    this.ambience(this.crowdLevel);
  }

  async loadSamples() {
    const ctx = this.ctx;
    const [bell, murmur, applause, score, television] = await Promise.all(['bell','murmur','applause','despues-de-la-campana','televisor'].map(key => ctx.decodeAudioData(this.files[key].slice(0))));
    this.bellBuffer = bell;
    this.score=score;this.television=television;
    // Overlap the ends of the continuous clapping so a slow walk can last any length.
    const rate=applause.sampleRate, length=Math.floor(4.5*rate), seam=Math.floor(.28*rate), from=Math.floor(.65*rate);
    this.claps=ctx.createBuffer(applause.numberOfChannels,length,rate);
    for(let ch=0;ch<applause.numberOfChannels;ch++){
      const input=applause.getChannelData(ch),out=this.claps.getChannelData(ch);
      out.set(input.subarray(from,from+length));
      for(let i=0;i<seam;i++){
        const a=i/seam*Math.PI/2;
        out[i]=input[from+length+i]*Math.cos(a)+out[i]*Math.sin(a);
      }
    }
    const peakWindow=applause.getChannelData(0);
    let sum=0;
    for(const sample of peakWindow)sum+=sample*sample;
    this.applauseGain=Math.min(3,.119/Math.max(.01,Math.sqrt(sum/peakWindow.length)));
    this.playApplause();
    // Skip leading recording silence so the strike lands on the round boundary.
    const data = bell.getChannelData(0);
    let first = 0;
    while (first < data.length && Math.abs(data[first]) < 0.012) first++;
    this.bellOffset = Math.max(0, first / bell.sampleRate - 0.005);
    const voices=ctx.createBufferSource(), band=ctx.createBiquadFilter(), voicesGain=ctx.createGain();
    voices.buffer=murmur;voices.loop=true;
    band.type='bandpass';band.frequency.value=690;band.Q.value=.62;
    // Bring out the mass of voices while the player is in the tunnel and ring.
    const voiceData=murmur.getChannelData(0);
    let power=0;
    for(let i=0;i<voiceData.length;i++)power+=voiceData[i]*voiceData[i];
    voicesGain.gain.value=Math.min(3,.23/Math.max(.01,Math.sqrt(power/voiceData.length)));
    voices.connect(band).connect(voicesGain).connect(this.venue);
    voices.start();
    this.foley = ctx.createBuffer(1, Math.ceil(ctx.sampleRate*.14), ctx.sampleRate);
    const noise = this.foley.getChannelData(0);
    for(let i=0;i<noise.length;i++) noise[i]=Math.random()*2-1;
  }

  volume() {
    // All venue cues, music and impacts share the master and its peak limiter.
    this.master?.gain.setTargetAtTime(this.enabled ? .40*this.level : 0, this.ctx.currentTime, .025);
  }

  ambience(level) {
    this.crowdLevel = level;
    if (!this.venue) return;
    const gain = this.venue.gain, now=this.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value,now);
    gain.linearRampToValueAtTime(level,now+(level===0 ? .04 : .6));
  }

  setApplause(moment, fade=.035) {
    if(moment===this.applauseMoment)return;
    this.applauseMoment=moment;
    if(this.applause){
      const {sources,gain,start,level}=this.applause,now=this.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(level*Math.min(1,(now-start)/.42),now);
      gain.gain.linearRampToValueAtTime(0,now+fade);
      for(const source of sources)source.stop(now+fade);
      this.applause=null;
    }
    this.playApplause();
  }

  playApplause() {
    if(!this.claps||!this.applauseMoment||this.applause)return;
    const ctx=this.ctx,now=ctx.currentTime,gain=ctx.createGain(),sources=[];
    let playing=2;
    const level=this.applauseGain*(this.applauseMoment==='title'?1.08:1);
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(level,now+.42);
    // Tame sharp individual claps without pulling down the bell or the voices.
    const cushion=ctx.createWaveShaper();
    cushion.curve=Float32Array.from({length:1025},(_,i)=>.34*Math.tanh((i/512-1)/.34));
    gain.connect(cushion).connect(this.bus);
    for(const [pan,offset,weight] of [[-.48,0,.82],[.58,1.27,.64]]){
      const source=ctx.createBufferSource(),trim=ctx.createGain(),place=ctx.createStereoPanner();
      source.buffer=this.claps;source.loop=true;trim.gain.value=weight;place.pan.value=pan;
      source.connect(trim).connect(place).connect(gain);sources.push(source);
      source.onended=()=>{source.disconnect();trim.disconnect();place.disconnect();if(--playing===0){gain.disconnect();cushion.disconnect();}};
      source.start(now,offset);
    }
    this.applause={sources,gain,start:now,level};
  }

  startScore(){
    if(!this.score||this.music)return;
    const ctx=this.ctx,source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=this.score;
    gain.gain.setValueAtTime(0,ctx.currentTime);
    gain.gain.linearRampToValueAtTime(.57,ctx.currentTime+1.8);
    source.connect(gain).connect(this.bus);
    this.music={source,gain};
    source.onended=()=>{source.disconnect();gain.disconnect();if(this.music?.source===source)this.music=null;};
    source.start();
  }
  stopScore(){
    if(!this.music)return;
    const {source,gain}=this.music,now=this.ctx.currentTime;
    this.music=null;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(0,now,.045);
    source.stop(now+.24);
  }

  screensOn() {
    if(!this.television)return;
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
    source.buffer=this.television;gain.gain.value=.87;
    source.connect(gain).connect(this.bus);source.start();
    source.onended=()=>{source.disconnect();gain.disconnect();};
  }

  bell() {
    if (!this.bellBuffer) return;
    const source=this.ctx.createBufferSource(), gain=this.ctx.createGain();
    source.buffer=this.bellBuffer;
    gain.gain.value=.40;
    source.connect(gain).connect(this.bus);
    source.start(0,this.bellOffset);
    source.onended=()=>{source.disconnect();gain.disconnect();};
  }

  contact(blocked=false,kind='jab') {
    if (!this.foley) return;
    const ctx=this.ctx, now=ctx.currentTime;
    const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain();
    source.buffer=this.foley;
    filter.type='lowpass';filter.frequency.value=blocked ? 390 : kind==='uppercut'?430:790;filter.Q.value=.55;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(blocked ? .12 : kind==='uppercut'?.26:.20,now+.005);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.13);
    source.connect(filter).connect(gain).connect(this.bus);
    source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
}
