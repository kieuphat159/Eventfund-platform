import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle, ArrowLeft } from "lucide-react";
import { depositService } from "../../services/deposit.service";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

export const DepositSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");

  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!orderId) {
      setStatus("failed");
      setError("Order ID not found");
      return;
    }

    pollOrderStatus();
  }, [orderId]);

  const pollOrderStatus = async () => {
    if (!orderId) return;

    try {
      // Poll order status every 3 seconds for up to 3 minutes
      const orderDetail = await depositService.pollOrderStatus(orderId, 60, 3000);

      if (orderDetail.status === "completed") {
        setStatus("success");
        setOrder(orderDetail);
      } else if (orderDetail.status === "failed") {
        setStatus("failed");
        setError(orderDetail.errorMessage || "Deposit failed");
      } else {
        setStatus("failed");
        setError("Deposit timeout");
      }
    } catch (err: any) {
      setStatus("failed");
      setError(err.message || "Failed to check order status");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardContent className="p-8">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="mb-4 h-16 w-16 animate-spin text-purple-500" />
              <h2 className="mb-2 text-xl font-semibold text-white">
                Đang xử lý giao dịch
              </h2>
              <p className="text-center text-sm text-slate-400">
                Vui lòng đợi trong khi chúng tôi xử lý giao dịch của bạn...
              </p>
              {orderId && (
                <p className="mt-4 text-xs text-slate-500">Order ID: {orderId}</p>
              )}
            </div>
          )}

          {status === "success" && order && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="mb-4 h-16 w-16 text-green-500" />
              <h2 className="mb-2 text-xl font-semibold text-white">
                Nạp tiền thành công!
              </h2>
              <p className="mb-6 text-center text-sm text-slate-400">
                {order.ethAmount} ETH đã được chuyển vào ví của bạn
              </p>

              <div className="w-full space-y-3 rounded-lg bg-slate-800 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Số tiền VND:</span>
                  <span className="font-medium text-white">
                    {order.vndAmount.toLocaleString("vi-VN")} VND
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Số ETH nhận:</span>
                  <span className="font-medium text-white">{order.ethAmount} ETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Tỷ giá:</span>
                  <span className="font-medium text-white">
                    {order.exchangeRate.toLocaleString("vi-VN")} VND/ETH
                  </span>
                </div>
                {order.transferTxHash && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">TX Hash:</span>
                    <a
                      href={`https://etherscan.io/tx/${order.transferTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-purple-400 hover:underline"
                    >
                      {order.transferTxHash.slice(0, 10)}...
                      {order.transferTxHash.slice(-8)}
                    </a>
                  </div>
                )}
              </div>

              <Button
                onClick={() => navigate("/user/wallet")}
                className="mt-6 w-full bg-purple-600 hover:bg-purple-700"
              >
                Về ví
              </Button>
            </div>
          )}

          {status === "failed" && (
            <div className="flex flex-col items-center justify-center py-8">
              <XCircle className="mb-4 h-16 w-16 text-red-500" />
              <h2 className="mb-2 text-xl font-semibold text-white">
                Giao dịch thất bại
              </h2>
              <p className="mb-6 text-center text-sm text-slate-400">{error}</p>

              <div className="flex w-full gap-3">
                <Button
                  onClick={() => navigate("/user/wallet")}
                  variant="outline"
                  className="flex-1 border-slate-700"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Về ví
                </Button>
                <Button
                  onClick={() => navigate("/user/wallet")}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Thử lại
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
