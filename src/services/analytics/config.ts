import { isEnvTruthy } from '../../utils/envUtils.js';

export function isAnalyticsDisabled(): boolean {
  return isEnvTruthy(process.env.DISABLE_ANALYTICS);
}

// === OPEN-SOURCE STUB (was used by feedback/survey flows in the original Claude leak) ===
export function isFeedbackSurveyDisabled(): boolean {
  // Always disabled — we use the local reporting server instead of Anthropic's survey system
  return true;
}
