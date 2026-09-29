import React, { useState, useEffect } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Label, Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { fadeUp, staggerContainer, EASE_CINEMATIC } from "../lib/motion";
import { usePanels } from "../context/PanelContext";

/**
 * Minimal, borderless cinematic layout replacing the old boxed-Card
 * form - plain typography over the dark base, result revealed inline
 * beneath the form with a thin divider rather than a second card.
 */
export default function Status() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  // Right after registering, the email arrives in navigation state (never in
  // the URL), so the status shows without retyping.
  const { state } = useLocation();
  const { openPanel } = usePanels();
  const [email, setEmail] = useState(state?.email || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const reduce = useReducedMotion();

  const check = async (e) => {
    e?.preventDefault();
    if (!code.trim() || !email.trim()) return toast.error("Enter your registration code and the email you registered with");
    setLoading(true);
    setResult(null);
    try {
      const data = await api.get(
        `/api/registrations/status?code=${encodeURIComponent(code.trim())}&email=${encodeURIComponent(email.trim())}`
      );
      setResult(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get("code") && state?.email) check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <motion.div
        className="text-center mb-12"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_CINEMATIC }}
      >
        <p className="kicker">Registration status</p>
        <h1 className="h2">Check your registration</h1>
        <p className="lead mt-3">Enter your registration code and the email you registered with.</p>
      </motion.div>

      {/* Form fields cascade in with a light stagger */}
      <motion.form
        onSubmit={check}
        className="space-y-5"
        variants={staggerContainer}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <Label htmlFor="code">Registration Code</Label>
          <Input id="code" placeholder="SYM2026-0042" autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Checking…" : "Check status"}
          </Button>
          <p className="text-center text-[13px] text-dim mt-4">
            Lost your registration code?{" "}
            <button type="button" className="link-cta" onClick={() => openPanel("help")}>
              Ask the Help Desk
            </button>
          </p>
        </motion.div>
      </motion.form>

      {/* Result reveals/dismisses smoothly as it arrives or is replaced */}
      <div role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.registrationCode}
            className="mt-12 pt-8 border-t border-crimson/15"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: EASE_CINEMATIC }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-heading text-lg text-offwhite">{result.registrationCode}</span>
              <Badge status={result.status}>{result.status}</Badge>
            </div>
            <p className="text-sm text-soft">Total paid: ₹{result.totalAmount}</p>
            {result.status === "rejected" && result.rejectionReason && (
              <p className="text-sm text-danger mt-3">Reason: {result.rejectionReason}</p>
            )}
            {result.status === "approved" && (
              <div className="mt-6">
                <Link to="/login">
                  <Button className="w-full">Sign in to get your ID card</Button>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
