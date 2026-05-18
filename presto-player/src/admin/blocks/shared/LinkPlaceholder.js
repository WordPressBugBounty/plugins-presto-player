const {
  Button,
  Placeholder,
  TextControl,
  Flex,
  FlexItem,
  FlexBlock,
} = wp.components;
const { useState } = wp.element;
const { __ } = wp.i18n;

export default function ({
  attributes,
  setAttributes,
  icon,
  onSelectURL,
  label,
  instructions,
  placeholder,
}) {
  const { src } = attributes;
  const [state, setState] = useState({ src });
  return (
    <Placeholder
      icon={icon}
      label={label || __("Presto Embedded Video", "presto-player")}
      instructions={instructions || __("Enter video URL", "presto-player")}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSelectURL(state.url);
        }}
      >
        <Flex
          align="flex-end"
          gap={2}
          style={{ width: "100%", maxWidth: "400px" }}
        >
          <FlexBlock>
            <TextControl
              type="url"
              className={"presto-link-placeholder-input"}
              placeholder={placeholder || __("Youtube URL", "presto-player")}
              value={state.url}
              onChange={(url) => setState({ url })}
              __nextHasNoMarginBottom
            />
          </FlexBlock>
          <FlexItem>
            <Button isPrimary type="submit">
              {__("Add Video", "presto-player")}
            </Button>
          </FlexItem>
        </Flex>
      </form>
    </Placeholder>
  );
}
