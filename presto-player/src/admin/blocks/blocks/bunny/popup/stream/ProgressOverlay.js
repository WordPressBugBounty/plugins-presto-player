import "./ProgressOverlay.scss";
import ProgressBar from "./ProgressBar";

export default ({ progress }) => {
  return (
    <div className="presto-progress-overlay">
      <ProgressBar
        progress={progress}
        className="presto-progress-overlay__bar"
      />
    </div>
  );
};
