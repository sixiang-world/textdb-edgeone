import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface QrCodeProps {
  url: string;
  size?: number;
}

export function QrCode({ url, size = 130 }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState("");
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: "#000", light: "#fff" },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrError(false);
          setDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  async function handleDownload() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = dataUrl;
    link.click();
  }

  if (qrError) {
    return (
      <div
        className="rounded-lg border bg-muted/50 flex items-center justify-center text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        生成失败
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-lg border bg-white p-1.5 shadow-xs">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR: ${url}`}
            style={{ width: size - 12, height: size - 12 }}
            className="block"
          />
        ) : (
          <div
            className="animate-pulse bg-muted rounded-sm"
            style={{ width: size - 12, height: size - 12 }}
          />
        )}
      </div>
      <Button variant="ghost" size="xs" onClick={handleDownload} className="gap-1">
        <Download className="size-3" />
        下载
      </Button>
    </div>
  );
}
