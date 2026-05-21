import React from "react";
import { Container, Button, Text, Title } from "@bsf/force-ui";

const NoFound = ({ icon, title, description, buttonText, buttonIcon, onButtonClick }) => {
  return (
    <Container
      className="w-full bg-background-primary border border-solid border-border-subtle rounded-xl py-16 px-8 items-center"
      direction="column"
      gap="md"
    >
      {icon && (
        <Container.Item className="flex items-center justify-center">
          {icon}
        </Container.Item>
      )}
      <Container.Item className="flex flex-col items-center gap-2 [text-wrap:balance]">
        <Title size="sm" tag="h3" title={title} className="text-text-primary text-center" />
        <Text size="sm" className="font-normal text-text-secondary m-0 text-center">
          {description}
        </Text>
      </Container.Item>
      {buttonText && onButtonClick && (
        <Container.Item>
          <Button
            onClick={onButtonClick}
            variant="primary"
            size="md"
            icon={buttonIcon}
            iconPosition="left"
          >
            {buttonText}
          </Button>
        </Container.Item>
      )}
    </Container>
  );
};

export default NoFound;
