import { Button, Popover, RadioControl } from "@wordpress/components";
import { useSelect, useDispatch } from "@wordpress/data";
import { render, useState, useRef } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import "./index.scss";

const EditApp = () => {
  const META_KEY = "presto_player_instant_video_pages_enabled";
  const { editPost } = useDispatch("core/editor");
  const meta = useSelect((select) =>
    select("core/editor").getEditedPostAttribute("meta")
  );

  let customMeta = meta && meta[META_KEY] ? meta[META_KEY] : false;

  const onCustomMetaChange = (newValue) => {
    editPost({
      meta: { ...meta, [META_KEY]: newValue === "public" ? true : false },
    });
  };

  const [isVisible, setIsVisible] = useState(false);
  const anchorRef = useRef(null);
  const toggleVisible = () => {
    setIsVisible((state) => !state);
  };

  return (
    <div>
      <Button
        variant="tertiary"
        onClick={toggleVisible}
        className="presto-toolbar__button"
      >
        <div
          className={`presto-toolbar__badge ${customMeta ? 'is-active' : ''}`}
        ></div>
        {__("Instant Video Page", "presto-player")}
        <div
          className="presto-toolbar__icon"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </Button>
      {isVisible && (
        <Popover
          placement="bottom-end"
          shift
          anchor={anchorRef.current}
          resize={false}
          onFocusOutside={toggleVisible}
          className="pp-instant-video-dropdown"
        >
          <div
            className="presto-toolbar__popover-content"
          >
            <RadioControl
              label={__("Visibility", "presto-player")}
              selected={customMeta ? "public" : "private"}
              options={[
                { label: __("Published", "presto-player"), value: "public" },
                { label: __("Unpublished", "presto-player"), value: "private" },
              ]}
              onChange={onCustomMetaChange}
              className="presto-toolbar__radio"
            />
            <p
              className="presto-toolbar__description"
            >
              {__(
                "An instant video page gives you an instant shareable page for your media.",
                "presto-player"
              )}
            </p>
          </div>
        </Popover>
      )}
    </div>
  );
};
(function (window, wp) {
  const rootDiv = document.createElement("div");
  rootDiv.classList.add("presto-player-edit-root");

  // check if gutenberg's editor root element is present.
  const editorEl = document.getElementById("editor");
  if (!editorEl) {
    // do nothing if there's no gutenberg root element on page.
    return;
  }

  const unsubscribe = wp.data.subscribe(function () {
    setTimeout(function () {
      render(<EditApp />, rootDiv);
      if (!document.querySelector(".presto-player-edit-root")) {
        const toolbalEl =
          editorEl.querySelector(".edit-post-header__settings") ||
          editorEl.querySelector(".editor-header__settings");
        if (toolbalEl instanceof HTMLElement) {
          toolbalEl.prepend(rootDiv);
        }
      }
    }, 1);
  });
  // unsubscribe
  if (document.querySelector(".presto-player-edit-root")) {
    unsubscribe();
  }
})(window, wp);
