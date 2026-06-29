import "./ProgressBar.scss";

export default ({ className, progress }) => {
  return (
    <div className={className}>
      <div
        className="presto-progress-bar__fill"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};
