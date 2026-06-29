import "./ThumbTemplate.scss";

export default (props) => {
  const { thumbnail, title, footer, badge, before, after } = props;
  return (
    <div
      {...props}
      className={`presto-thumb ${props.className || ''}`}
    >
      {!!before && before}

      {!!thumbnail && thumbnail}

      <div className="presto-thumb__content">
        {!!badge && (
          <div className="presto-thumb__badge">
            {badge}
          </div>
        )}

        {!!title && (
          <span className="presto-thumb__title">
            {title}
          </span>
        )}

        {!!footer && (
          <div className="presto-thumb__footer">
            {footer}
          </div>
        )}
      </div>

      {!!after && after}
    </div>
  );
};
