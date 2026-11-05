import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import "./RevenueLeakChallengeModal.css";

export const CHALLENGE_QUESTIONS = [
  {
    tag: "SUPPORT / THE THIRD COMPLAINT",
    title: "The same problem. Three times.",
    copy: "A customer contacts support three times about the same billing issue. Every ticket says “resolved.” What is the real warning sign?",
    options: [
      "The customer sent three messages.",
      "The issue keeps recurring, even though the tickets were closed.",
      "The agent took too long to type.",
      "Nothing. All tickets are closed.",
    ],
    correct: 1,
    explain:
      "A closed ticket is not necessarily a resolved problem. Repeated issues can steadily erode trust.",
  },
  {
    tag: "PRODUCT / THE QUIET CUSTOMER",
    title: "Silence is not always good news.",
    copy: "A long-time customer stops contacting support, but their product usage drops sharply. Would you investigate?",
    options: [
      "No. No complaints means everything is fine.",
      "Yes. A quiet change in behaviour may be a warning sign.",
      "Only after the customer cancels.",
      "Only if the last support ticket was negative.",
    ],
    correct: 1,
    explain:
      "Customers do not always complain before they leave. A behavioural change can be an early clue.",
  },
  {
    tag: "CONVERSATIONS / THE COMPETITOR CLUE",
    title: "An ordinary question. Or a warning?",
    copy: "During a call, a customer asks how to export their data to a competitor. What is the best next step?",
    options: [
      "Record the signal, review context, and alert the appropriate account owner.",
      "Ignore it until the customer cancels.",
      "Delete the conversation.",
      "Automatically offer the biggest discount.",
    ],
    correct: 0,
    explain:
      "Early escalation gives the account team a chance to understand the reason and respond appropriately.",
  },
  {
    tag: "AI QUALITY / THE UNSAFE REPLY",
    title: "A fast response can still cause damage.",
    copy: "Your support bot drafts a refund promise that contradicts company policy. What is the safest response?",
    options: [
      "Send it immediately because AI is fast.",
      "Flag the reply for correction or human review before sending.",
      "Hide it from quality reports.",
      "Wait for the customer to complain.",
    ],
    correct: 1,
    explain:
      "An AI-generated promise the business cannot honour can damage customer trust. Catching it before sending matters.",
  },
  {
    tag: "PRIORITY / MONDAY MORNING",
    title: "Twenty accounts. Where do you start?",
    copy: "Your team has 20 potentially at-risk accounts. What information would best help it choose what to address first?",
    options: [
      "A random list of recent tickets.",
      "One overall sentiment score for all accounts.",
      "The account, the reason, urgency, revenue exposure, and recommended next step.",
      "The oldest accounts first, regardless of risk.",
    ],
    correct: 2,
    explain:
      "Retention action becomes clearer when the signal, the customer, the potential revenue exposure, and the next move connect.",
  },
];

const getApiBaseUrl = () => {
  const raw = process.env.REACT_APP_BACKEND_URL;
  if (!raw || raw === "undefined") return "/api";
  return `${raw.replace(/\/+$/, "")}/api`;
};

const hasBlindspotParam = (searchStr) => {
  try {
    const params = new URLSearchParams(searchStr || window.location.search);
    return (params.get("challenge") || "").trim().toLowerCase() === "blindspot";
  } catch (_e) {
    return false;
  }
};

