import "./Uploads.scss";

import Upload from "./Upload";
const { useSelect } = wp.data;

export default ({ removeUpload, isPrivate }) => {
  const uploads = useSelect((select) =>
    select("presto-player/bunny-popup").uploads()
  );

  if (!uploads.length) {
    return "";
  }

  return (
    <div className="presto-stream-uploads">
      {uploads.length &&
        uploads.map((upload) => {
          return (
            <Upload
              className="presto-stream-uploads__item"
              file={upload}
              onComplete={() => removeUpload(upload)}
            />
          );
        })}
    </div>
  );
};
