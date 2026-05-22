import { useState, useCallback, useEffect } from "react";

/**
 * Wraps children in a component that can be force remounted by dispatching
 * a "web3auth:remount" custom event. This resets all Web3Auth internal
 * state (iframes, hooks, provider) without a full page reload.
 */
export function RemountProvider({ children }: { children: React.ReactNode }) {
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    const handler = () => setMountKey(k => k + 1);
    window.addEventListener("web3auth:remount", handler);
    return () => window.removeEventListener("web3auth:remount", handler);
  }, []);

  const forceRemount = useCallback(() => {
    setMountKey(k => k + 1);
  }, []);

  // Expose via window so any code can call window.__forceRemountWeb3Auth()
  useEffect(() => {
    (window as any).__forceRemountWeb3Auth = forceRemount;
    return () => { delete (window as any).__forceRemountWeb3Auth; };
  }, [forceRemount]);

  // eslint-disable-next-line react/no-array-index-key
  return <div key={mountKey} style={{ display: "contents" }}>{children}</div>;
}
