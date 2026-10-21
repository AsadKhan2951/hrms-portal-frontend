/**
 * The client feedback questions, shared by the public form and the place the
 * team reads the answers. The values must match backend/clientRounds.ts.
 */
export type Choice = { value: string; label: string };

export const SATISFACTION: Choice[] = [
  { value: "exceptional", label: "Exceptional" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "average", label: "Average" },
  { value: "poor", label: "Poor" },
];

export const PROGRESS: Choice[] = [
  { value: "ahead_of_expectations", label: "Ahead of expectations" },
  { value: "mostly_on_track", label: "Mostly on track" },
  { value: "some_gaps_or_delays", label: "Some gaps or delays" },
  { value: "significantly_off_track", label: "Significantly off track" },
  { value: "too_early_to_assess", label: "Too early to assess results" },
];

export const COMMUNICATION: Choice[] = [
  { value: "excellent", label: "Excellent: proactive and timely" },
  { value: "good", label: "Good: generally responsive" },
  { value: "fair", label: "Fair: could be better" },
  { value: "poor", label: "Poor: laid-back, needs chasing up" },
];

export const CONCERNS: Choice[] = [
  { value: "no_major_concerns", label: "No major concerns" },
  { value: "quality_of_work", label: "Quality of work" },
  { value: "deadlines_or_delays", label: "Deadlines or delays" },
  { value: "performance_and_results", label: "Performance and results" },
  { value: "communication_or_ownership", label: "Communication or ownership" },
  { value: "strategy_or_business_understanding", label: "Strategy or business understanding" },
  { value: "budget_billing_value", label: "Budget, billing and value for money" },
  { value: "other", label: "Other concerns" },
];

export const IMPROVEMENT: Choice[] = [
  { value: "no_change_needed", label: "No change needed" },
  { value: "better_results", label: "Better results" },
  { value: "faster_delivery", label: "Faster delivery" },
  { value: "more_proactive_communication", label: "More proactive communication" },
  { value: "better_strategy", label: "Better strategy and recommendations" },
  { value: "higher_quality_work", label: "Higher quality work" },
  { value: "clearer_reporting", label: "Clearer reporting and insights" },
];

export function labelOf(choices: Choice[], value: string) {
  return choices.find(choice => choice.value === value)?.label ?? value;
}

export function questionText(company: string) {
  return {
    satisfaction: `Overall, how satisfied are you with ${company}?`,
    progress: "How would you describe progress against your agreed goals?",
    communication: "How would you rate our communication and responsiveness?",
    concerns: "Is anything concerning you right now?",
    improvement: "What one improvement would create the most value for your business?",
    comments: "Is there anything else you would like us to know?",
  };
}

export function feedbackUrl(token: string) {
  return `${window.location.origin}/feedback/${token}`;
}
