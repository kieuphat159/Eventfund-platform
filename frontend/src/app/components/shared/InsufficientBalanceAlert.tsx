import { AlertCircle } from "lucide-react";
import { Button } from "../ui/button";

interface InsufficientBalanceAlertProps {
  required: string; // Wei amount required
  current: string; // Wei amount current
  onDeposit: () => void;
}

export function InsufficientBalanceAlert({
  required,
  current,
  onDeposit,
}: InsufficientBalanceAlertProps) {
  const requiredBigInt = BigInt(required);
  const currentBigInt = BigInt(current);
  const shortfall = requiredBigInt - currentBigInt;

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-400 mb-1">Số dư không đủ</h3>
          <p className="text-sm text-red-300 mb-3">
            Bạn cần thêm {shortfall.toString()} wei để thực hiện giao dịch này.
          </p>
          <Button
            onClick={onDeposit}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Nạp tiền ngay
          </Button>
        </div>
      </div>
    </div>
  );
}
