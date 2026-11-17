// @synapxlab/wysiwyg — src/speech.ts
// Lecture audio du contenu via l'API Web SpeechSynthesis (zéro dépendance).

/** Lecteur audio minimaliste : lit un texte, s'arrête, notifie son état. */
export class SpeechReader {
  private utterance: SpeechSynthesisUtterance | null = null;
  private _speaking = false;

  /** Callback déclenché à chaque changement d'état lecture/arrêt. */
  onStateChange?: (speaking: boolean) => void;

  constructor(private lang?: string) {}

  /** `true` si l'API SpeechSynthesis est disponible dans ce navigateur. */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get speaking(): boolean {
    return this._speaking;
  }

  /** Lit le texte fourni (interrompt une lecture en cours). */
  speak(text: string): void {
    if (!SpeechReader.isSupported()) return;
    this.stop();
    const clean = text.trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = this.lang || document.documentElement.lang || navigator.language || 'fr-FR';
    u.onend = () => this.setSpeaking(false);
    u.onerror = () => this.setSpeaking(false);
    this.utterance = u;
    this.setSpeaking(true);
    window.speechSynthesis.speak(u);
  }

  /** Arrête la lecture en cours. */
  stop(): void {
    if (!SpeechReader.isSupported()) return;
    window.speechSynthesis.cancel();
    this.utterance = null;
    this.setSpeaking(false);
  }

  /** Alterne lecture / arrêt. */
  toggle(text: string): void {
    if (this._speaking) this.stop();
    else this.speak(text);
  }

  private setSpeaking(value: boolean): void {
    if (this._speaking === value) return;
    this._speaking = value;
    this.onStateChange?.(value);
  }
}
