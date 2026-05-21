import React from "react";
import { __ } from "@wordpress/i18n";
import { SearchBox } from "@bsf/force-ui";

const SearchBar = ({
  inputRef,
  value,
  onChange,
  placeholder = __("Search media…", "presto-player"),
}) => (
  <SearchBox size="sm" variant="secondary" className="w-64">
    <SearchBox.Input
      ref={inputRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  </SearchBox>
);

export default SearchBar;
