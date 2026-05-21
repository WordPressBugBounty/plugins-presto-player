import { Children, cloneElement, isValidElement } from "react";
import { Text } from "@bsf/force-ui";
import useLink from "../hooks/useLink";

const Link = ({ params, children, ...props }) => {
  const { href, onClick } = useLink(params);

  // If a single valid React element is provided, clone it with routing props
  if (isValidElement(children) && Children.count(children) === 1) {
    return cloneElement(children, {
      href,
      onClick,
      ...props,
    });
  }

  // Default fallback: wrap in Force UI Text as anchor
  return (
    <Text as="a" href={href} onClick={onClick} className="no-underline hover:no-underline" {...props}>
      {children}
    </Text>
  );
};

export default Link;
