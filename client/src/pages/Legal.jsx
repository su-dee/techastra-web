import React from "react";
import { Link } from "react-router-dom";
import { LEGAL, INSTITUTE, ADDRESS, EVENT_DATES } from "../lib/site";

/**
 * Privacy Notice and Terms of Participation. The notice follows the Digital
 * Personal Data Protection Act, 2023 (India): what is collected and why,
 * consent, children's data (Junior Techastra), retention, the participant's
 * rights and whom to contact. Contact details come from LEGAL in lib/site.js.
 */

function LegalPage({ kicker, title, children }) {
  return (
    <article className="max-w-3xl mx-auto px-6 py-14 legal animate-cinematic-fade">
      <header className="page-head !text-left !mb-10">
        <div className="kicker">{kicker}</div>
        <h1 className="h2">{title}</h1>
        <p className="lead !mx-0">Last updated {LEGAL.lastUpdated}</p>
      </header>
      {children}
    </article>
  );
}

const Mail = () => <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;

export function Privacy() {
  return (
    <LegalPage kicker="Privacy" title="Privacy Notice">
      <p>
        This notice explains how the organisers of Techastra ’26 handle your personal data when you register for the
        symposium on {EVENT_DATES}. It is written for the Digital Personal Data Protection Act, 2023 (DPDP Act).
      </p>

      <h2>Who is responsible for your data</h2>
      <p>
        The data fiduciary is the {LEGAL.organiser}, {ADDRESS.join(" ")}. For any question or request about your data,
        contact {LEGAL.contactName} at <Mail />.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Registration details:</strong> name, email address, mobile number, college or school, register number or class, and your team members’ names.</li>
        <li><strong>Payment details:</strong> the amount paid, the UPI transaction ID (UTR) and, if you upload one, a screenshot of the payment. We never see or store your UPI PIN or bank details.</li>
        <li><strong>Event-day records:</strong> entry and attendance scans, meal-counter scans, results and certificates.</li>
        <li><strong>Optional input:</strong> feedback and help-desk questions you send us.</li>
        <li><strong>Account security:</strong> your password, stored only as a one-way hash.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>Only to run the symposium: to register you, verify your payment, issue your ID card, check you in, serve meals, publish results, issue and verify certificates, and contact you about your registration. We do not sell your data, use it for advertising, or share it with sponsors.</p>

      <h2>Your consent</h2>
      <p>
        We process your data on the basis of the consent you give when you register. You can withdraw consent at any
        time by writing to <Mail />; we will then delete your data, although we can no longer keep your registration
        active once it is withdrawn.
      </p>

      <h2>Children (Junior Techastra)</h2>
      <p>
        Junior Techastra is for school students, who are under 18. Their registration needs the consent of a parent or
        guardian, given on the registration form. We collect only what is needed to take part, and we do not track,
        profile or advertise to children.
      </p>

      <h2>Who can see it</h2>
      <p>
        Only the organising team, each for their role: the registration desk (payment checks), event coordinators
        (their participants), hospitality (meal scans) and the certificate team. Our hosting and email providers
        process data on our behalf and only as needed to run this service. We disclose data to authorities only when
        the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We delete personal data {LEGAL.retention}. Certificate codes stay verifiable after that so certificates can
        still be checked, and we keep financial records for as long as the law requires.
      </p>

      <h2>How we protect it</h2>
      <p>
        Data travels over encrypted connections (HTTPS). Staff sign in to role-based accounts, passwords are hashed,
        payment screenshots are visible only to the registration desk, and access is logged.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Ask for a summary of the personal data we hold about you and how it is used.</li>
        <li>Ask us to correct, complete or update it.</li>
        <li>Ask us to erase it.</li>
        <li>Nominate someone to exercise these rights for you if you are unable to.</li>
        <li>Raise a grievance with us. If we don’t resolve it, you can complain to the Data Protection Board of India.</li>
      </ul>
      <p>Write to <Mail /> from the email address you registered with. We acknowledge requests within 7 days and respond within 30 days.</p>

      <h2>Cookies and storage</h2>
      <p>
        We use no advertising or analytics cookies. Your browser stores only what the site needs to work: your sign-in
        token, your cart and an unfinished registration form. These stay on your device and you can clear them at any
        time.
      </p>

      <h2>Changes to this notice</h2>
      <p>If we change this notice we will update the date at the top of this page. See also our <Link to="/terms">Terms of Participation</Link>.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage kicker="Terms" title="Terms of Participation">
      <p>
        These terms apply to everyone who registers for Techastra ’26, the 18th National Level Technical Symposium at{" "}
        {INSTITUTE}, on {EVENT_DATES}.
      </p>

      <h2>Who can take part</h2>
      <ul>
        <li><strong>Senior events</strong> are for college students. Bring your college ID card on the day.</li>
        <li><strong>Junior Techastra</strong> is for school students, registered with a parent or guardian’s consent.</li>
        <li>Senior and junior events can’t be combined in one registration.</li>
      </ul>

      <h2>Registration and payment</h2>
      <ul>
        <li>Pay the exact amount shown at checkout to the official UPI ID displayed on the payment page, and enter the UPI transaction ID (UTR) from your payment app.</li>
        <li>Your registration is confirmed only after the registration desk has verified the payment. Track it on the <Link to="/status">status page</Link>.</li>
        <li>Registrations with a wrong, reused or unverifiable transaction ID are rejected.</li>
        <li>All personal data is protected and stored securely.</li>
      </ul>

      <h2>Fees and refunds</h2>
      {!LEGAL.refundPolicyConfirmed && (
        <p className="legal__note" role="note">This section is awaiting final confirmation by the organisers.</p>
      )}
      <ul>
        <li>Registration fees are non-refundable.</li>
        <li>If the organisers cancel an event, the fee for that event is refunded in full.</li>
        <li>For any queries, write to <Mail />.</li>
      </ul>

      <h2>On the day</h2>
      <ul>
        <li>Carry your digital ID card (from your dashboard) and your college or school ID.</li>
        <li>Follow each event’s rules and the coordinators’ instructions. The judges’ decisions are final.</li>
        <li>Plagiarism, cheating or misconduct leads to disqualification without a refund.</li>
        <li>Photographs and videos may be taken at the symposium for the institute’s reports and social media.</li>
      </ul>

      <h2>Certificates</h2>
      <p>Participation and merit certificates are issued online after the event and can be checked by anyone on the <Link to="/verify-certificate">verification page</Link>.</p>

      <h2>Changes and contact</h2>
      <p>
        Timings and venues may change; updates are posted on this portal. These terms are governed by the laws of India,
        with courts in Chennai having jurisdiction. Questions: <Mail />. How we handle your data is described in our{" "}
        <Link to="/privacy">Privacy Notice</Link>.
      </p>
    </LegalPage>
  );
}
