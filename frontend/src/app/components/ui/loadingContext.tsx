import React, { createContext, useContext, useState } from "react";
import Loading from "./loading";

type LoadingContextType = {
  show: (message?: string) => void;
  hide: () => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(
  undefined,
);

export const LoadingProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | undefined>("Loading...");

  const show = (msg?: string) => {
    setMessage(msg ?? "Loading...");
    setVisible(true);
  };

  const hide = () => setVisible(false);

  return (
    <LoadingContext.Provider value={{ show, hide }}>
      {children}
      <Loading visible={visible} message={message} />
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
};

export default LoadingContext;
