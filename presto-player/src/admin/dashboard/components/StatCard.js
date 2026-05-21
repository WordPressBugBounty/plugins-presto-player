import { Text } from "@bsf/force-ui";

/**
 * Reusable stat card component.
 * Renders a white card with a label and either a large stat value or custom children.
 *
 * @param {string} label - The stat label text
 * @param {string} value - The stat value (used when children not provided)
 * @param {string} sublabel - Optional secondary label below the value (e.g., "seconds")
 * @param {React.ReactNode} children - Optional custom content (e.g., a chart)
 * @param {string} className - Optional extra classes appended to the outer card (e.g., flex-1 to grow)
 */
const StatCard = ({ label, value, sublabel, children, className = "" }) => (
  <div className={`bg-background-primary border border-solid border-border-subtle rounded-xl shadow-sm p-5 flex flex-col gap-1 ${className}`}>
    <div className="px-1 py-1">
      <Text size={14} weight={400} color="tertiary">
        {label}
      </Text>
    </div>
    {children ? (
      <div className="px-1 py-1 flex-1 min-h-0 overflow-hidden">{children}</div>
    ) : (
      <div className="px-1 py-1">
        <Text size={30} weight={600} color="primary">
          {value}
        </Text>
      </div>
    )}
    {sublabel && (
      <div className="px-1">
        <Text size={12} weight={400} color="tertiary">
          {sublabel}
        </Text>
      </div>
    )}
  </div>
);

export default StatCard;
