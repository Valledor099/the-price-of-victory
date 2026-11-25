// Recordings are bundled for offline playback. See credits in the README.
export class Sound {
  enabled = true;
  level = 0.65;
  crowdLevel = 0;

  async prepare() {
    const names = ['bell', 'crowd'];
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
    const [bell, crowd] = await Promise.all(['bell','crowd'].map(key => ctx.decodeAudioData(this.files[key].slice(0))));
    this.bellBuffer = bell;
    // Skip leading recording silence so the strike lands on the round boundary.
    const data = bell.getChannelData(0);
    let first = 0;
    while (first < data.length && Math.abs(data[first]) < 0.012) first++;
    this.bellOffset = Math.max(0, first / bell.sampleRate - 0.005);
    const room = ctx.createBufferSource();
    room.buffer = crowd;
    room.loop = true;
    // Crossfade the loop seam before it enters the room filter.
    const seam = Math.min(Math.floor(crowd.sampleRate * .5), Math.floor(crowd.length / 4));
    for (let ch=0; ch<crowd.numberOfChannels; ch++) {
      const channel = crowd.getChannelData(ch);
      for (let i=0; i<seam; i++) {
        const t=i/seam, index=crowd.length-seam+i;
        channel[index]=channel[index]*(1-t)+channel[i]*t;
      }
    }
    room.loopStart = seam/crowd.sampleRate;
    room.connect(this.venue);
    room.start();
    this.foley = ctx.createBuffer(1, Math.ceil(ctx.sampleRate*.14), ctx.sampleRate);
    const noise = this.foley.getChannelData(0);
    for(let i=0;i<noise.length;i++) noise[i]=Math.random()*2-1;
  }

  volume() {
    // Even at the maximum setting the post-limiter peak stays below 0.16 FS.
    this.master?.gain.setTargetAtTime(this.enabled ? .16*this.level : 0, this.ctx.currentTime, .025);
  }

  ambience(level) {
    this.crowdLevel = level;
    if (!this.venue) return;
    const gain = this.venue.gain, now=this.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value,now);
    gain.linearRampToValueAtTime(level,now+(level===0 ? .04 : .6));
  }

  bell() {
    if (!this.bellBuffer) return;
    const source=this.ctx.createBufferSource(), gain=this.ctx.createGain();
    source.buffer=this.bellBuffer;
    gain.gain.value=.88;
    source.connect(gain).connect(this.bus);
    source.start(0,this.bellOffset);
    source.onended=()=>{source.disconnect();gain.disconnect();};
  }

  contact(blocked=false) {
    if (!this.foley) return;
    const ctx=this.ctx, now=ctx.currentTime;
    const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), gain=ctx.createGain();
    source.buffer=this.foley;
    filter.type='lowpass';filter.frequency.value=blocked ? 390 : 620;filter.Q.value=.55;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(blocked ? .28 : .42,now+.005);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.13);
    source.connect(filter).connect(gain).connect(this.bus);
    source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
}
