const { Icon } = wp.components;
const { dispatch } = wp.data;

import Thumb from "../ThumbTemplate";

import "./Collection.scss";

export default ({ collection }) => {
  // handle click
  const handleClick = (e) => {
    e.preventDefault();
    dispatch("presto-player/bunny-popup").setCollectionRequest(collection);
    dispatch("presto-player/bunny-popup").setVideosFetched(false);
  };

  return (
    <Thumb
      onClick={handleClick}
      title={
        <div>
          <Icon
            icon="open-folder"
            className="presto-stream-collection__icon"
          />
          {collection.name}
        </div>
      }
      footer={<div>{collection.videoCount} Videos</div>}
    />
  );
};
