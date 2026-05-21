import { useRef, useEffect } from 'react';
import UpgradeToPro from "./UpgradeToPro";

/**
 * Full-page Pro gate overlay. Renders a blurred skeleton preview
 * with a centered UpgradeToPro card. Used on Pro-only pages
 * (Analytics, Emails) to show a frosted "sneak peek" of the content.
 *
 * @param {Object}      props
 * @param {JSX.Element} props.children - The skeleton component to blur behind the overlay.
 */
const ProGateOverlay = ({ children }) => {
  const inertRef = useRef(null);

  useEffect(() => {
    if (inertRef.current) {
      inertRef.current.setAttribute('inert', '');
    }
  }, []);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        ref={inertRef}
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden blur-[3px] pointer-events-none select-none opacity-80"
      >
        {children}
      </div>
      <div className="absolute inset-0 bg-white/30 flex items-center justify-center p-8">
        {/* max-w-3xl keeps the card tight so the illustration and copy sit
            close together — wider widths leave too much whitespace between
            the two columns. -translate-y nudges the card above the geometric
            center so it sits in the optical center of the viewport (the page
            chrome above pulls perceived center upward). */}
        <div className="max-w-xl w-full drop-shadow-2xl -translate-y-[6vh]">
          <UpgradeToPro layout="horizontal" />
        </div>
      </div>
    </div>
  );
};

export default ProGateOverlay;
