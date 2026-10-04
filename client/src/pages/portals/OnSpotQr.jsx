import React, { useState } from "react";
import toast from "react-hot-toast";
import { QRCodeCanvas } from "qrcode.react";
import Button from "../../components/ui/Button";
import { api } from "../../lib/api";

/**
 * The on-spot registration QR for the desk. Walk-up participants scan it and
 * register on the website: they can use the events' on-spot seats and pay in
 * cash here ("Cash received"). The link works only today (India time).
 */
export default function OnSpotQr() {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);

  const show = async () => {
    setLoading(true);
    try {
      setLink(await api.get("/api/registrations/onspot-link"));
    } catch (err) {
      toast.error(err.message || "Couldn’t load the on-spot link");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy - select the link and copy it.");
    }
  };

  const day = link && new Date(`${link.validOn}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <section className="mb-10 card p-5" aria-labelledby="onspot-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 id="onspot-title" className="font-heading font-semibold text-xl">On-spot registration</h2>
          <p className="text-sm text-shade/60 mt-1">
            Walk-up participants scan this QR and register on the website. They can use the seats kept for on-spot
            registration and pay in cash here: find them under <strong>On-spot</strong> and click <strong>Cash received</strong>.
          </p>
        </div>
        {!link && (
          <Button size="sm" onClick={show} disabled={loading} aria-busy={loading || undefined}>
            {loading ? "Loading…" : "Show on-spot QR"}
          </Button>
        )}
      </div>
      {link && (
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-6">
          <div className="rounded-[12px] bg-white" role="img" aria-label="On-spot registration QR code">
            <QRCodeCanvas value={link.url} size={220} level="M" includeMargin />
          </div>
          <div className="min-w-0 text-sm">
            <p className="text-heading font-semibold">Works only today, {day}.</p>
            <p className="text-shade/60 mt-1">Show it again tomorrow for a new one - yesterday’s QR stops working.</p>
            <p className="mt-3 font-mono text-[12px] break-all text-shade/70">{link.url}</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={copy}>Copy link</Button>
              <Button size="sm" variant="outline" onClick={() => setLink(null)}>Hide</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
