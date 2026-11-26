// Recordings are bundled for offline playback. See credits in the README.
export class Sound {
  enabled = true;
  level = 0.72;
  crowdLevel = 0;

  async prepare() {
    const names = ['bell', 'murmur', 'applause', 'despues-de-la-campana'];
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
      this.applauseBus = ctx.createGain();
      this.applauseBus.connect(this.bus);
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
    const [bell, murmur, applause, score] = await Promise.all(['bell','murmur','applause','despues-de-la-campana'].map(key => ctx.decodeAudioData(this.files[key].slice(0))));
    this.bellBuffer = bell;
    this.claps=applause;this.score=score;
    const peakWindow=applause.getChannelData(0);
    let sum=0;
    for(const sample of peakWindow)sum+=sample*sample;
    this.applauseGain=Math.min(8,.41/Math.max(.01,Math.sqrt(sum/peakWindow.length)));
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
    this.applauseBus.gain.cancelScheduledValues(now);
    this.applauseBus.gain.setTargetAtTime(level===0?0:1,now,.012);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value,now);
    gain.linearRampToValueAtTime(level,now+(level===0 ? .04 : .6));
  }

  applaud(moment='entry') {
    if(!this.claps)return;
    const ctx=this.ctx,now=ctx.currentTime,title=moment==='title',rally=moment==='rally';
    const length=title?7.3:rally?1.45:4.5,level=this.applauseGain*(title?1.16:rally?.47:1);
    // Offset the two stands in space and time so the applause surrounds the ring.
    for(const [pan,delay,offset,weight] of [[-.48,0,.18,.82],[.58,.14,1.0,.64]]){
      const source=ctx.createBufferSource(),gain=ctx.createGain(),place=ctx.createStereoPanner();
      source.buffer=this.claps;source.loop=title;source.loopStart=.5;source.loopEnd=5.5;
      place.pan.value=pan;
      const start=now+delay,peak=level*weight;
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.linearRampToValueAtTime(peak,start+.16);
      gain.gain.setValueAtTime(peak*.86,start+length*.66);
      gain.gain.exponentialRampToValueAtTime(.0001,start+length);
      source.connect(gain).connect(place).connect(this.applauseBus);
      source.start(start,offset);source.stop(start+length);
      source.onended=()=>{source.disconnect();gain.disconnect();place.disconnect();};
    }
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
    if(!this.foley)return;
    const ctx=this.ctx,now=ctx.currentTime;
    const relay=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),tap=ctx.createGain();
    relay.buffer=this.foley;filter.type='bandpass';filter.frequency.value=940;filter.Q.value=.85;
    tap.gain.setValueAtTime(.17,now);tap.gain.exponentialRampToValueAtTime(.001,now+.065);
    relay.connect(filter).connect(tap).connect(this.bus);relay.start(now,0,.07);
    relay.onended=()=>{relay.disconnect();filter.disconnect();tap.disconnect();};
    const coil=ctx.createOscillator(),gain=ctx.createGain();
    coil.type='triangle';coil.frequency.setValueAtTime(115,now+.045);
    coil.frequency.exponentialRampToValueAtTime(430,now+.34);
    gain.gain.setValueAtTime(.0001,now+.045);gain.gain.linearRampToValueAtTime(.10,now+.13);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.68);
    coil.connect(gain).connect(this.bus);coil.start(now+.045);coil.stop(now+.68);
    coil.onended=()=>{coil.disconnect();gain.disconnect();};
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
