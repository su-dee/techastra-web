import React, { forwardRef, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import logo from "../assets/logo.webp";
import crest from "../assets/idcard/mgr-crest.png";
import naac from "../assets/idcard/naac-a-plus.png";
import decor from "../assets/idcard/card-decor.svg";

/**
 * Techastra '26 participant ID card - the organisers' dark + gold design
 * (id-template.png), built as a real component with the participant's data.
 *
 * Drawn at a fixed 400x600 (2:3) so the downloaded / printed image is
 * pixel-predictable (lib/idCardExport.js renders it at 4x); on narrow
 * screens the wrapper scales it down whole, so it never stretches or
 * reflows.
 *
 * Props: name, registrationNumber (college register no.), delegateId
 * (registration code), institution, qrValue (verification URL).
 */
export const CARD_W = 400;
export const CARD_H = 600;

const GOLD = "#ddbb6a";
const GOLD_DEEP = "#c9a24a";
const CREAM = "#f6edd8";

// Longer names get a smaller size so they wrap onto at most ~3 lines.
function nameSize(name) {
  const n = (name || "").length;
  if (n <= 12) return 36;
  if (n <= 18) return 31;
  if (n <= 26) return 26;
  if (n <= 36) return 22;
  return 19;
}
const valueSize = (v) => ((v || "").length > 14 ? 11.5 : (v || "").length > 10 ? 13.5 : 16);

function Field({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          lineHeight: 1.25,
          padding: "3px 12px",
          boxSizing: "border-box",
          borderRadius: 999,
          border: "1px solid rgba(221,187,106,0.55)",
          background: "rgba(255,255,255,0.05)",
          color: "#eadfc4",
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 7,
          lineHeight: 1.25,
          padding: "7px 6px",
          borderRadius: 8,
          background: "linear-gradient(180deg, #f7e8bb 0%, #e3c67c 50%, #c9a24a 100%)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          color: "#17130f",
          fontSize: valueSize(value),
          fontWeight: 700,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

const ParticipantIDCard = forwardRef(function ParticipantIDCard(
  { name, registrationNumber, delegateId, institution, qrValue },
  ref
) {
  // Scale the fixed-size card down to the available width (never up).
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / CARD_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} style={{ width: "100%", maxWidth: CARD_W, margin: "0 auto", height: CARD_H * scale }}>
      <div data-idcard-scale style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div
          ref={ref}
          role="img"
          aria-label={`Techastra '26 ID card for ${name || "participant"}, delegate ID ${delegateId || "pending"}`}
          style={{
            position: "relative",
            width: CARD_W,
            height: CARD_H,
            borderRadius: 18,
            overflow: "hidden",
            border: "1.5px solid #8a7340",
            background: "radial-gradient(ellipse at 50% 36%, #3a352e 0%, #2a2621 55%, #1f1c18 100%)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
            fontFamily: "'Space Grotesk', Helvetica, Arial, sans-serif",
            color: CREAM,
          }}
        >
          <img src={decor} alt="" style={{ position: "absolute", left: 0, top: 0, width: CARD_W, height: CARD_H }} />
          {/* inner hairline frame */}
          <div style={{ position: "absolute", left: 6, top: 6, right: 6, bottom: 6, borderRadius: 13, border: "1px solid rgba(221,187,106,0.35)" }} />

          {/* lanyard hole */}
          <div
            style={{
              position: "absolute",
              left: (CARD_W - 34) / 2,
              top: 14,
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `2px solid ${GOLD_DEEP}`,
              background: "#15120f",
              boxShadow: "inset 0 2px 5px rgba(0,0,0,0.8)",
            }}
          />

          {/* branding: institution (left) · NAAC (centre) · Techastra '26 (right) */}
          <div style={{ position: "absolute", left: 12, right: 10, top: 64, height: 76, display: "flex", alignItems: "center", gap: 5 }}>
            <img src={crest} alt="Dr. M.G.R. Educational and Research Institute" style={{ height: 60, width: "auto", flexShrink: 0 }} />
            <div style={{ width: 112, flexShrink: 0, whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 14, lineHeight: "16px", fontWeight: 700, color: CREAM, letterSpacing: "0.01em" }}>Dr.M.G.R.</div>
              <div style={{ fontSize: 5.3, lineHeight: "8px", fontWeight: 600, color: "#eee3c9" }}>EDUCATIONAL AND RESEARCH INSTITUTE</div>
              <div style={{ fontSize: 7.4, lineHeight: "10px", fontWeight: 700, color: GOLD, marginTop: 1 }}>DEEMED TO BE UNIVERSITY</div>
              <div style={{ display: "inline-block", marginTop: 2, lineHeight: 1.25, padding: "1px 3px", borderRadius: 2, background: "#f3ead6", color: "#221e1a", fontSize: 4.8, fontWeight: 700 }}>
                University with Graded Autonomy Status
              </div>
              <div style={{ fontSize: 4.6, lineHeight: "7px", color: "#d8cdb6", marginTop: 2 }}>(An ISO 21001 : 2018 Certified Institution)</div>
              <div style={{ fontSize: 4.1, lineHeight: "6px", color: "#cfc4ad", marginTop: 1 }}>Periyar E.V.R. High Road, Maduravoyal, Chennai-95. Tamilnadu, India.</div>
            </div>
            <img src={naac} alt="NAAC A+ accredited" style={{ width: 46, height: "auto", flexShrink: 0 }} />
            <img src={logo} alt="Techastra '26 - Vision, 18th National Level Technical Symposium" style={{ width: 150, height: "auto", flexShrink: 0, marginLeft: 2 }} />
          </div>

          {/* QR: gold frame, cream plate */}
          <div
            style={{
              position: "absolute",
              left: (CARD_W - 212) / 2,
              top: 170,
              width: 212,
              height: 212,
              padding: 7,
              borderRadius: 20,
              background: "linear-gradient(135deg, #f3dd9c 0%, #c9a24a 45%, #7d5f1a 100%)",
              boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 14,
                background: "#f7f1e3",
                border: "2px solid #1c1915",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {qrValue ? (
                // Drawn at 4x and shown at 164px, so the 4x download/print stays sharp.
                <QRCodeCanvas value={qrValue} size={656} level="M" fgColor="#111111" bgColor="#f7f1e3" style={{ width: 164, height: 164 }} />
              ) : (
                <span style={{ color: "#555", fontSize: 12 }}>QR pending</span>
              )}
            </div>
          </div>

          {/* gold rule above the name panel */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 404,
              height: 2,
              background: "linear-gradient(90deg, rgba(201,162,74,0.25), #ddbb6a 20%, #ddbb6a 80%, rgba(201,162,74,0.25))",
            }}
          />

          {/* name panel */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 406,
              bottom: 0,
              background: "linear-gradient(180deg, #2c2823 0%, #221e1a 100%)",
              display: "flex",
              alignItems: "center",
              padding: "18px 20px 22px 26px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: nameSize(name),
                  fontWeight: 700,
                  lineHeight: 1.04,
                  letterSpacing: "-0.01em",
                  color: CREAM,
                  wordBreak: "break-word",
                }}
              >
                {name || "Participant"}
              </div>
              <div style={{ marginTop: 12, height: 1.5, background: "linear-gradient(90deg, #ddbb6a, rgba(221,187,106,0.15))" }} />
              <div
                style={{
                  marginTop: 9,
                  fontSize: (institution || "").length > 60 ? 9.5 : 11,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#d8cdb6",
                  wordBreak: "break-word",
                }}
              >
                {institution || "—"}
              </div>
            </div>
            <div style={{ width: 1.5, alignSelf: "stretch", margin: "4px 16px", background: "linear-gradient(180deg, rgba(221,187,106,0.1), #c9a24a 30%, #c9a24a 70%, rgba(221,187,106,0.1))" }} />
            <div style={{ width: 132, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Registration No." value={registrationNumber} />
              <Field label="Delegate ID" value={delegateId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ParticipantIDCard;
