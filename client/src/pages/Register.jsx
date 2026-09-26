import { Navigate, useLocation } from "react-router-dom";

/**
 * /register used to be a second, different "choose events" page. There is now
 * one step-1 page (pages/Events.jsx); old links and bookmarks land there with
 * their ?level= choice kept.
 */
export default function Register() {
  const { search } = useLocation();
  return <Navigate to={`/events${search}`} replace />;
}
