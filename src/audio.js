// Recordings are bundled for offline playback. See credits in the README.
export class Sound {
  enabled = true;
  level = 0.65;
  crowdLevel = 0;

  async prepare() {
    const names = ['bell', 'crowd', 'murmur', 'ovation'];
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
      this.cheerBus = ctx.createGain();
      this.cheerBus.connect(this.bus);
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
    const [bell, crowd, murmur, ovation] = await Promise.all(['bell','crowd','murmur','ovation'].map(key => ctx.decodeAudioData(this.files[key].slice(0))));
    this.bellBuffer = bell;
    this.ovation=ovation;
    const peakWindow=ovation.getChannelData(0);
    let sum=0;
    for(const sample of peakWindow)sum+=sample*sample;
    this.cheerGain=Math.min(5,.29/Math.max(.01,Math.sqrt(sum/peakWindow.length)));
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
    const voices=ctx.createBufferSource(), band=ctx.createBiquadFilter(), voicesGain=ctx.createGain();
    voices.buffer=murmur;voices.loop=true;
    band.type='bandpass';band.frequency.value=690;band.Q.value=.62;
    // Bring out the mass of voices behind the cheering; both feed the same silence envelope.
    const voiceData=murmur.getChannelData(0);
    let power=0;
    for(let i=0;i<voiceData.length;i++)power+=voiceData[i]*voiceData[i];
    voicesGain.gain.value=Math.min(3,.21/Math.max(.01,Math.sqrt(power/voiceData.length)));
    voices.connect(band).connect(voicesGain).connect(this.venue);
    voices.start();
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
    this.cheerBus.gain.cancelScheduledValues(now);
    this.cheerBus.gain.setTargetAtTime(level===0?0:1,now,.012);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value,now);
    gain.linearRampToValueAtTime(level,now+(level===0 ? .04 : .6));
  }

  cheer(victory=false) {
    if(!this.ovation)return;
    const ctx=this.ctx,now=ctx.currentTime,source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=this.ovation;
    const length=victory?4.85:3.25,peak=this.cheerGain*(victory?1.08:.88);
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(peak,now+.18);
    gain.gain.setValueAtTime(peak*.9,now+length*.60);
    gain.gain.exponentialRampToValueAtTime(.001,now+length);
    source.connect(gain).connect(this.cheerBus);
    source.start(now,victory?0:.55,length);
    source.onended=()=>{source.disconnect();gain.disconnect();};
  }

  screensOn() {
    if(!this.foley)return;
    const ctx=this.ctx,now=ctx.currentTime;
    const relay=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),tap=ctx.createGain();
    relay.buffer=this.foley;filter.type='bandpass';filter.frequency.value=940;filter.Q.value=.85;
    tap.gain.setValueAtTime(.32,now);tap.gain.exponentialRampToValueAtTime(.001,now+.065);
    relay.connect(filter).connect(tap).connect(this.bus);relay.start(now,0,.07);
    relay.onended=()=>{relay.disconnect();filter.disconnect();tap.disconnect();};
    const coil=ctx.createOscillator(),gain=ctx.createGain();
    coil.type='triangle';coil.frequency.setValueAtTime(115,now+.045);
    coil.frequency.exponentialRampToValueAtTime(430,now+.34);
    gain.gain.setValueAtTime(.0001,now+.045);gain.gain.linearRampToValueAtTime(.17,now+.13);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.68);
    coil.connect(gain).connect(this.bus);coil.start(now+.045);coil.stop(now+.68);
    coil.onended=()=>{coil.disconnect();gain.disconnect();};
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
