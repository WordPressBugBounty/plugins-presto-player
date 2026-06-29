import { __ } from "@wordpress/i18n";
import ProBadge from "../../../shared/components/ProBadge";
import "./TriggerSelection.scss";

const TriggerSelection = ({ triggerType, onTriggerTypeSelect }) => {
  return (
    <div className="presto-trigger-selection">
      <div
        className={`presto-trigger-selection__card ${triggerType === "image" ? "is-active" : ""}`}
        onClick={() => onTriggerTypeSelect("image")}
      >
        <div className="presto-trigger-selection__icon">
          <span className="dashicons dashicons-format-image"></span>
        </div>
        <div className="presto-trigger-selection__label">
          {__("Image", "presto-player")}
        </div>
        <div className="presto-trigger-selection__description">
          {__("Image thumbnail trigger", "presto-player")}
        </div>
      </div>

      <div
        className={`presto-trigger-selection__card ${triggerType === "button" ? "is-active" : ""}`}
        onClick={() => onTriggerTypeSelect("button")}
      >
        <div className="presto-trigger-selection__icon">
          <span className="dashicons dashicons-button"></span>
        </div>
        <div className="presto-trigger-selection__label">
          {__("Button", "presto-player")}
        </div>
        <div className="presto-trigger-selection__description">
          {__("Simple button trigger", "presto-player")}
        </div>
      </div>

      <div
        className={`presto-trigger-selection__card ${triggerType === "custom" ? "is-active" : ""}`}
        onClick={() => onTriggerTypeSelect("custom")}
      >
        {!prestoPlayer?.hasRequiredProVersion?.popups && (
          <div className="presto-trigger-selection__pro-badge">
            <ProBadge />
          </div>
        )}
        <div className="presto-trigger-selection__icon">
          <span className="dashicons dashicons-edit"></span>
        </div>
        <div className="presto-trigger-selection__label">
          {__("Custom", "presto-player")}
        </div>
        <div className="presto-trigger-selection__description">
          {__("Create your own trigger", "presto-player")}
        </div>
      </div>
    </div>
  );
};

export default TriggerSelection;
