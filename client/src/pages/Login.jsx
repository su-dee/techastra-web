import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { Input, Label } from "../components/ui/Input";
import { PORTAL_PATH } from "../lib/site";
import logo from "../assets/logo-sm.webp";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}`);
      navigate(PORTAL_PATH[user.role] || "/dashboard");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-4 py-16" style={{ minHeight: "calc(100vh - var(--nav-h))" }}>
      <div className="modal__panel modal__panel--sm !animate-none !max-h-none">
        <img src={logo} alt="Techastra ’26" className="h-10 w-auto mb-8" />
        <div className="kicker">Portal login</div>
        <h1 className="modal__title">Sign in</h1>
        <p className="lead !text-[14.5px] mt-2">
          For participants with an approved registration, and for event staff.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-small w-full !py-3.5 !text-[15px] disabled:opacity-60" disabled={loading} data-log="login-submit">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-7 pt-5 border-t border-line flex flex-wrap justify-between gap-3 text-[13.5px]">
          <Link className="link-cta" to="/status">Check registration status</Link>
          <Link className="link-cta" to="/events">Browse events</Link>
        </div>
      </div>
    </div>
  );
}
