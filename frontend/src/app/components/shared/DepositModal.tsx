import { useState, useEffect } from "react";
import { X, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { depositService } from "../../services/deposit.service";
import { toast } from "sonner";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MIN_VND = 10000;
const MAX_VND = 50000000;

export function DepositModal({ isOpen, onClose, onSuccess }: DepositModalProps) {
  const [step, setStep] = useState<"input" | "processing" | "success" | "failed">("input");
  const [vndAmount, setVndAmount] = useState<string>("500000");
  const [ethAmount, setEthAmount] = useState<string>("0");
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Fetch exchange rate on mount
  useEffect(() => {
    if (isOpen) {
      fetchExchangeRate();
    }
  }, [isOpen]);

  // Calculate ETH amount when VND amount or rate changes
  useEffect(() => {
    if (exchangeRate > 0 && vndAmount) {
      const vnd = parseFloat(vndAmount);
      if (!isNaN(vnd)) {
        const eth = vnd / exchangeRate;
        setEthAmount(eth.toFixed(6));
      }
    }
  }, [vndAmount, exchangeRate]);

  const fetchExchangeRate = async () => {
    try {
      const rate = await depositService.getExchangeRate();
      setExchangeRate(rate.vndRate);
    } catch (err) {
      toast.error("Unable to fetch exchange rate. Please try again.");
      console.error(err);
    }
  };

  const handleVndAmountChange = (value: string) => {
    // Only allow numbers
    const cleaned = value.replace(/[^0-9]/g, "");
    setVndAmount(cleaned);
  };

  const formatVND = (amount: string) => {
    if (!amount) return "";
    return parseInt(amount).toLocaleString("vi-VN");
  };

  const handleDeposit = async () => {
    const vnd = parseInt(vndAmount);

    if (isNaN(vnd) || vnd < MIN_VND || vnd > MAX_VND) {
      toast.error(`Amount must be between ${MIN_VND.toLocaleString("en-US")} and ${MAX_VND.toLocaleString("en-US")} VND`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create deposit order
      const order = await depositService.createDepositOrder(vnd);
      setOrderId(order.orderId);

      // Redirect to VNPay
      window.location.href = order.vnpayUrl;
    } catch (err: any) {
      setError(err.message || "Unable to create deposit order");
      toast.error(err.message || "An error occurred");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step === "processing") {
      toast.warning("Transaction is being processed, please wait...");
      return;
    }
    resetModal();
    onClose();
  };

  const resetModal = () => {
    setStep("input");
    setVndAmount("500000");
    setEthAmount("0");
    setLoading(false);
    setOrderId("");
    setTxHash("");
    setError("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
          disabled={step === "processing"}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Deposit ETH</h2>
          <p className="text-sm text-gray-400">Deposit VND to receive ETH in your wallet</p>
        </div>

        {/* Input Step */}
        {step === "input" && (
          <div className="space-y-4">
            {/* VND Amount Input */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                VND Amount
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formatVND(vndAmount)}
                  onChange={(e) => handleVndAmountChange(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white focus:border-purple-500 focus:outline-none"
                  placeholder="500,000"
                />
                <span className="absolute right-4 top-3 text-gray-400">VND</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Minimum: {MIN_VND.toLocaleString("en-US")} VND
              </p>
            </div>

            {/* ETH Amount Display */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                ETH to Receive (estimated)
              </label>
              <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-white">{ethAmount} ETH</span>
                  {exchangeRate > 0 && (
                    <span className="text-xs text-gray-400">
                      1 ETH ≈ {exchangeRate.toLocaleString("en-US")} VND
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Info */}
            <div className="rounded-lg bg-purple-500/10 p-3 text-sm text-purple-300">
              <p className="font-medium">Note:</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-xs">
                <li>You will be redirected to VNPay payment page</li>
                <li>ETH will be transferred to your wallet after successful payment</li>
                <li>Order is valid for 15 minutes</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg border border-gray-700 px-4 py-3 font-medium text-gray-300 hover:bg-gray-800"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={loading || !vndAmount || exchangeRate === 0}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Pay Now"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-purple-500" />
            <h3 className="mb-2 text-lg font-semibold text-white">Processing Transaction</h3>
            <p className="text-center text-sm text-gray-400">
              Please wait while we process your transaction...
            </p>
            <p className="mt-4 text-xs text-gray-500">Order ID: {orderId}</p>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold text-white">Deposit Successful!</h3>
            <p className="mb-4 text-center text-sm text-gray-400">
              {ethAmount} ETH has been transferred to your wallet
            </p>
            {txHash && (
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:underline"
              >
                View transaction on Etherscan
              </a>
            )}
            <button
              onClick={() => {
                resetModal();
                onSuccess?.();
                onClose();
              }}
              className="mt-6 w-full rounded-lg bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700"
            >
              Close
            </button>
          </div>
        )}

        {/* Failed Step */}
        {step === "failed" && (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="mb-4 h-12 w-12 text-red-500" />
            <h3 className="mb-2 text-lg font-semibold text-white">Transaction Failed</h3>
            <p className="mb-4 text-center text-sm text-gray-400">{error}</p>
            <button
              onClick={resetModal}
              className="mt-6 w-full rounded-lg bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
