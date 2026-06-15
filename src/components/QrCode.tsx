import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface QrCodeProps {
  url: string;
  size?: number;
}

export function QrCode({ url, size = 140 }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState("");
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!url) return;
    setQrError(false);
    setDataUrl("");
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: "#000", light: "#fff" },
    })
      .then(setDataUrl)
      .catch(() => setQrError(true));
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
        className="rounded-md border bg-muted flex items-center justify-center text-sm text-muted-foreground"
        style={{ width: size, height: size }}
      >
        二维码生成失败
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {dataUrl ? (
        <>
          <img
            src={dataUrl}
            alt={`QR: ${url}`}
            className="rounded-md border bg-white"
            style={{ width: size, height: size }}
          />
          <Button variant="ghost" size="xs" onClick={handleDownload}>
            <Download className="size-3" />
            下载
          </Button>
        </>
      ) : (
        <div
          className="rounded-md border bg-muted animate-pulse"
          style={{ width: size, height: size }}
        />
      )}
    </div>
  );
}
