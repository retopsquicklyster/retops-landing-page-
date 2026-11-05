import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import RevenueLeakChallengeModal, {
  CHALLENGE_QUESTIONS,
} from "../RevenueLeakChallengeModal";
import ROICalculator from "../ROICalculator";

// Enable act() support in React 18 test environment
global.IS_REACT_ACT_ENVIRONMENT = true;

// Mock react-router-dom so Jest (CJS) doesn't need ESM transformation for v7
let mockSearch = "";
jest.mock(
  "react-router-dom",
  () => ({
    useLocation: () => ({ pathname: "/", search: mockSearch }),
  }),
  { virtual: true }
);

describe("RevenueLeakChallengeModal", () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ configured: false }),
      })
    );
    document.body.style.overflow = "";
    mockSearch = "";
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    jest.restoreAllMocks();
  });

  const byTestId = (id) => container.querySelector(`[data-testid="${id}"]`);

  test("does not open on standard homepage without ?challenge=blindspot", async () => {
    mockSearch = "";
    await act(async () => {
      root.render(<RevenueLeakChallengeModal />);
    });
    expect(byTestId("revenue-leak-challenge-dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  test("opens automatically when ?challenge=blindspot is present and can be dismissed with Escape", async () => {
    mockSearch = "?challenge=blindspot";
    await act(async () => {
      root.render(<RevenueLeakChallengeModal />);
    });
    expect(byTestId("revenue-leak-challenge-dialog")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(byTestId("revenue-leak-challenge-dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  test("opens anytime openTrigger increments, even after being closed", async () => {
    mockSearch = "";
    await act(async () => {
      root.render(<RevenueLeakChallengeModal openTrigger={0} />);
    });
    expect(byTestId("revenue-leak-challenge-dialog")).toBeNull();

    // First click on 'Take the 3-minute challenge'
    await act(async () => {
      root.render(<RevenueLeakChallengeModal openTrigger={1} />);
    });
    expect(byTestId("revenue-leak-challenge-dialog")).not.toBeNull();

    // Close via X button
    await act(async () => {
      byTestId("rlc-close-btn").click();
    });
    expect(byTestId("revenue-leak-challenge-dialog")).toBeNull();

    // Second click on 'Take the 3-minute challenge' re-opens immediately
    await act(async () => {
      root.render(<RevenueLeakChallengeModal openTrigger={2} />);
    });
    expect(byTestId("revenue-leak-challenge-dialog")).not.toBeNull();
  });

  test("progresses through all 5 questions, marks right/wrong answers, and calculates score", async () => {
    mockSearch = "?challenge=blindspot";
    await act(async () => {
      root.render(<RevenueLeakChallengeModal />);
    });

    // Start the challenge
    await act(async () => {
      byTestId("rlc-start-btn").click();
    });

    // Question 1: pick wrong option (index 0, correct is 1)
    expect(container.textContent).toContain(CHALLENGE_QUESTIONS[0].title);
    await act(async () => {
      byTestId("rlc-option-0").click();
    });

    // Should lock options, mark option 1 as right (✓) and option 0 as wrong (✕)
    expect(byTestId("rlc-option-1").className).toContain("rlc-is-right");
    expect(byTestId("rlc-option-0").className).toContain("rlc-is-wrong");
    expect(byTestId("rlc-feedback").textContent).toContain(
      "NOT QUITE. HERE IS THE WARNING SIGN."
    );

    await act(async () => {
      byTestId("rlc-next-btn").click();
    });

    // Questions 2 to 5: pick correct options
    for (let i = 1; i < CHALLENGE_QUESTIONS.length; i++) {
      const correctIdx = CHALLENGE_QUESTIONS[i].correct;
      await act(async () => {
        byTestId(`rlc-option-${correctIdx}`).click();
      });
      expect(byTestId("rlc-feedback").textContent).toContain(
        "CORRECT. GOOD CATCH!"
      );
      await act(async () => {
        byTestId("rlc-next-btn").click();
      });
    }

    // Results screen: 4 / 5 -> SIGNAL SPOTTER
    expect(byTestId("rlc-stage-results")).not.toBeNull();
    expect(byTestId("rlc-result-score").textContent).toBe("4 / 5");
    expect(byTestId("rlc-result-title").textContent).toBe("SIGNAL SPOTTER");
    expect(byTestId("rlc-email-unavailable")).not.toBeNull();
  });

  test("ROICalculator uses simple 3-input math that adds up cleanly", async () => {
    await act(async () => {
      root.render(<ROICalculator />);
    });
    // Default: 5,000 customers × $50/mo = $250,000/mo ($3M/yr)
    // 2% churn = 100 customers/mo × $50 = $5,000/mo = $60,000/yr at risk
    // 25% recovered = $15,000/yr ($1,250/mo)
    expect(byTestId("roi-current-revenue").textContent).toBe("$3M/yr");
    expect(byTestId("roi-revenue-at-risk").textContent).toBe("$60,000");
    expect(byTestId("roi-recovered").textContent).toBe("$15,000");
  });
});
