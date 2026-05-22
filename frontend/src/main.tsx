/**
 * EventFund Platform - Frontend Application
 * Main entry point for the React application
 * 
 * 
 * 
 */

// Must be first — patches process.nextTick and other Node globals before
// Web3Auth / readable-stream bundles execute aa
import './polyfills'
import { createRoot } from "react-dom/client";
import { BrowserRouter } from 'react-router-dom';
import { Web3AuthProvider } from "@web3auth/modal/react";
import { web3AuthConfig } from "./app/web3auth.config";
import App from "./app/App.tsx";
import "./styles/index.css";
import { useState, useCallback, useEffect } from "react";

function Web3AuthRemountWrapper() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const handler = () => setKey(k => k + 1);
    window.addEventListener("web3auth:remount", handler);
    return () => window.removeEventListener("web3auth:remount", handler);
  }, []);

  const forceRemount = useCallback(() => {
    setKey(k => k + 1);
  }, []);

  useEffect(() => {
    (window as any).__forceRemountWeb3Auth = forceRemount;
    return () => { delete (window as any).__forceRemountWeb3Auth; };
  }, [forceRemount]);

  return (
    <Web3AuthProvider key={key} config={web3AuthConfig}>
      <App />
    </Web3AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Web3AuthRemountWrapper />
  </BrowserRouter>
);
