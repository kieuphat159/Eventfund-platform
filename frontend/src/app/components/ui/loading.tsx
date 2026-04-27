import React from "react";

type LoadingProps = {
  visible: boolean;
  message?: string;
  // optional small overlay children (e.g., spinner extras)
  children?: React.ReactNode;
};

export const Loading: React.FC<LoadingProps> = ({
  visible,
  message = "Loading...",
  children,
}) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-lg p-6 w-full max-w-2xl flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full border-4 border-t-transparent border-purple-400 w-12 h-12" />
        <div className="w-full text-center break-words">
          <p className="font-semibold">{message}</p>
        </div>
        <div className="w-full max-h-[60vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
};

export default Loading;
