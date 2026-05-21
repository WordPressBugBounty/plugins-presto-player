/**
 * Shared list-page header: title, optional filter toggle, search, primary action button.
 * Matches MediaHub layout/design. Used by MediaHub and Emails.
 */
import React from "react";
import { __ } from "@wordpress/i18n";
import { Container, Title, Button } from "@bsf/force-ui";
import { ListFilter, Plus } from "lucide-react";
import SearchBar from "./MediaHub/SearchBar";

const PageHeader = ({
  title,
  showFilter,
  setShowFilter,
  showFilterWhen,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  searchInputRef,
  primaryButtonText,
  onPrimaryClick,
}) => (
  <Container className="w-full flex items-center justify-between">
    <Container.Item grow={1}>
      <Title
        description=""
        icon={null}
        iconPosition="right"
        size="md"
        tag="h4"
        title={title}
      />
    </Container.Item>
    <Container.Item className="flex items-center gap-6">
      {showFilterWhen && (
        <Button
          aria-label={__("Toggle filters", "presto-player")}
          aria-pressed={showFilter}
          icon={<ListFilter aria-label="icon" role="img" />}
          iconPosition="left"
          size="sm"
          tag="button"
          type="button"
          variant={showFilter ? "primary" : "ghost"}
          onClick={() => setShowFilter(!showFilter)}
        />
      )}
      <SearchBar
        inputRef={searchInputRef}
        value={searchValue}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
      />
      <Button
        icon={<Plus aria-label="icon" role="img" />}
        iconPosition="left"
        size="sm"
        tag="button"
        type="button"
        variant="primary"
        onClick={onPrimaryClick}
      >
        {primaryButtonText}
      </Button>
    </Container.Item>
  </Container>
);

export default PageHeader;
