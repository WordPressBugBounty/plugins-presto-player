import React, { useState, useEffect, useCallback, useMemo } from "react";
import { __ } from "@wordpress/i18n";
import apiFetch from "@wordpress/api-fetch";
import { decodeHTMLEntities } from "../../utils/formatters";
import {
  Button,
  Dialog,
  Container,
  Badge,
  Loader,
  Input,
  Select,
  Text,
  Checkbox,
  Label,
  Tooltip,
  toast,
} from "@bsf/force-ui";
import { CircleX, Settings, Info } from "lucide-react";
import PostScheduleField from "../PostScheduleField";
import {
  getInitialState,
  toPublishedDateTime,
} from "../Popup/EmailFormPopupUtils";

const statusOptions = [
  { value: "publish", label: __("Published", "presto-player") },
  { value: "draft", label: __("Draft", "presto-player") },
  { value: "pending", label: __("Pending Review", "presto-player") },
  { value: "future", label: __("Scheduled", "presto-player") },
];

const getStatusLabel = (statusValue) => {
  return (
    statusOptions.find((o) => o.value === statusValue)?.label ||
    __("Draft", "presto-player")
  );
};

const MAX_VISIBLE_TAGS = 20;

const defaultForm = {
  title: "",
  slug: "",
  status: "publish",
  postDate: null,
  postTimeValue: "",
  postPeriod: "-1",
  password: "",
  passwordTouched: false,
  isPrivate: false,
  selectedTagIds: [],
};

