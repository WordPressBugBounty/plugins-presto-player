import React from "react";
const { __ } = wp.i18n;
import { Container, Label } from "@bsf/force-ui";

const PluginRecommendations = ({
  integrations = [],
  renderActionButton,
  layout = "inline",
}) => {
  const isGridLayout = layout === "grid";

  return (
    <div className="h-auto shadow-sm bg-background-primary rounded-xl">
      <Container
        containerType="flex"
        gap="xs"
        direction="column"
        className="p-3 border-solid rounded-xl border-border-subtle border-0.5 gap-1"
      >
        <Container.Item className="md:w-full lg:w-full">
          <Container className="p-1" justify="between" gap="xs" align="center">
            <Container.Item>
              <Label className="font-semibold">
                {__("Extend your Community", "presto-player")}
              </Label>
            </Container.Item>
          </Container>
        </Container.Item>
        <Container.Item className="rounded-lg md:w-full lg:w-full bg-field-primary-background">
          <Container
            containerType={isGridLayout ? "grid" : "flex"}
            direction={isGridLayout ? undefined : "row"}
            className={
              isGridLayout
                ? "gap-1 p-1 grid-cols-2 md:grid-cols-1 min-[1020px]:grid-cols-1 xl:grid-cols-2"
                : "gap-1.5 p-1"
            }
          >
            {integrations.map((card) => (
              <Container.Item
                key={card.id}
                className={isGridLayout ? "flex" : "flex flex-1"}
              >
                <Container
                  containerType="flex"
                  direction="column"
                  className={
                    isGridLayout
                      ? "w-[190px] min-w-[144px] min-h-[135px] flex-1 gap-1 p-2 rounded-md shadow-soft-shadow-inner bg-background-primary"
                      : "w-full min-h-[110px] gap-1 p-1.5 rounded-md shadow-soft-shadow-inner bg-background-primary"
                  }
                >
                  <Container.Item>
                    <Container
                      className={
                        isGridLayout
                          ? "items-center gap-1.5 p-1"
                          : "items-center gap-1 p-0.5"
                      }
                    >
                      <Container.Item
                        className={
                          isGridLayout
                            ? "[&>svg]:size-5 flex"
                            : "[&>svg]:size-4 flex"
                        }
                        grow={0}
                        shrink={0}
                      >
                        {card.svg}
                      </Container.Item>
                      <Container.Item className="flex">
                        <Label className="text-sm font-medium">
                          {card.title}
                        </Label>
                      </Container.Item>
                    </Container>
                  </Container.Item>
                  <Container.Item
                    className={isGridLayout ? "gap-0.5 p-1" : "gap-0.5 px-0.5"}
                  >
                    <Label
                      variant="help"
                      className={
                        isGridLayout
                          ? "text-sm font-normal text-text-tertiary"
                          : "text-sm font-normal text-text-tertiary line-clamp-2"
                      }
                    >
                      {card.description}
                    </Label>
                  </Container.Item>
                  <Container.Item
                    className={
                      isGridLayout
                        ? "gap-0.5 px-1 pt-2 pb-1 mt-auto"
                        : "gap-0.5 px-0.5 pt-1 mt-auto"
                    }
                  >
                    {renderActionButton && renderActionButton(card)}
                  </Container.Item>
                </Container>
              </Container.Item>
            ))}
          </Container>
        </Container.Item>
      </Container>
    </div>
  );
};

export default PluginRecommendations;
