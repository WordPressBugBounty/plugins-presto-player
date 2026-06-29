const { Icon } = wp.components;
import "./BackButton.scss";

export default ({ children, onClick }) => {
  return (
    <span
      onClick={onClick}
      className="presto-stream-back"
    >
      <Icon
        className="presto-stream-back__icon"
        icon="arrow-left-alt"
        size={14}
      />
      <span>{children}</span>
    </span>
  );
};
