import { initialWizardState, type WizardAction, type WizardState } from "./types";

export { initialWizardState };

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_OPERATING_DAY":
      return { ...state, operatingDays: { ...state.operatingDays, [action.key]: action.value } };
    case "SET_PEAK_SEASON":
      return { ...state, peakSeasons: { ...state.peakSeasons, [action.key]: action.value } };
    case "HYDRATE":
      return action.state;
    case "RESET":
      return initialWizardState;
    default:
      return state;
  }
}
