import { AlertCircle, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";

interface InsufficientBalanceDialogProps {
  open: boolean;
  message?: string;
  onClose: () => void;
}

export function InsufficientBalanceDialog({
  open,
  message,
  onClose,
}: InsufficientBalanceDialogProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const goToDeposit = () => {
    onClose();
    navigate("/app/wallet?deposit=1");
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-red-500/40 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-full bg-red-500/15 p-2">
            <AlertCircle className="h-5 w-5 text-red-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              Insufficient Balance
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {message ||
                "Your wallet doesn't have enough ETH to complete this transaction. Please add more funds and try again."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1 bg-red-600 text-white hover:bg-red-700"
            onClick={goToDeposit}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Go to Deposit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
