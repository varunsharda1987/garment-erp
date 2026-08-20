/**
 * useSpeechInput
 *
 * Browser speech-to-text via the Web Speech API (no backend, no API cost).
 * Supports Hindi (hi-IN) and English (en-IN).
 *
 * NOTE: browsers only allow the microphone on secure origins — this works on
 * http://localhost but on a LAN IP each PC needs the Chrome flag
 * chrome://flags/#unsafely-treat-insecure-origin-as-secure (or HTTPS).
 * `supported` is false when the API is unavailable so callers can hide the button.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// Minimal typings — the Web Speech API is not in the standard TS lib
interface SpeechRecognitionResultItem {
  transcript: string;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: SpeechRecognitionResultItem }>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type SpeechLang = 'hi-IN' | 'en-IN';

export function useSpeechInput(onTranscript: (text: string, isFinal: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<SpeechLang>('hi-IN');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const supported = typeof window !== 'undefined' && getSpeechRecognition() !== null && window.isSecureContext;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    setError(null);
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) onTranscriptRef.current(final, true);
      else if (interim) onTranscriptRef.current(interim, false);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone permission denied');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`Speech error: ${event.error}`);
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'));
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  return { supported, listening, lang, error, toggle, toggleLang, stop };
}
