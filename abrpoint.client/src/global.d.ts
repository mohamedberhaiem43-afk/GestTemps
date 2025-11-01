export {};

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: {
      API_URL?: string;
      VITE_REACT_APP_API_URL?: string;
    };
  }
}
