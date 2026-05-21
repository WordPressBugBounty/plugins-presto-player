const { Modal, Button } = wp.components;
const { dispatch, useSelect } = wp.data;
import { __ } from "@wordpress/i18n";
import ProBadge from "@/admin/blocks/shared/components/ProBadge";
import useUpgradeCTA from "@/admin/dashboard/hooks/useUpgradeCTA";

export default function () {
  const closeModal = () => {
    dispatch("presto-player/player").setProModal(false);
  };

  const open = useSelect((select) => {
    return select("presto-player/player").proModal();
  });

  // Block editor is outside the dashboard SPA — no router history available.
  // The hook falls back to a hard navigation for the License Settings href.
  const { label, href, isProUnlicensed } = useUpgradeCTA();

  const body = isProUnlicensed
    ? __(
        "Activate your Pro license to unlock this feature.",
        "presto-player"
      )
    : __(
        "Get this feature and more with the Pro version of Presto Player!",
        "presto-player"
      );

  return open ? (
    <Modal title={__("Pro Feature", "presto-player")} onRequestClose={closeModal}>
      <h2>
        {__("Unlock Presto Player", "presto-player")} <ProBadge />
      </h2>
      <p>{body}</p>
      <Button
        href={href}
        target={isProUnlicensed ? "_self" : "_blank"}
        isPrimary
      >
        {label}
      </Button>
    </Modal>
  ) : (
    ""
  );
}
