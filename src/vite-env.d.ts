/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_RECORDING_MODE?: string;
  readonly VITE_DEMO_RECORDING_DELAY_MS?: string;
  readonly VITE_DEMO_SQUIRREL_IMAGE_URL?: string;
  readonly VITE_DEMO_SQUIRREL_HAT_IMAGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
