import React, { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import ParticipantDetails from "./ParticipantDetails";
import { api } from "../lib/api";

/**
 * Loads and shows one participant's full details (GET /api/participants/:id)
 * for staff lists. Open while `registrationId` is set.
 */
export default function ParticipantDetailsModal({ registrationId, onClose, highlightEventId }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!registrationId) return;
    let live = true;
    setDetails(null);
    setError("");
    api
      .get(`/api/participants/${encodeURIComponent(registrationId)}`)
      .then((data) => live && setDetails(data.details))
      .catch((err) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [registrationId]);

  return (
    <Modal open={!!registrationId} onClose={onClose} title="Participant details">
      {error ? (
        <p className="text-danger text-sm" role="alert">{error}</p>
      ) : details ? (
        <ParticipantDetails details={details} highlightEventId={highlightEventId} />
      ) : (
        <p className="text-shade/50 text-sm">Loading…</p>
      )}
    </Modal>
  );
}
