import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface QrCodeProps {
  url: string;
  size?: number;
}

export function QrCode({ url, size = 140 }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: "#000", light: "#fff" },
    })
      .then(setDataUrl)
      .catch(() => {}); // silent fail
  }, [url, size]);

  async function handleDownload() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = dataUrl;
    link.click();
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
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
