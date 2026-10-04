"use client";

// Inline AudioWorklet processor script that downsamples to 16kHz 16-bit PCM
const WORKLET_PROCESSOR_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetSampleRate = 16000;
    this.sourceSampleRate = options.processorOptions?.sampleRate || 48000;
    this.buffer = [];
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0];
    const ratio = this.sourceSampleRate / this.targetSampleRate;

    // Downsample using simple linear interpolation
    let srcIdx = 0;
    while (srcIdx < channelData.length) {
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(idx0 + 1, channelData.length - 1);
      const weight = srcIdx - idx0;
      const sample = channelData[idx0] * (1 - weight) + channelData[idx1] * weight;

      // Convert float sample (-1.0 to 1.0) to 16-bit signed integer
      const clamped = Math.max(-1, Math.min(1, sample));
      const pcm16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.buffer.push(Math.round(pcm16));
      srcIdx += ratio;
    }

    // Flush chunk every 1600 samples (100ms at 16kHz)
    if (this.buffer.length >= 1600) {
      const outArray = new Int16Array(this.buffer.splice(0, 1600));
      this.port.postMessage(outArray.buffer, [outArray.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class LiveAudioController {
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextPlayTime: number = 0;
  private onAudioChunkCallback: ((base64: string) => void) | null = null;
  private isCapturing: boolean = false;
  private isMuted: boolean = false;

  async startCapture(
    onChunk: (base64: string) => void,
  ): Promise<void> {
    this.onAudioChunkCallback = onChunk;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    this.mediaStream = stream;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    this.inputContext = new AudioContextClass();
    if (this.inputContext.state === "suspended") {
      await this.inputContext.resume();
    }

    // Load worklet processor via Blob URL
    const blob = new Blob([WORKLET_PROCESSOR_CODE], {
      type: "application/javascript",
    });
    const workletUrl = URL.createObjectURL(blob);

    try {
      await this.inputContext.audioWorklet.addModule(workletUrl);
      this.workletNode = new AudioWorkletNode(
        this.inputContext,
        "pcm-capture-processor",
        {
          processorOptions: {
            sampleRate: this.inputContext.sampleRate,
          },
        },
      );

      this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!this.isCapturing || this.isMuted) return;
        const base64 = arrayBufferToBase64(event.data);
        this.onAudioChunkCallback?.(base64);
      };

      this.sourceNode = this.inputContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.workletNode);
      this.isCapturing = true;
    } finally {
      URL.revokeObjectURL(workletUrl);
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  stopCapture(): void {
    this.isCapturing = false;
    this.isMuted = false;

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputContext) {
      this.inputContext.close().catch(() => {});
      this.inputContext = null;
    }

    this.onAudioChunkCallback = null;
  }

  private ensureOutputContext(): AudioContext {
    if (!this.outputContext || this.outputContext.state === "closed") {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.outputContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = 0;
    }
    if (this.outputContext.state === "suspended") {
      this.outputContext.resume().catch(() => {});
    }
    return this.outputContext;
  }

  playAudioChunk(base64Pcm: string): void {
    try {
      const buffer = base64ToArrayBuffer(base64Pcm);
      const int16Array = new Int16Array(buffer);
      if (int16Array.length === 0) return;

      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        const val = int16Array[i];
        float32Array[i] = val < 0 ? val / 0x8000 : val / 0x7fff;
      }

      const ctx = this.ensureOutputContext();
      const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
      };
    } catch (e) {
      console.error("Playback error:", e);
    }
  }

  stopPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source might have already ended
      }
    }
    this.activeSources.clear();
    if (this.outputContext) {
      this.nextPlayTime = this.outputContext.currentTime;
    } else {
      this.nextPlayTime = 0;
    }
  }

  close(): void {
    this.stopCapture();
    this.stopPlayback();
    if (this.outputContext) {
      this.outputContext.close().catch(() => {});
      this.outputContext = null;
    }
  }
}
