import {
  Flex
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import "./Separator.scss";

const Separator = ({ icon }) => {
  return (
    <Flex
      align="center"
      className="presto-separator"
    >
      <span className="presto-separator__line">
        {icon}
      </span>
      <span>{__('or', 'presto-player')}</span>
      <span className="presto-separator__line">
        {icon}
      </span>
    </Flex>
  );
};

export default Separator;
