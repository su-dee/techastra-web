import React from "react";

const STEPS = ["Choose events", "Your details", "Payment"];

// Registration progress, shown on /events, /register, /register/form and
// /checkout so every step reads the same "Step n of 3".
export default function Stepper({ current }) {
  return (
    <nav aria-label="Registration progress" className="stepper">
      <ol>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "todo";
          return (
            <li key={label} className={"stepper__step is-" + state} aria-current={state === "current" ? "step" : undefined}>
              <span className="stepper__dot" aria-hidden="true">{state === "done" ? "✓" : n}</span>
              <span className="stepper__label">
                <span className="sr-only">Step {n} of {STEPS.length}: </span>
                {label}
                {state === "done" && <span className="sr-only"> (completed)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
