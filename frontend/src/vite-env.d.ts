/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "react-qr-scanner" {
  import type { ComponentType } from "react";

  interface QrScannerProps {
    delay?: number | false;
    facingMode?: "front" | "rear";
    onError?: (error: unknown) => void;
    onScan?: (result: string | null) => void;
    style?: Record<string, unknown>;
  }

  const QrScanner: ComponentType<QrScannerProps>;
  export default QrScanner;
}