const PostSettings = ({
  open,
  onClose,
  onSuccess,
  mediaId,
  initialTitle = "",
  initialStatus = "publish",
  initialSlug = "",
  initialDate = "",
  initialPassword = "",
  initialTags = [],
  availableTags = [],
}) => {
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  // Tags created by the user during this session (not yet in availableTags).
  const [createdTags, setCreatedTags] = useState([]);
  // Tags currently displayed in the dropdown (filtered by search + optional "Create" entry).
  const [displayedTags, setDisplayedTags] = useState([]);
  // Tracks whether the user touched the date/time/period picker. Without this,
  // every save round-trips the time through the 10-min picker granularity and
  // drifts the stored post_date by up to 10 minutes — losing precision on edits
  // that didn't intend to change the timestamp at all.
  const [dateTouched, setDateTouched] = useState(false);

  const updateField = useCallback(
    (field) => (value) => setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  useEffect(() => {
    const isPrivate = initialStatus === "private";
    const { publishedDate, publishedTimeValue, publishedPeriod } = getInitialState({
      date: initialDate,
      status: initialStatus,
    });

    setForm({
      title: initialTitle,
      slug: initialSlug,
      password: initialPassword,
      passwordTouched: false,
      isPrivate,
      // If private, show as "publish" in dropdown since Private is handled separately
      status: isPrivate ? "publish" : initialStatus,
      postDate: publishedDate,
      postTimeValue: publishedTimeValue,
      postPeriod: publishedPeriod,
      selectedTagIds:
        initialTags?.length > 0 ? initialTags.map((tag) => tag.id) : [],
    });
    setCreatedTags([]);
    setDateTouched(false);
  }, [
    initialTitle,
    initialStatus,
    initialSlug,
    initialDate,
    initialPassword,
    initialTags,
  ]);


  const allTags = useMemo(
    () => [...availableTags, ...createdTags],
    [availableTags, createdTags]
  );

  // Keep displayedTags in sync when allTags changes (e.g. after creating a tag).
  useEffect(() => {
    setDisplayedTags(allTags.slice(0, MAX_VISIBLE_TAGS));
  }, [allTags]);

  // Resolve a tag ID to its display name.
  const getTagName = useCallback(
    (id) => decodeHTMLEntities( allTags.find((tag) => tag.id === id)?.name ?? id ),
    [allTags]
  );

  const resetForm = () => {
    setForm(defaultForm);
    setCreatedTags([]);
    setErrorMessage("");
    setSaving(false);
    setDateTouched(false);
  };

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose();
    }
  };

  const handlePasswordChange = (value) => {
    setForm((prev) => ({
      ...prev,
      password: value,
      passwordTouched: true,
      ...(value ? { isPrivate: false } : {}),
    }));
  };

  const handlePrivateChange = (checked) => {
    setForm((prev) => ({
      ...prev,
      isPrivate: checked,
      ...(checked ? { password: "", passwordTouched: true } : {}),
    }));
  };

  const handleTagSearch = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === "") {
      setDisplayedTags(allTags.slice(0, MAX_VISIBLE_TAGS));
      return;
    }

    const term = searchTerm.trim().toLowerCase();
    const filtered = allTags
      .filter((tag) => decodeHTMLEntities(tag.name).toLowerCase().includes(term))
      .slice(0, MAX_VISIBLE_TAGS);

    const exactMatch = allTags.some(
      (tag) => decodeHTMLEntities(tag.name).toLowerCase() === term
    );

    if (!exactMatch) {
      filtered.push({
        id: `create:${searchTerm.trim()}`,
        name: `${__("Create", "presto-player")} "${searchTerm.trim()}"`,
      });
    }

    setDisplayedTags(filtered);
  };

  const handleTagChange = async (selectedValues) => {
    if (!selectedValues) {
      updateField("selectedTagIds")([]);
      return;
    }

    const valuesArray = Array.isArray(selectedValues)
      ? selectedValues
      : [selectedValues];

    const createValue = valuesArray.find(
      (val) => typeof val === "string" && val.startsWith("create:")
    );

    if (createValue) {
      const newTagName = createValue.replace("create:", "");

      try {
        const newTag = await apiFetch({
          path: "/wp/v2/pp_video_tag",
          method: "POST",
          data: { name: newTagName },
        });

        const newTagEntry = { id: newTag.id, name: newTag.name };
        const updatedIds = valuesArray
          .filter((val) => val !== createValue)
          .concat(newTag.id);

        setCreatedTags((prev) => [...prev, newTagEntry]);
        // Reset displayed tags so the badge can resolve the new ID to a name.
        setDisplayedTags((prev) => {
          const withoutCreate = prev.filter(
            (t) => typeof t.id !== "string" || !t.id.startsWith("create:")
          );
          return [...withoutCreate, newTagEntry];
        });
        updateField("selectedTagIds")(updatedIds);
      } catch (error) {
        console.error("Failed to create tag:", error);
      }
    } else {
      updateField("selectedTagIds")(valuesArray);
    }
  };

  const handleSaveSettings = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const actualStatus = form.isPrivate ? "private" : form.status;
      const tagIds = form.selectedTagIds.filter((id) => typeof id === "number");

      // Strip WP's get_the_title() prefix before saving. The row data uses
      // `title.rendered`, which WP filters through protected_title_format /
      // private_title_format and prepends "Protected: " / "Private: " for
      // password-protected / private posts. Without this strip, the prefixed
      // string gets stored as post_title and a fresh prefix is added on every
      // render — compounding on every save.
      const protectedPrefix = wp.i18n.__("Protected: %s").replace("%s", "");
      const privatePrefix = wp.i18n.__("Private: %s").replace("%s", "");
      let cleanTitle = form.title;
      if (cleanTitle.startsWith(protectedPrefix)) {
        cleanTitle = cleanTitle.slice(protectedPrefix.length);
      } else if (cleanTitle.startsWith(privatePrefix)) {
        cleanTitle = cleanTitle.slice(privatePrefix.length);
      }

      const data = {
        title: cleanTitle,
        slug: form.slug,
        status: actualStatus,
        pp_video_tag: tagIds,
      };

      // Only send password if the user modified it to avoid clearing existing passwords
      // (WP REST API doesn't return password values in list responses).
      if (form.passwordTouched) {
        data.password = form.isPrivate ? "" : form.password;
      }

      if (dateTouched) {
        const formattedDate = toPublishedDateTime(
          form.postDate,
          form.postTimeValue,
          form.postPeriod
        );
        if (formattedDate) {
          data.date = formattedDate;
        }
      }

      const response = await apiFetch({
        path: `/wp/v2/presto-videos/${mediaId}`,
        method: "POST",
        data,
      });

      setSaving(false);
      // Keep the dialog open with the saved values visible — only reset
      // passwordTouched so a subsequent save in the same session doesn't
      // re-send an unchanged password (WP REST never echoes the real
      // value back, so leaving the flag true would send the user's input
      // every time they hit Save).
      setForm((prev) => ({ ...prev, passwordTouched: false }));

      if (typeof onSuccess === "function") {
        // Pass allTags so the parent can resolve tag names without an extra API call
        // (includes any tags the user created during this session).
        onSuccess(response, {
          passwordTouched: form.passwordTouched,
          tagOptions: allTags,
        });
      }

      toast.success(__("Settings saved.", "presto-player"));
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaving(false);
      setErrorMessage(
        error.message ||
          __("An error occurred while saving the settings", "presto-player")
      );
    }
  };

  return (
    <Dialog
      design="simple"
      exitOnEsc
      scrollLock
      open={open}
      setOpen={(isOpen) => !isOpen && handleClose()}
    >
      <Dialog.Backdrop />

      <Dialog.Panel className="max-w-2xl w-full overflow-visible">
        <Dialog.Header>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings size={20} />
              <Dialog.Title>
                {__("Post Settings", "presto-player")}
              </Dialog.Title>
            </div>
            <Dialog.CloseButton onClick={handleClose} />
          </div>
        </Dialog.Header>

        <Dialog.Body>
          <Container containerType="flex" direction="column">
            {errorMessage && (
              <Container.Item>
                <Badge
                  icon={<CircleX />}
                  label={errorMessage}
                  size="md"
                  type="rounded"
                  variant="red"
                  className="py-6 px-4 justify-start"
                  role="alert"
                />
              </Container.Item>
            )}

            <Container.Item>
              <Input
                type="text"
                size="md"
                label={__("Title", "presto-player")}
                value={form.title}
                onChange={updateField("title")}
                placeholder={__("Enter title…", "presto-player")}
              />
            </Container.Item>

            <Container.Item>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Label size="sm">{ __( "Slug", "presto-player" ) }</Label>
                  <Tooltip
                    content={ __( "The URL-friendly version of the title. Used in the media page address.", "presto-player" ) }
                    arrow
                    placement="right"
                  >
                    <Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
                  </Tooltip>
                </div>
                <Input
                  type="text"
                  size="md"
                  value={form.slug}
                  onChange={updateField("slug")}
                  placeholder={__("Enter slug…", "presto-player")}
                />
              </div>
            </Container.Item>

            <Container.Item>
              <Select
                multiple
                combobox
                size="md"
                value={form.selectedTagIds}
                onChange={handleTagChange}
                searchPlaceholder={__(
                  "Search or create tags…",
                  "presto-player"
                )}
                searchFn={handleTagSearch}
              >
                <Select.Button
                  label={__("Media Tags", "presto-player")}
                  placeholder={__("Select tags…", "presto-player")}
                  render={(selected) =>
                    Array.isArray(selected)
                      ? selected.map(getTagName).join(", ")
                      : getTagName(selected)
                  }
                />
                <Select.Options>
                  {displayedTags.map((option) => (
                    <Select.Option key={option.id} value={option.id}>
                      {decodeHTMLEntities(option.name)}
                    </Select.Option>
                  ))}
                </Select.Options>
              </Select>
            </Container.Item>

            <Container.Item>
              <Select
                by="value"
                size="md"
                value={{
                  value: form.status,
                  label: getStatusLabel(form.status),
                }}
                onChange={(selectedOption) => {
                  if (selectedOption) {
                    updateField("status")(selectedOption.value);
                  }
                }}
              >
                <Select.Button
                  label={__("Status", "presto-player")}
                  render={(value) => value?.label}
                />
                <Select.Options>
                  {statusOptions.map((option) => (
                    <Select.Option
                      key={option.value}
                      value={{
                        value: option.value,
                        label: option.label,
                      }}
                    >
                      {option.label}
                    </Select.Option>
                  ))}
                </Select.Options>
              </Select>
            </Container.Item>

            <PostScheduleField
              date={form.postDate}
              time={form.postTimeValue}
              period={form.postPeriod}
              setDate={(v) => { setDateTouched(true); updateField("postDate")(v); }}
              setTime={(v) => { setDateTouched(true); updateField("postTimeValue")(v); }}
              setPeriod={(v) => { setDateTouched(true); updateField("postPeriod")(v); }}
            />


            <Container.Item>
              <Container
                containerType="flex"
                direction="row"
                gap="sm"
                className="items-end"
              >
                <Container.Item className="flex-1">
                  <Input
                    type="text"
                    size="md"
                    label={__("Password", "presto-player")}
                    value={form.password}
                    onChange={handlePasswordChange}
                    placeholder={__("Enter password…", "presto-player")}
                    disabled={form.isPrivate}
                  />
                </Container.Item>
                <Container.Item className="pb-2.5">
                  <Text size="sm" className="text-text-secondary">
                    {__("—OR—", "presto-player")}
                  </Text>
                </Container.Item>
                <Container.Item className="pb-2.5">
                  <Checkbox
                    size="sm"
                    checked={form.isPrivate}
                    onChange={handlePrivateChange}
                    label={{
                      heading: (
                        <span className="inline-flex items-center gap-1.5">
                          {__("Private", "presto-player")}
                          <Tooltip
                            content={__("Hides this media from everyone except administrators. Overrides password protection.", "presto-player")}
                            arrow
                            placement="right"
                          >
                            <Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
                          </Tooltip>
                        </span>
                      ),
                    }}
                  />
                </Container.Item>
              </Container>
            </Container.Item>
          </Container>
        </Dialog.Body>

        <Dialog.Footer className="pt-0 justify-between">
          <Button
            size="md"
            variant="outline"
            onClick={handleClose}
            disabled={saving}
          >
            {__("Cancel", "presto-player")}
          </Button>
          <Button
            size="md"
            disabled={saving}
            onClick={handleSaveSettings}
            iconPosition="right"
            icon={
              saving && (
                <Loader icon={null} size="sm" variant="primary" />
              )
            }
          >
            {__("Save Settings", "presto-player")}
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
};

export default PostSettings;
