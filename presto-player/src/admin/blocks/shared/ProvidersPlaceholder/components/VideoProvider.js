import { Flex } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import ProBadge from "../../components/ProBadge";
import "./VideoProvider.scss";

const VideoProvider = ({ provider, icon, onSelect, pro }) => {
  return (
    <Flex direction="column" gap="14px" onClick={onSelect}>
      <Flex
        className="presto-video-provider__icon-box"
        justify="center"
        align="center"
      >
        {pro && (
          <div className="presto-video-provider__pro-badge">
            <ProBadge />
          </div>
        )}
        {icon}
      </Flex>
      <Flex
        justify="center"
        className="presto-video-provider__label"
      >
        <p className="presto-video-provider__name">
          {provider}
        </p>
      </Flex>
    </Flex>
  );
};

export default VideoProvider;
