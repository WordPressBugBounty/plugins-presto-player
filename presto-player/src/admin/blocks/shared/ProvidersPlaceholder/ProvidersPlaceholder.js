import {
  Placeholder,
  Flex,
  FlexItem,
  Spinner,
  Button,
  MenuItem,
} from "@wordpress/components";
import "./ProvidersPlaceholder.scss";
import { __ } from "@wordpress/i18n";
import { useDispatch } from "@wordpress/data";
import VideoProvider from "./components/VideoProvider";
import providerIcons from "./icons";
import Separator from "./components/Separator";
import SelectMediaDropdown from "../components/SelectMediaDropdown";
import VideoIcon from "../components/VideoIcon";

const ProvidersPlaceholder = ({
  loading,
  onSelect,
  onSelectMedia = null,
  providers = [],
}) => {
  const { dispatch } = useDispatch();

  if (loading) {
    return (
      <Placeholder className="presto-providers-placeholder--loading">
        <Spinner />
      </Placeholder>
    );
  }

  return (
    <Placeholder
      className="presto-providers-placeholder"
      label={
        <>
          <Flex
            direction="column"
            className="presto-providers-placeholder__label"
            gap="16px"
          >
            <Flex justify="flex-start">
              {providerIcons?.mediaHubBlock}
              <h1 className="presto-providers-placeholder__title">
                {__("Presto Player", "presto-player")}
              </h1>
            </Flex>
            <Flex>
              <p className="presto-providers-placeholder__description">
                {__("Choose a video type to get started.", "presto-player")}
              </p>
            </Flex>
          </Flex>
        </>
      }
    >
      <Flex
        direction="column"
        className="presto-providers-placeholder__grid"
        gap="20px"
      >
        <Flex
          justify={"start"}
          className="presto-providers-placeholder__row"
          wrap="wrap"
          gap="20px"
        >
          {(providers || []).map((provider) => (
            <FlexItem key={provider?.id}>
              <VideoProvider
                provider={provider?.name}
                onSelect={() =>
                  provider?.hasAccess
                    ? onSelect(provider?.id)
                    : dispatch("presto-player/player").setProModal(true)
                }
                icon={provider?.icon}
                pro={provider?.premium && !provider?.hasAccess}
              />
            </FlexItem>
          ))}
        </Flex>
        {onSelectMedia && (
          <>
            <Separator icon={providerIcons.line} />
            <Flex>
              <SelectMediaDropdown
                popoverProps={{ placement: "bottom-start" }}
                onSelect={({ id }) => onSelectMedia(id)}
                renderToggle={({ isOpen, onToggle }) => (
                  <Button
                    variant="primary"
                    onClick={onToggle}
                    aria-expanded={isOpen}
                  >
                    {__("Select media", "presto-player")}
                  </Button>
                )}
                renderItem={({ item, onSelect }) => {
                  const { id, title, details } = item;
                  const { type, name } = details || {};
                  const thumbnail =
                    item?._embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
                    "";
                  return (
                    <MenuItem
                      icon={<VideoIcon thumbnail={thumbnail} type={type} />}
                      iconPosition="left"
                      suffix={type ? name : __("Choose media", "presto-player")}
                      onClick={() => onSelect(item)}
                      key={id}
                      className="presto-providers-placeholder__menu-item"
                    >
                      {title || __("Untitled", "presto-player")}
                    </MenuItem>
                  );
                }}
              />
            </Flex>
          </>
        )}
      </Flex>
    </Placeholder>
  );
};

export default ProvidersPlaceholder;
