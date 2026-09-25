import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import HelpDeskPanel from "./components/panels/HelpDeskPanel";

// The landing page ships in the main bundle; every other route is its own
// chunk, fetched the first time it's visited, so portal-only libraries
// (recharts, jspdf, html2canvas, the QR scanner...) never load for visitors.
import Home from "./pages/Home";

// After a deploy, an open tab still asks for the old chunk file names, which
// no longer exist. Reload once to pick up the new build instead of showing a
// blank page; the flag stops a reload loop if the chunk is really missing.
const RELOAD_FLAG = "techastra_chunk_reload";
function lazyPage(load) {
  return lazy(() =>
    load().then(
      (mod) => {
        try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage unavailable */ }
        return mod;
      },
      (err) => {
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
          if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, "1");
        } catch { reloaded = true; }
        if (!reloaded) {
          window.location.reload();
          return new Promise(() => {}); // keep the fallback up while reloading
        }
        throw err;
      }
    )
  );
}

const loadEvents = () => import("./pages/Events");
const loadRegister = () => import("./pages/Register");
const loadLogin = () => import("./pages/Login");

const Events = lazyPage(loadEvents);
const EventDetail = lazyPage(() => import("./pages/EventDetail"));
const Cart = lazyPage(() => import("./pages/Cart"));
const Register = lazyPage(loadRegister);
const RegisterForm = lazyPage(() => import("./pages/RegisterForm"));
const Checkout = lazyPage(() => import("./pages/Checkout"));
const Status = lazyPage(() => import("./pages/Status"));
const Login = lazyPage(loadLogin);
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
const VerifyCertificate = lazyPage(() => import("./pages/VerifyCertificate"));

const RegistrationTeamPortal = lazyPage(() => import("./pages/portals/RegistrationTeamPortal"));
const CoordinatorPortal = lazyPage(() => import("./pages/portals/CoordinatorPortal"));
const HospitalityPortal = lazyPage(() => import("./pages/portals/HospitalityPortal"));
const CertificatePortal = lazyPage(() => import("./pages/portals/CertificatePortal"));
const VolunteerPortal = lazyPage(() => import("./pages/portals/VolunteerPortal"));
const AdminPortal = lazyPage(() => import("./pages/portals/AdminPortal"));

// Warm the cache for the pages visitors open next from the landing page, once
// the browser is idle - so those clicks don't wait on a chunk download.
function usePrefetchVisitorPages() {
  useEffect(() => {
    const conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;
    const run = () => [loadEvents, loadRegister, loadLogin].forEach((load) => load().catch(() => {}));
    const id = "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 2000);
    return () => ("cancelIdleCallback" in window ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);
}

// Shown for the moment a route chunk is loading. It holds the page height so
// the footer doesn't jump up and back.
function PageFallback() {
  return <div className="min-h-[60vh]" aria-busy="true" />;
}

// If a page still can't load (offline, or the reload above didn't help), show
// a message instead of unmounting the whole app. Keyed by path in App, so
// navigating elsewhere clears it.
class PageErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="kicker">Connection problem</p>
        <h1 className="h2">This page couldn’t load</h1>
        <button type="button" className="btn-ghost-sm mt-4" onClick={() => window.location.reload()} data-log="page-error-reload">
          Reload
        </button>
      </div>
    );
  }
}

export default function App() {
  const { pathname } = useLocation();
  usePrefetchVisitorPages();
  return (
    <div className="page-glow min-h-screen flex flex-col">
      <Navbar />
      {/* The navbar is fixed; pages start below it. The landing hero pulls
          itself back up under the nav with a negative margin (.hero). */}
      <main className="flex-1" style={{ paddingTop: "var(--nav-h)" }}>
        <PageErrorBoundary key={pathname}>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/register" element={<Register />} />
              <Route path="/register/form" element={<RegisterForm />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/status" element={<Status />} />
              <Route path="/login" element={<Login />} />
              <Route path="/verify-certificate" element={<VerifyCertificate />} />
  
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute roles={["participant"]}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/registration-team"
                element={
                  <ProtectedRoute roles={["registration_team", "master_admin"]}>
                    <RegistrationTeamPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/coordinator"
                element={
                  <ProtectedRoute roles={["coordinator", "master_admin"]}>
                    <CoordinatorPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hospitality"
                element={
                  <ProtectedRoute roles={["hospitality", "master_admin"]}>
                    <HospitalityPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/certificates"
                element={
                  <ProtectedRoute roles={["certificate_team", "master_admin"]}>
                    <CertificatePortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/volunteer"
                element={
                  <ProtectedRoute roles={["volunteer", "master_admin"]}>
                    <VolunteerPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={["master_admin"]}>
                    <AdminPortal />
                  </ProtectedRoute>
                }
              />
  
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PageErrorBoundary>
      </main>
      <Footer />
      <HelpDeskPanel />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="kicker">Error 404</p>
      <h1 className="h2">Page not found</h1>
      <Link to="/events" className="btn-ghost-sm mt-4">Back to events</Link>
    </div>
  );
}
