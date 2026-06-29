import "./Tag.scss";

export default ({ label, className, ...props }) => {
  return (
    <span
      className={`presto-tag${className ? ` ${className}` : ""}`}
      {...props}
    >
      {label}
    </span>
  );
};
