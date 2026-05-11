import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_signature: "Invalid signature",
  payment_failed: "Payment failed",
  unknown_error: "Unknown error",
};

export const DepositFailed = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId = searchParams.get("orderId");
  const reason = searchParams.get("reason") || "unknown_error";
  const code = searchParams.get("code");

  const errorMessage = ERROR_MESSAGES[reason] || ERROR_MESSAGES.unknown_error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="mb-4 h-16 w-16 text-red-500" />
            <h2 className="mb-2 text-xl font-semibold text-white">
              Payment Failed
            </h2>
            <p className="mb-6 text-center text-sm text-slate-400">{errorMessage}</p>

            {orderId && (
              <div className="mb-6 w-full rounded-lg bg-slate-800 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Order ID:</span>
                  <span className="font-mono text-xs text-white">{orderId}</span>
                </div>
                {code && (
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-slate-400">Error Code:</span>
                    <span className="font-mono text-xs text-white">{code}</span>
                  </div>
                )}
              </div>
            )}

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
        </CardContent>
      </Card>
    </div>
  );
};
