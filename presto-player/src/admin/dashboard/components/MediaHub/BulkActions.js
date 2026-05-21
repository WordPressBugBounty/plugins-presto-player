import React from "react";
import { __ } from "@wordpress/i18n";
import { Container, Button } from "@bsf/force-ui";
import { Trash, Trash2, CheckCheck, FolderArchive } from "lucide-react";

const BulkActions = ({
  selected = [],
  onDelete,
  onTrash,
  onStatusChange,
  onCancel,
}) => {
  if (selected.length === 0) {
    return null;
  }

  return (
    <Container.Item className="flex justify-between items-center gap-2 bg-background-primary px-6 py-4 rounded-lg">
      <span className="text-sm font-normal leading-5 text-text-secondary">
        <span className="text-text-primary">
          {__("Bulk actions: ", "presto-player")}
        </span>
        {selected.length} {__("media selected", "presto-player")}
      </span>
      <div className="flex items-center gap-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStatusChange(selected, "publish")}
          className="text-text-primary"
          icon={<CheckCheck width="15" height="15" />}
          iconPosition="left"
        >
          {__("Publish", "presto-player")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStatusChange(selected, "draft")}
          className="text-text-primary"
          icon={<FolderArchive width="15" height="15" />}
          iconPosition="left"
        >
          {__("Draft", "presto-player")}
        </Button>
        {onTrash && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTrash(selected)}
            className="text-text-primary"
            icon={<Trash width="15" height="15" />}
            aria-label={__("Move to Trash", "presto-player")}
            iconPosition="left"
          >
            {__("Trash", "presto-player")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(selected)}
          className="text-text-primary"
          icon={<Trash2 width="15" height="15" />}
          aria-label={__("Delete permanently", "presto-player")}
          iconPosition="left"
        >
          {__("Delete", "presto-player")}
        </Button>
        <div className="border border-solid h-4 bg-red-400" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-text-primary"
        >
          {__("Cancel", "presto-player")}
        </Button>
      </div>
    </Container.Item>
  );
};

export default BulkActions;
