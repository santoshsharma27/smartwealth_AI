/**
 * Non-dismissible disclaimer bar for Dashboard and Chat pages.
 * States the guidance is educational/informational only.
 * Visible without scrolling (positioned at top of content area).
 * Validates: Requirement 14.1
 */
export function DisclaimerBar() {
  return (
    <aside
      role="note"
      aria-label="Financial disclaimer"
      className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 text-sm text-primary-800"
    >
      <p className="font-medium">
        This guidance is educational and informational only. It does not replace
        a certified financial advisor, tax consultant, or investment
        professional.
      </p>
    </aside>
  );
}
