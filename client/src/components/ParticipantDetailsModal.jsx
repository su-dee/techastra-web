import React, { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import ParticipantDetails from "./ParticipantDetails";
import SetParticipantPassword from "./SetParticipantPassword";
import { api } from "../lib/api";

/**
 * Loads and shows one participant's full details (GET /api/participants/:id)
 * for staff lists. Open while `registrationId` is set. `canSetPassword`
 * (registration desk, master admin) adds "Set new password".
 */
export default function ParticipantDetailsModal({ registrationId, onClose, highlightEventId, canSetPassword = false }) {
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
        <>
          <ParticipantDetails details={details} highlightEventId={highlightEventId} />
          {canSetPassword && (
            <SetParticipantPassword key={registrationId} registrationId={registrationId} email={details.person?.email} status={details.status} />
          )}
        </>
      ) : (
        <p className="text-shade/50 text-sm">Loading…</p>
      )}
    </Modal>
  );
}
