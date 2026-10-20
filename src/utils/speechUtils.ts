/**
 * Browser Speech Recognition and Audio Synthesis Utilities
 * Fully resilient with graceful degradation for unsupported browsers.
 */

// Speech Recognition Type Definitions
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

export interface SpeechRecognitionHandlers {
  onStart?: () => void;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string) => void;
  onEnd?: () => void;
}

export class VoiceDictationService {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor() {
    if (isSpeechRecognitionSupported()) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  public start(handlers: SpeechRecognitionHandlers): boolean {
    if (!this.recognition) {
      handlers.onError?.('Speech recognition is not supported in this browser. You can type directly.');
      return false;
    }

    if (this.isListening) {
      this.stop();
    }

    this.recognition.onstart = () => {
      this.isListening = true;
      handlers.onStart?.();
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const combined = finalTranscript || interimTranscript;
      handlers.onResult(combined, Boolean(finalTranscript));
    };

    this.recognition.onerror = (event: any) => {
      let msg = 'Speech recognition error occurred';
      if (event.error === 'not-allowed') {
        msg = 'Microphone permission denied. Please allow microphone access or type your decision.';
      } else if (event.error === 'no-speech') {
        msg = 'No speech detected. Please speak clearly into your microphone.';
      } else if (event.error === 'network') {
        msg = 'Speech recognition network service unavailable. Falling back to keyboard input.';
      }
      handlers.onError?.(msg);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
      handlers.onEnd?.();
    };

    try {
      this.recognition.start();
      return true;
    } catch (err: any) {
      console.warn('Speech recognition failed to start:', err);
      handlers.onError?.('Could not activate microphone. Please type your response.');
      this.isListening = false;
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  public get listening(): boolean {
    return this.isListening;
  }
}

/**
 * Text-to-Speech audio playback using the browser's native SpeechSynthesis API
 */
export function playAudioBroadcast(
  text: string, 
  onStart?: () => void, 
  onEnd?: () => void
): boolean {
  if (!isSpeechSynthesisSupported()) {
    console.warn('Speech synthesis unsupported');
    return false;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const cleanText = text.replace(/\[.*?\]/g, '').replace(/REP-[A-Z]+-\d+/g, 'Report');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 0.95; // Slightly lower tactical command pitch

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    utterance.onerror = (e) => {
      console.warn('Speech synthesis playback error', e);
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('Failed to play speech audio', err);
    onEnd?.();
    return false;
  }
}

export function stopAudioPlayback(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
