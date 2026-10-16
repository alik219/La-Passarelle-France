import { useCallback, useEffect, useRef, useState } from "react";
import { speak, type Speech } from "../api";
import type { MouthFrame } from "../components/Claire";

const CLOSED: MouthFrame = { open: 0, shape: "neutral" };

/** Mouth shape for a French word: rounded lips for o/u/ou sounds, wide for i/é. */
function shapeFor(word: string): MouthFrame["shape"] {
  const w = word.toLowerCase();
  if (/(ou|o|u|ô|eau|au)/.test(w)) return "round";
  if (/(i|é|è|ai|ei)/.test(w)) return "wide";
  return "neutral";
}

/**
 * Plays Claire's voice. One message at a time; audio is cached so replays are instant.
 * `speakingText` is the message currently being spoken (or loading), if any.
 * `mouth()` gives her mouth position for the current moment, for lip-sync.
 */
export function useTutorVoice() {
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<Speech | null>(null);
  const cache = useRef(new Map<string, Promise<Speech>>());
  const requestId = useRef(0);
  // Web Audio, used only to measure how loud she is at each moment.
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samples = useRef<Float32Array | null>(null);
  const routed = useRef(false); // is the current audio going through the analyser?

  const stop = useCallback(() => {
    requestId.current++;
    audioRef.current?.pause();
    audioRef.current = null;
    speechRef.current = null;
    setSpeakingText(null);
  }, []);

  /** Route the audio through an analyser if the browser allows it; otherwise play it directly. */
  async function attachAnalyser(audio: HTMLAudioElement) {
    routed.current = false;
    try {
      if (!ctxRef.current) {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        samples.current = new Float32Array(analyser.fftSize);
      }
      const ctx = ctxRef.current;
      if (ctx.state !== "running") await ctx.resume();
      // Only route through Web Audio when it's running, or she'd be silent.
      if (ctx.state === "running" && analyserRef.current) {
        ctx.createMediaElementSource(audio).connect(analyserRef.current);
        routed.current = true;
      }
    } catch {
      routed.current = false; // lip-sync falls back to word timings
    }
  }

  const play = useCallback(
    async (text: string) => {
      stop();
      const id = requestId.current;
      setSpeakingText(text);
      setError(null);
      try {
        let pending = cache.current.get(text);
        if (!pending) {
          pending = speak(text);
          cache.current.set(text, pending);
          pending.catch(() => cache.current.delete(text));
        }
        const speech = await pending;
        if (id !== requestId.current) return; // stopped or replaced while loading
        const audio = new Audio(`data:${speech.mime};base64,${speech.audio_b64}`);
        await attachAnalyser(audio);
        if (id !== requestId.current) return;
        audioRef.current = audio;
        speechRef.current = speech;
        audio.onended = () => {
          if (id !== requestId.current) return;
          speechRef.current = null;
          setSpeakingText(null);
        };
        await audio.play();
      } catch (e) {
        if (id !== requestId.current) return;
        setSpeakingText(null);
        // Browsers block sound until you've interacted with the page; that's not worth an error.
        if ((e as Error).name !== "NotAllowedError") setError((e as Error).message);
      }
    },
    [stop],
  );

  /** Where Claire's mouth should be right now (called every animation frame while she speaks). */
  const mouth = useCallback((): MouthFrame => {
    const audio = audioRef.current;
    const speech = speechRef.current;
    if (!audio || !speech || audio.paused) return CLOSED;

    // Which word is she on? (timings are in milliseconds from the start)
    const ms = audio.currentTime * 1000;
    let word = "";
    for (let i = 0; i < speech.wtimes.length; i++) {
      if (ms >= speech.wtimes[i] && ms <= speech.wtimes[i] + speech.wdurations[i]) {
        word = speech.words[i];
        break;
      }
    }
    const shape = word ? shapeFor(word) : "neutral";

    // Loudness drives how wide the mouth opens.
    if (routed.current && analyserRef.current && samples.current) {
      analyserRef.current.getFloatTimeDomainData(samples.current);
      let sum = 0;
      for (const s of samples.current) sum += s * s;
      const rms = Math.sqrt(sum / samples.current.length);
      return { open: Math.min(1, rms * 7), shape };
    }
    // No analyser: open and close in rhythm while inside a word.
    if (!word) return CLOSED;
    return { open: 0.35 + 0.35 * Math.abs(Math.sin(ms / 70)), shape };
  }, []);

  useEffect(() => stop, [stop]); // stop talking when leaving the page

  return { play, stop, mouth, speakingText, error };
}