export default function RevenueLeakChallengeModal() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(() => hasBlindspotParam(location.search));
  const [stage, setStage] = useState("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() =>
    Array(CHALLENGE_QUESTIONS.length).fill(null)
  );

  // Email signup state
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [backendConfigured, setBackendConfigured] = useState(null); // null = checking, true = ready, false = unconfigured
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusKind, setStatusKind] = useState(""); // "success" | "error" | "unavailable"

  const mainRef = useRef(null);
  const closeBtnRef = useRef(null);
  const lastFocusRef = useRef(null);

  const openChallenge = useCallback(() => {
    if (typeof document !== "undefined") {
      lastFocusRef.current = document.activeElement;
    }
    setIsOpen(true);
  }, []);

  const closeChallenge = useCallback(() => {
    setIsOpen(false);
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
    const prev = lastFocusRef.current;
    if (prev && typeof prev.focus === "function") {
      try {
        prev.focus();
      } catch (_e) {
        /* ignore focus errors on detached nodes */
      }
    }
  }, []);

  // Watch URL query parameter ?challenge=blindspot
  useEffect(() => {
    if (hasBlindspotParam(location.search)) {
      openChallenge();
    }
  }, [location.search, openChallenge]);

  // Lock body scroll and focus close button when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeChallenge();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeChallenge]);

  // Scroll modal panel to top when stage or question index changes
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [stage, index]);

  // Check backend Google Sheets webhook configuration when modal opens or reaches results
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/challenge-signup/status`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          if (!cancelled) setBackendConfigured(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setBackendConfigured(Boolean(data && data.configured));
        }
      } catch (_err) {
        if (!cancelled) setBackendConfigured(false);
      }
    };
    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [isOpen, stage]);

  const handleStart = () => {
    setStage("question");
    setIndex(0);
    setAnswers(Array(CHALLENGE_QUESTIONS.length).fill(null));
  };

  const handleSelectOption = (optionIdx) => {
    if (answers[index] !== null) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = optionIdx;
      return next;
    });
  };

  const handleBack = () => {
    if (index === 0) {
      setStage("intro");
    } else {
      setIndex((i) => i - 1);
    }
  };

  const handleNext = () => {
    if (answers[index] === null) return;
    if (index === CHALLENGE_QUESTIONS.length - 1) {
      setStage("results");
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleRestart = () => {
    setStage("intro");
    setIndex(0);
    setAnswers(Array(CHALLENGE_QUESTIONS.length).fill(null));
    setSubmittedSuccess(false);
    setStatusMessage("");
    setStatusKind("");
  };

  const score = answers.reduce(
    (sum, ans, i) => sum + (ans === CHALLENGE_QUESTIONS[i].correct ? 1 : 0),
    0
  );

  const rank =
    score === 5
      ? [
          "BLIND SPOT HUNTER",
          "You caught every clue. The bigger question is whether your systems could connect them this quickly.",
        ]
      : score >= 3
        ? [
            "SIGNAL SPOTTER",
            "You spotted most of the warning signs. The hard part is connecting them across people, conversations, and systems.",
          ]
        : [
            "REVENUE DETECTIVE IN TRAINING",
            "Some clues are easy to overlook when they show up in separate conversations and tools.",
          ];

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (submitting || submittedSuccess) return;

    if (backendConfigured === false) {
      setStatusKind("unavailable");
      setStatusMessage(
        "Early-access email signup is temporarily unavailable until the Google Sheets integration is configured."
      );
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatusKind("error");
      setStatusMessage("Please enter a valid work email address.");
      return;
    }

    if (!consent) {
      setStatusKind("error");
      setStatusMessage(
        "Please check the opt-in box so we have your permission to contact you."
      );
      return;
    }

    setSubmitting(true);
    setStatusMessage("");
    setStatusKind("");

    try {
      const res = await fetch(`${getApiBaseUrl()}/challenge-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          score,
          source: "Web Summit Lisbon QR",
          consent: true,
          website: honeypot,
        }),
      });

      let payload = {};
      try {
        payload = await res.json();
      } catch (_e) {
        payload = {};
      }

      if (res.ok && payload && payload.saved === true) {
        setSubmittedSuccess(true);
        setStatusKind("success");
        setStatusMessage(
          "Thank you — your early-access request and challenge score have been recorded."
        );
      } else if (res.status === 503) {
        setBackendConfigured(false);
        setStatusKind("unavailable");
        setStatusMessage(
          payload.detail ||
            "Early-access email signup is temporarily unavailable until the Google Sheets integration is configured."
        );
      } else {
        setStatusKind("error");
        setStatusMessage(
          payload.detail ||
            "We could not save your request right now. Please try again."
        );
      }
    } catch (_err) {
      setStatusKind("error");
      setStatusMessage(
        "Unable to reach the server to save your request. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const q = CHALLENGE_QUESTIONS[index];
  const sel = answers[index];

  return (
    <div
      className="rlc-overlay"
      id="rlc-overlay"
      aria-hidden="false"
      data-testid="revenue-leak-challenge-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeChallenge();
        }
      }}
    >
      <section
        className="rlc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rlcDialogTitle"
        id="rlc-dialog"
        data-testid="revenue-leak-challenge-dialog"
      >
        <aside className="rlc-side">
          <div className="rlc-logo-tile" data-testid="rlc-logo-tile">
            <img
              src="/retops-logo.png"
              alt="RetOps Revenue Protection Platform"
              className="rlc-side-logo"
              onError={(e) => {
                e.currentTarget.src = "/brand/retops-logo.png";
              }}
            />
          </div>
          <span className="rlc-side-kicker">The Revenue Leak Challenge</span>
          <h2>
            The clues are <span>already there.</span>
          </h2>
          <p>
            A customer&apos;s decision to leave can start long before they say
            goodbye.
          </p>
          <div className="rlc-side-spacer" />
          <div className="rlc-ringmark" aria-hidden="true" />
          <div className="rlc-side-bottom">
            <strong>05</strong> decisions to make
            <br />
            One pattern to uncover
          </div>
        </aside>

        <div className="rlc-main" id="rlc-main" ref={mainRef}>
          <button
            ref={closeBtnRef}
            className="rlc-close"
            type="button"
            id="rlcCloseBtn"
            data-testid="rlc-close-btn"
            aria-label="Close challenge"
            onClick={closeChallenge}
          >
            ×
          </button>

          <div className="rlc-topline">
            <span>RetOps / Revenue Leak Challenge</span>
            <span className="rlc-tiny-badge">3-minute challenge</span>
          </div>

          <div id="rlc-screen" aria-live="polite">
            {stage === "intro" && (
              <div data-testid="rlc-stage-intro">
                <div className="rlc-goldline" />
                <h1 className="rlc-page-title" id="rlcDialogTitle">
                  Would you spot the signs{" "}
                  <span className="rlc-hilite">before</span> a customer leaves?
                </h1>
                <p className="rlc-lead">
                  Five quick decisions. Five customer warning signs. See which
                  clues you&apos;d catch, and which ones could slip through the
                  cracks.
                </p>
                <div className="rlc-intro-detail">
                  <span>
                    <b>05</b> fictional scenarios
                  </span>
                  <span>
                    <b>~3</b> minutes
                  </span>
                  <span>
                    <b>0</b> customer data needed
                  </span>
                </div>
                <button
                  type="button"
                  id="rlcStartBtn"
                  data-testid="rlc-start-btn"
                  className="rlc-primary"
                  onClick={handleStart}
                >
                  START THE CHALLENGE <span aria-hidden="true">→</span>
                </button>
              </div>
            )}

            {stage === "question" && (
              <div data-testid={`rlc-stage-question-${index + 1}`}>
                <div className="rlc-progress-head">
                  <span>CLUE {String(index + 1).padStart(2, "0")} / 05</span>
                  <b>
                    {index + 1} of {CHALLENGE_QUESTIONS.length}
                  </b>
                </div>
                <div
                  className="rlc-progress-track"
                  aria-label="Challenge progress"
                >
                  <div
                    className="rlc-progress-fill"
                    style={{
                      width: `${((index + 1) / CHALLENGE_QUESTIONS.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="rlc-question-tag">{q.tag}</div>
                <h1 className="rlc-question-title" id="rlcDialogTitle">
                  {q.title}
                </h1>
                <p className="rlc-question-copy">{q.copy}</p>
                <div
                  className="rlc-options"
                  role="group"
                  aria-label="Choose the best answer"
                >
                  {q.options.map((opt, i) => {
                    const chosen = sel === i;
                    const right = sel !== null && i === q.correct;
                    const wrong = chosen && !right;
                    const ariaPrefix =
                      sel === null
                        ? ""
                        : right
                          ? "Correct answer"
                          : wrong
                            ? "Your answer, incorrect"
                            : "Other answer";
                    return (
                      <button
                        key={i}
                        type="button"
                        data-testid={`rlc-option-${i}`}
                        className={`rlc-choice ${chosen ? "rlc-is-chosen" : ""} ${right ? "rlc-is-right" : ""} ${wrong ? "rlc-is-wrong" : ""}`.trim()}
                        data-answer={i}
                        disabled={sel !== null}
                        aria-label={
                          ariaPrefix ? `${ariaPrefix}: ${opt}` : undefined
                        }
                        onClick={() => handleSelectOption(i)}
                      >
                        <span className="rlc-letter">{"ABCD"[i]}</span>
                        <span className="rlc-label">{opt}</span>
                        <span className="rlc-mark">
                          {right ? "✓" : wrong ? "✕" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {sel !== null && (
                  <div
                    className={`rlc-feedback ${sel === q.correct ? "rlc-is-correct" : "rlc-is-incorrect"}`}
                    role="status"
                    data-testid="rlc-feedback"
                  >
                    <strong>
                      {sel === q.correct
                        ? "✓ CORRECT. GOOD CATCH!"
                        : "✕ NOT QUITE. HERE IS THE WARNING SIGN."}
                    </strong>
                    <p>{q.explain}</p>
                  </div>
                )}

                <div className="rlc-question-bottom">
                  <button
                    type="button"
                    className="rlc-back"
                    id="rlcBackBtn"
                    data-testid="rlc-back-btn"
                    onClick={handleBack}
                  >
                    ← {index === 0 ? "Introduction" : "Previous clue"}
                  </button>
                  <button
                    type="button"
                    className="rlc-primary"
                    id="rlcNextBtn"
                    data-testid="rlc-next-btn"
                    disabled={sel === null}
                    onClick={handleNext}
                  >
                    {index === CHALLENGE_QUESTIONS.length - 1
                      ? "SEE YOUR RESULT"
                      : "NEXT CLUE"}{" "}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            )}

            {stage === "results" && (
              <div data-testid="rlc-stage-results">
                <div className="rlc-progress-head">
                  <span>CASE FILE COMPLETE</span>
                  <b>05 / 05</b>
                </div>
                <div className="rlc-progress-track">
                  <div className="rlc-progress-fill" style={{ width: "100%" }} />
                </div>
                <div className="rlc-question-tag">YOUR RESULT</div>
                <div className="rlc-result-score" data-testid="rlc-result-score">
                  {score}
                  <span> / 5</span>
                </div>
                <h1
                  className="rlc-result-title"
                  id="rlcDialogTitle"
                  data-testid="rlc-result-title"
                >
                  {rank[0]}
                </h1>
                <p className="rlc-result-copy">{rank[1]}</p>
                <div className="rlc-result-insight">
                  <strong>THE REAL BLIND SPOT:</strong> A customer rarely leaves
                  because of one isolated clue. RetOps is being built to help
                  teams connect the signals and act before the account is lost.
                </div>
                <div className="rlc-cta-actions">
                  <a
                    className="rlc-primary"
                    href="https://www.retops.ai/"
                    onClick={(e) => {
                      e.preventDefault();
                      closeChallenge();
                    }}
                    data-testid="rlc-explore-btn"
                  >
                    EXPLORE RETOPS <span aria-hidden="true">↗</span>
                  </a>
                  <button
                    type="button"
                    className="rlc-secondary"
                    id="rlcRestartBtn"
                    data-testid="rlc-restart-btn"
                    onClick={handleRestart}
                  >
                    PLAY AGAIN
                  </button>
                </div>

                <div className="rlc-early-access" data-testid="rlc-early-access">
                  <h3>Want early access to RetOps?</h3>
                  <p>
                    Leave your work email to receive early-access updates and
                    product invitations from RetOps.
                  </p>
                  <form
                    id="rlcEmailForm"
                    onSubmit={handleEmailSubmit}
                    noValidate
                  >
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      className="rlc-hp"
                      aria-hidden="true"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                    <div className="rlc-email-row">
                      <input
                        type="email"
                        id="rlcWorkEmail"
                        data-testid="rlc-email-input"
                        aria-label="Work email"
                        placeholder="Your work email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={
                          submitting ||
                          submittedSuccess ||
                          backendConfigured === false
                        }
                      />
                      <button
                        type="submit"
                        data-testid="rlc-email-submit"
                        disabled={
                          submitting ||
                          submittedSuccess ||
                          backendConfigured === false
                        }
                      >
                        {submitting
                          ? "SAVING..."
                          : submittedSuccess
                            ? "SAVED"
                            : "REQUEST ACCESS"}
                      </button>
                    </div>
                    <label className="rlc-consent-row">
                      <input
                        type="checkbox"
                        id="rlcEmailConsent"
                        data-testid="rlc-consent-checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        disabled={
                          submitting ||
                          submittedSuccess ||
                          backendConfigured === false
                        }
                      />
                      <span>
                        I agree to receive early-access updates and follow-up
                        emails from RetOps. You can unsubscribe at any time.
                      </span>
                    </label>
                  </form>
                  <span className="rlc-email-note">
                    Privacy notice: We record your work email, challenge score,
                    and opt-in consent solely for RetOps early-access outreach.
                    We never sell your data.
                  </span>

                  {backendConfigured === false && !statusMessage && (
                    <div
                      className="rlc-email-status rlc-is-unavailable"
                      role="status"
                      data-testid="rlc-email-unavailable"
                    >
                      Early-access email signup is temporarily unavailable until
                      the Google Sheets integration is configured.
                    </div>
                  )}

                  {statusMessage && (
                    <div
                      className={`rlc-email-status ${
                        statusKind === "success"
                          ? "rlc-is-success"
                          : statusKind === "unavailable"
                            ? "rlc-is-unavailable"
                            : "rlc-is-error"
                      }`}
                      role="status"
                      data-testid="rlc-email-status"
                    >
                      {statusMessage}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="rlc-legal">
            All scenarios are fictional. This is an educational game, not a
            churn prediction or financial assessment.
          </p>
        </div>
      </section>
    </div>
  );
}
