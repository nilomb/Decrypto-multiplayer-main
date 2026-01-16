/**
 * PART C: Phase Transition Test
 * Tests that buttons and inputs activate correctly when phases change
 */

import { gameManager } from "./GameManager.js";
import {
  updateClueInputs,
  updateHintInputStates,
} from "./phases/phase-inputs.js";

export class PhaseTransitionTester {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  /**
   * Test a phase transition and verify inputs/buttons
   */
  async testPhaseTransition(team, fromPhase, toPhase, isActive) {
    console.log(
      `\n🧪 Testing: Team ${team} ${fromPhase} → ${toPhase} (${
        isActive ? "ACTIVE" : "INACTIVE"
      })`
    );

    // Simulate phase change
    gameManager.teamPhases[team] = toPhase;
    gameManager.activePlayers[team] = isActive
      ? gameManager.playerId
      : "other-player-id";

    // Call UI update
    updateClueInputs();
    updateHintInputStates();

    // Run checks
    const checks = this.getChecksForPhase(toPhase, isActive);
    let allPassed = true;

    for (const check of checks) {
      const selector = check.selector;
      const expectedState = check.expectedState;
      const elements = document.querySelectorAll(selector);

      if (elements.length === 0) {
        // Some selectors might not exist on this view
        continue;
      }

      let elementStates = [];
      elements.forEach((el) => {
        const state = this.getElementState(el);
        elementStates.push(state);

        const passed = this.checkState(state, expectedState);
        if (!passed) {
          allPassed = false;
          this.errors.push(
            `❌ ${selector} in ${toPhase}: expected ${JSON.stringify(
              expectedState
            )}, got ${JSON.stringify(state)}`
          );
        } else {
          console.log(`✅ ${selector}: ${state.status}`);
        }
      });
    }

    if (allPassed) {
      this.results.push(`✅ Phase ${toPhase} (${team}) checks passed`);
    }
    return allPassed;
  }

  /**
   * Get expected state for each input type in a phase
   */
  getChecksForPhase(phase, isActive) {
    const checks = [];

    switch (phase) {
      case "clues":
        checks.push({
          selector: ".clue-input",
          expectedState: isActive
            ? { disabled: false, readonly: false }
            : { disabled: true, readonly: true },
        });
        checks.push({
          selector: "#btn-submit-clues",
          expectedState: isActive ? { display: "block" } : { display: "none" },
        });
        break;

      case "guess_us":
        checks.push({
          selector: ".guess-input",
          expectedState: isActive
            ? { disabled: true, readonly: true }
            : { disabled: false, readonly: false },
        });
        checks.push({
          selector: "#btn-submit-tguess-us",
          expectedState: isActive ? { display: "none" } : { display: "block" },
        });
        break;

      case "conf_us":
        checks.push({
          selector: ".tguess-input",
          expectedState: { disabled: false, readonly: true },
        });
        checks.push({
          selector: "#btn-submit-conf-us",
          expectedState: isActive ? { display: "block" } : { display: "none" },
        });
        break;

      case "guess_them":
        checks.push({
          selector: ".guessthem-input",
          expectedState: isActive
            ? { disabled: false, readonly: false }
            : { disabled: true, readonly: true },
        });
        checks.push({
          selector: ".hint-input",
          expectedState: isActive
            ? { disabled: false, readonly: false }
            : { disabled: true, readonly: true },
        });
        checks.push({
          selector: "#btn-submit-tguess-them",
          expectedState: isActive ? { display: "block" } : { display: "none" },
        });
        break;

      case "conf_them":
        checks.push({
          selector: ".guessthem-input",
          expectedState: { disabled: false, readonly: true },
        });
        checks.push({
          selector: ".confthem-input",
          expectedState: isActive
            ? { disabled: false, readonly: false }
            : { disabled: false, readonly: true },
        });
        checks.push({
          selector: ".hint-input",
          expectedState: isActive
            ? { disabled: false, readonly: false }
            : { disabled: true, readonly: true },
        });
        checks.push({
          selector: "#btn-submit-conf-them",
          expectedState: isActive ? { display: "block" } : { display: "none" },
        });
        break;

      case "review_round":
        checks.push({
          selector:
            ".clue-input, .guess-input, .conf-input, .guessthem-input, .confthem-input",
          expectedState: { readonly: true },
        });
        checks.push({
          selector: "button[id*='submit']",
          expectedState: { display: "none" },
        });
        break;
    }

    return checks;
  }

  /**
   * Get current state of an element
   */
  getElementState(element) {
    return {
      disabled: element.disabled,
      readonly: element.readOnly,
      display: window.getComputedStyle(element).display,
      status: this.describeState(element),
    };
  }

  /**
   * Describe element state in human-readable format
   */
  describeState(element) {
    if (element.disabled) return "DISABLED";
    if (element.readOnly) return "READONLY";
    if (window.getComputedStyle(element).display === "none") return "HIDDEN";
    return "EDITABLE";
  }

  /**
   * Check if state matches expected state
   */
  checkState(actualState, expectedState) {
    for (const key in expectedState) {
      if (actualState[key] !== expectedState[key]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Run all phase transitions
   */
  async runAllTests() {
    console.log("🧪 PHASE TRANSITION TEST SUITE");
    console.log("=".repeat(50));

    const phases = [
      "clues",
      "guess_us",
      "conf_us",
      "guess_them",
      "conf_them",
      "review_round",
    ];

    for (const phase of phases) {
      // Test as active player
      await this.testPhaseTransition("A", "lobby", phase, true);
      // Test as inactive player
      await this.testPhaseTransition("A", "lobby", phase, false);
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 TEST RESULTS");
    console.log("=".repeat(50));
    console.log(`✅ Passed: ${this.results.length}`);
    console.log(`❌ Failed: ${this.errors.length}`);

    if (this.errors.length > 0) {
      console.log("\n❌ FAILURES:");
      this.errors.forEach((err) => console.log(err));
    }

    return this.errors.length === 0;
  }
}

// Export for use in browser console
window.PhaseTransitionTester = PhaseTransitionTester;
export default PhaseTransitionTester;
