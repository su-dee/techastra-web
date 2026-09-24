import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import HelpDeskPanel from "./components/panels/HelpDeskPanel";

import Home from "./pages/Home";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Cart from "./pages/Cart";
import Register from "./pages/Register";
import RegisterForm from "./pages/RegisterForm";
import Checkout from "./pages/Checkout";
import Status from "./pages/Status";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VerifyCertificate from "./pages/VerifyCertificate";

import RegistrationTeamPortal from "./pages/portals/RegistrationTeamPortal";
import CoordinatorPortal from "./pages/portals/CoordinatorPortal";
import HospitalityPortal from "./pages/portals/HospitalityPortal";
import CertificatePortal from "./pages/portals/CertificatePortal";
import VolunteerPortal from "./pages/portals/VolunteerPortal";
import AdminPortal from "./pages/portals/AdminPortal";

export default function App() {
  return (
    <div className="page-glow min-h-screen flex flex-col">
      <Navbar />
      {/* The navbar is fixed; pages start below it. The landing hero pulls
          itself back up under the nav with a negative margin (.hero). */}
      <main className="flex-1" style={{ paddingTop: "var(--nav-h)" }}>
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
