const { __ } = wp.i18n;
const { useState } = wp.element;
const { useSelect, dispatch } = wp.data;
const { withNotices, BaseControl, Spinner, Button } = wp.components;

import ProBadge from "@/admin/blocks/shared/components/ProBadge";
import EditOverlay from "./Edit";

import "./index.scss";

const VideoOverlays = ({ setAttributes, attributes }) => {
  // modal
  const { overlays } = attributes;
  const [modal, setModal] = useState(false);
  const openModal = () => setModal(true);
  const closeModal = () => setModal(false);

  const updateOverlayAttribute = (overlays) => {
    setAttributes({ overlays: overlays });
  };

  return (
    <>
      <BaseControl>
        <Button
          isPrimary
          onClick={() => {
            if (!prestoPlayer?.isPremium) {
              dispatch("presto-player/player").setProModal(true);
              return;
            }
            openModal("new");
          }}
        >
          {!!overlays.length
            ? __("Update Overlays", "presto-player")
            : __("Add Overlay", "presto-player")}
          {!!overlays.length && (
            <div
              className="presto-overlays__count"
            >
              {overlays.length}
            </div>
          )}
        </Button>

        {!prestoPlayer?.isPremium && <ProBadge />}
      </BaseControl>

      {modal && (
        <EditOverlay
          closeModal={closeModal}
          attributes={attributes}
          setAttributes={setAttributes}
          updateOverlayAttribute={updateOverlayAttribute}
        />
      )}
    </>
  );
};

export default VideoOverlays;
