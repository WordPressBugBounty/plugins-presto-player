const { Icon, Button } = wp.components;
const { useEffect, useState } = wp.element;
const { useSelect, dispatch } = wp.data;
import ProgressOverlay from "../ProgressOverlay";
import ProgressBar from "../ProgressBar";
import Thumbnail from "../ThumbTemplate";
import "./Video.scss";

import {
  isSelectable,
  getStatusText,
  getLengthToTime,
  bytesToSize,
} from "../utils";

export default ({ video }) => {
  const [selected, setSelected] = useState();
  const isPrivate = useSelect((select) =>
    select("presto-player/bunny-popup").isPrivate()
  );
  const selectedId = useSelect((select) =>
    select("presto-player/bunny-popup").ui("selectedId")
  );

  useEffect(() => {
    setSelected(selectedId ? selectedId === video.guid : null);
  }, [selectedId]);

  /**
   * Status badge
   * @returns JSX
   */
  const renderStatusBadge = () => (
    <Button
      isSmall
      isPrimary
      isBusy={!isSelectable(video)}
      className="presto-stream-video__status-badge"
    >
      {getStatusText(video)}
    </Button>
  );

  /**
   * Render thumbnail
   * @returns
   */
  const renderThumbnail = () => {
    if (video.status < 3) {
      return <ProgressOverlay progress={video.encodeProgress} />;
    }

    const url = isPrivate ? video?.thumbnailURLSigned : video?.thumbnailURL;

    if (url) {
      return (
        <img
          className="presto-stream-video__thumbnail"
          src={url}
        />
      );
    }
  };

  const renderLength = () => (
    <div className="presto-stream-video__length">
      <span className="presto-stream-video__length-item">
        <Icon
          className="presto-stream-video__length-icon"
          icon="clock"
          size={14}
        />
        <span>{getLengthToTime(video.length)}</span>
      </span>
      <span className="presto-stream-video__length-item">
        <Icon
          className="presto-stream-video__length-icon"
          icon="database"
          size={14}
        />
        <span>{bytesToSize(video.storageSize)}</span>
      </span>
    </div>
  );

  return (
    <Thumbnail
      onClick={() => {
        dispatch("presto-player/bunny-popup").setUI("selectedId", video?.guid);
      }}
      className={`presto-stream-video ${selected ? 'is-selected' : ''}`}
      thumbnail={renderThumbnail()}
      badge={renderStatusBadge()}
      title={video.title}
      footer={renderLength()}
      after={
        video.status === 3 ? (
          <ProgressBar
            className="presto-stream-video__progress-bar"
            progress={video.encodeProgress}
          />
        ) : (
          ""
        )
      }
    />
  );
};
