// src/env.d.ts

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // Add more VITE_ prefixed variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
