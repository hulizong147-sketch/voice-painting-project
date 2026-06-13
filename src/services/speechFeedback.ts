let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

function speakWithBrowser(text: string) {
  if (!('speechSynthesis' in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export async function speakFeedback(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  stopCurrentAudio();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  try {
    const response = await fetch('/api/tts/baidu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    });
    if (!response.ok) {
      throw new Error('Baidu TTS request failed');
    }

    const audioBlob = await response.blob();
    if (!audioBlob.type.startsWith('audio/')) {
      throw new Error('Baidu TTS returned a non-audio response');
    }

    currentObjectUrl = URL.createObjectURL(audioBlob);
    currentAudio = new Audio(currentObjectUrl);
    currentAudio.onended = stopCurrentAudio;
    currentAudio.onerror = () => {
      stopCurrentAudio();
      speakWithBrowser(trimmed);
    };
    await currentAudio.play();
  } catch {
    stopCurrentAudio();
    speakWithBrowser(trimmed);
  }
}
