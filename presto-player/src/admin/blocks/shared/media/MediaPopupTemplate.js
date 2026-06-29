/**
 * WordPress dependencies
 */
const { __ } = wp.i18n;
const { Modal } = wp.components;

import "./MediaPopupTemplate.scss";

export default ({
  onClose,
  title,
  header,
  error,
  mainContent,
  sidebar,
  footer,
}) => {
  return (
    <Modal
      isFullScreen
      title={title ? title : __("Add Media", "presto-player")}
      onRequestClose={onClose}
      className="presto-media-popup-template"
      overlayClassName="presto-player__modal-overlay"
    >
      <div
        className="presto-media-popup-template__grid"
        data-cy="media-modal"
      >
        <div className="presto-media-popup-template__header">
          <div className="presto-media-popup-template__header-row">
            {header}
          </div>
          {error}
        </div>
        <div className="presto-media-popup-template__main">
          {mainContent}
        </div>
        <div className="presto-media-popup-template__sidebar">
          {sidebar}
        </div>
        <div className="presto-media-popup-template__footer">
          {footer}
        </div>
      </div>
    </Modal>
  );
};
