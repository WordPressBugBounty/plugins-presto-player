import React, { useEffect, useRef } from "react";
import { __ } from "@wordpress/i18n";
import { Dialog, Text, Button } from "@bsf/force-ui";
import { X } from "lucide-react";

const YOUTUBE_EMBED_URL =
  "https://www.youtube-nocookie.com/embed/7ibtk_KTgCw?si=f0atBqLnA_6gxXC6&autoplay=1&enablejsapi=1";

const VideoModal = ({ isOpen, onClose, triggerRef }) => {
  const closeRef = useRef(null);
  const wasOpenRef = useRef(false);

  // Restore focus to the trigger element only when modal transitions from open to closed
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      triggerRef?.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, triggerRef]);

  // Move focus to the close button when the modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to let Dialog render before focusing
      const id = requestAnimationFrame(() => closeRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen]);

  return (
    <Dialog
      design="simple"
      exitOnClickOutside
      exitOnEsc
      scrollLock
      open={isOpen}
      setOpen={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Backdrop className="bg-black bg-opacity-70" />
      <Dialog.Panel
        className="bg-transparent shadow-none border-none max-w-[80vw] w-full p-0 overflow-visible gap-2"
        aria-label={__("Introduction video", "presto-player")}
      >
        <div className="flex justify-end items-center gap-2 text-text-inverse">
          <Text as="span" size="sm" weight="medium" className="text-text-inverse">
            {__("Esc", "presto-player")}
          </Text>
          <Button
            ref={closeRef}
            variant="ghost"
            size="sm"
            className="cursor-pointer bg-transparent border-none text-text-inverse hover:bg-transparent focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent min-w-6 min-h-6"
            onClick={onClose}
            aria-label={__("Close video (Esc)", "presto-player")}
            icon={<X size={20} />}
          />
        </div>
        <iframe
          className="w-full lg:h-188 sm:h-120 h-60 rounded-lg border-0"
          src={isOpen ? YOUTUBE_EMBED_URL : undefined}
          title={__("Presto Player introduction video", "presto-player")}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </Dialog.Panel>
    </Dialog>
  );
};

export default VideoModal;
