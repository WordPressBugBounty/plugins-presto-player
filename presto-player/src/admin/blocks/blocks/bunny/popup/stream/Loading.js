const { Flex, FlexBlock, Spinner } = wp.components;

import "./Loading.scss";

export default ({ className }) => {
  return (
    <Flex className={className}>
      <FlexBlock className="presto-stream-loading">
        <Spinner />
      </FlexBlock>
    </Flex>
  );
};
