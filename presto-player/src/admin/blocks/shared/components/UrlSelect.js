const { __ } = wp.i18n;
const { Button, Popover, Icon } = wp.components;

const { __experimentalLinkControl: LinkControl } = wp.blockEditor;
const { useState } = wp.element;
const { prependHTTP } = wp.url;

import "./UrlSelect.scss";

export default ({ setSettings, settings }) => {
  const [visible, setVisible] = useState(false);
  const { url } = settings;

  /**
   * Pending settings to be applied to the next link. When inserting a new
   * link, toggle values cannot be applied immediately, because there is not
   * yet a link for them to apply to. Thus, they are maintained in a state
   * value until the time that the link can be inserted or edited.
   *
   * @type {[Object|undefined,Function]}
   */
  const [nextLinkValue, setNextLinkValue] = useState();

  const linkValue = {
    url: settings?.url,
    type: settings?.type,
    id: settings?.id,
    opensInNewTab: settings?.opensInNewTab,
    ...nextLinkValue,
  };

  const onChangeLink = (nextValue) => {
    // Merge with values from state, both for the purpose of assigning the
    // next state value, and for use in constructing the new link format if
    // the link is ready to be applied.
    nextValue = {
      ...nextLinkValue,
      ...nextValue,
    };

    // LinkControl calls `onChange` immediately upon the toggling a setting.
    const didToggleSetting =
      linkValue.opensInNewTab !== nextValue.opensInNewTab &&
      linkValue.url === nextValue.url;

    // If change handler was called as a result of a settings change during
    // link insertion, it must be held in state until the link is ready to
    // be applied.
    const didToggleSettingForNewLink =
      didToggleSetting && nextValue.url === undefined;

    // If link will be assigned, the state value can be considered flushed.
    // Otherwise, persist the pending changes.
    setNextLinkValue(didToggleSettingForNewLink ? nextValue : undefined);

    if (didToggleSettingForNewLink) {
      return;
    }

    const newUrl = prependHTTP(nextValue.url);
    setSettings({
      url: newUrl,
      type: nextValue.type,
      id:
        nextValue.id !== undefined && nextValue.id !== null
          ? String(nextValue.id)
          : undefined,
      opensInNewTab: nextValue.opensInNewTab,
    });
  };

  const confirmTrash = () => {
    const r = confirm(
      __("Are you sure you wish to remove this link?", "presto-player")
    );
    if (r) {
      setSettings({});
    }
  };

  return (
    <span>
      {url ? (
        <div className="presto-url-select__display">
          <div className="presto-url-select__url-container">
            <a
              href="#"
              className="presto-url-select__link"
              onClick={() => setVisible(!visible)}
            >
              <Icon
                icon="edit"
                className="presto-url-select__edit-icon"
              />
              {url}
            </a>
            {visible && (
              <Popover
                position="bottom center"
                onClose={() => setVisible(false)}
              >
                <LinkControl value={settings} onChange={onChangeLink} />
              </Popover>
            )}
          </div>
          <div className="presto-url-select__actions">
            <Icon
              onClick={confirmTrash}
              icon="trash"
              className="presto-url-select__trash-icon"
            />
          </div>
        </div>
      ) : (
        <span>
          <Button isPrimary isSmall onClick={() => setVisible(!visible)}>
            {__("Add Link", "presto-player")}
          </Button>
          {visible && (
            <Popover className="presto-url-select__popover" position="bottom right" onClose={() => setVisible(false)}>
              <LinkControl value={settings} onChange={onChangeLink} />
            </Popover>
          )}
        </span>
      )}
    </span>
  );
};
