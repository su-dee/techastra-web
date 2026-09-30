import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders `text` as a QR code data URL. Keep dark modules on a white
// background so every scanner can read it.
export function useQr(text, { size = 560, margin = 2, dark = "#0b0f0a" } = {}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!text) return;
    let active = true;
    QRCode.toDataURL(text, {
      width: size,
      margin,
      errorCorrectionLevel: "M",
      color: { dark, light: "#ffffff" },
    }).then((url) => active && setSrc(url));
    return () => {
      active = false;
    };
  }, [text, size, margin, dark]);
  return src;
}
