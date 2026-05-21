import { useEffect, useRef, useState } from "react";
import { __ } from "@wordpress/i18n";
import { CircleX } from "lucide-react";

import { Dialog, Button, Badge } from "@bsf/force-ui";

const ConfirmPopup = ({
  openConfirmPopup: openPopup,
  setOpenConfirmPopup: setOpenPopup,
  title = __("Popup Title", "presto-player"),
  description = "",
  confirmText = __("Confirm", "presto-player"),
  cancelText = __("Cancel", "presto-player"),
  confirmCallback = null,
  cancelCallback = null,
  ErrorMessage = "",
  postsDeletionMessageList = false,
  destructive = false,
}) => {
  const cancelButtonRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const onCancelClick = () => {
    if (cancelCallback) {
      cancelCallback();
      return;
    }
    setOpenPopup(false);
  };

  const onConfirmClick = async () => {
    if (!confirmCallback) {
      return;
    }
    setLoading(true);
    try {
      // Awaits the callback's promise (if any). Synchronous callbacks
      // resolve immediately. After success the popup self-closes; on
      // error the popup stays open so the caller can show ErrorMessage.
      await confirmCallback();
      setOpenPopup(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ErrorMessage) {
      setLoading(false);
    }
  }, [ErrorMessage]);

  return (
    <Dialog
      design="simple"
      exitOnClickOutside
      exitOnEsc
      scrollLock
      open={openPopup}
      setOpen={setOpenPopup}
    >
      <Dialog.Backdrop />
      <Dialog.Panel>
        <Dialog.Header>
          {ErrorMessage && (
            <Badge
              icon={<CircleX />}
              label={ErrorMessage}
              size="md"
              type="rounded"
              variant="red"
              className="py-6 px-4 justify-start"
            />
          )}
          <Dialog.Title>{title}</Dialog.Title>
        </Dialog.Header>

        {(description || postsDeletionMessageList) && (
          // py-3 balances the vertical rhythm: Dialog.Header has pb-1 but
          // Dialog.Body has no default vertical padding, so without this the
          // description sits visually closer to the title than to the footer.
          <Dialog.Body className="py-3">
            <Dialog.Description>
              {description}
              {postsDeletionMessageList && (
                <ul className="list-disc pl-5">
                  <li className="text-sm">
                    {__(
                      "Posts content under this space will be deleted permanently.",
                      "presto-player"
                    )}
                  </li>
                </ul>
              )}
            </Dialog.Description>
          </Dialog.Body>
        )}

        <Dialog.Footer>
          <Button variant="ghost" onClick={onCancelClick} ref={cancelButtonRef}>
            {cancelText}
          </Button>
          <Button
            onClick={onConfirmClick}
            disabled={loading}
            loading={loading}
            destructive={destructive}
          >
            {confirmText}
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
};

export default ConfirmPopup;
