export const demoRecordingMode = import.meta.env.VITE_DEMO_RECORDING_MODE === 'true';

export const demoRecordingDelayMs = Number(import.meta.env.VITE_DEMO_RECORDING_DELAY_MS ?? 5000);

export const demoSquirrelImageUrl = import.meta.env.VITE_DEMO_SQUIRREL_IMAGE_URL ?? '/api/demo-assets/squirrel';

export const demoSquirrelHatImageUrl = import.meta.env.VITE_DEMO_SQUIRREL_HAT_IMAGE_URL ?? '/api/demo-assets/squirrel-hat';

export function isSquirrelPrompt(prompt: string) {
  return /松鼠|squirrel/i.test(prompt);
}

export function waitForDemoDelay() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, Math.max(0, demoRecordingDelayMs));
  });
}

