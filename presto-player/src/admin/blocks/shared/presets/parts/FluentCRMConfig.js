/**
 * WordPress dependencies
 */
const { __ } = wp.i18n;
const { SelectControl, Notice } = wp.components;
const { useEffect, useState } = wp.element;
import LoadSelect from "../../components/LoadSelect";

export default ({ options, updateEmailState }) => {
  // Start in the fetching state since both requests fire on mount, so the
  // empty-state help doesn't flash before the lists/tags have loaded.
  const [fetchingLists, setFetchingLists] = useState(true);
  const [fetchingTags, setFetchingTags] = useState(true);

  const [lists, setLists] = useState([
    { value: null, label: __("Choose a list", "presto-player") },
  ]);
  const [tags, setTags] = useState([
    { value: null, label: __("Choose a tag", "presto-player") },
  ]);
  const [error, setError] = useState("");

  const fetchLists = async () => {
    setFetchingLists(true);
    try {
      const fetched = await wp.apiFetch({
        path: "presto-player/v1/fluentcrm/lists",
      });

      let listOptions = lists;
      (fetched || []).forEach((list) => {
        listOptions = [
          ...listOptions,
          ...[
            {
              value: list.id,
              label: list.title || list.slug,
            },
          ],
        ];
      });
      setLists(listOptions);
    } catch (e) {
      if (e?.message) {
        setError(e.message);
      }
    } finally {
      setFetchingLists(false);
    }
  };

  const fetchTags = async () => {
    setFetchingTags(true);
    try {
      const fetched = await wp.apiFetch({
        path: "presto-player/v1/fluentcrm/tags",
      });

      let tagOptions = tags;
      (fetched || []).forEach((tag) => {
        tagOptions = [
          ...tagOptions,
          ...[
            {
              value: tag.id,
              label: tag.title || tag.slug,
            },
          ],
        ];
      });
      setTags(tagOptions);
    } catch (e) {
      if (e?.message) {
        setError(e.message);
      }
    } finally {
      setFetchingTags(false);
    }
  };

  useEffect(() => {
    fetchLists();
    fetchTags();
  }, []);

  if (error) {
    return (
      <Notice className="presto-notice" status="error" isDismissible={false}>
        {error}
      </Notice>
    );
  }

  return (
    <div>
      {fetchingLists ? (
        <LoadSelect />
      ) : (
        <SelectControl
          label={__("Choose a list", "presto-player")}
          value={options?.provider_list}
          options={lists}
          onChange={(provider_list) => updateEmailState({ provider_list })}
          // length 1 = only the placeholder option, i.e. FluentCRM has no lists yet
          help={
            lists.length <= 1
              ? __(
                  "No lists found in FluentCRM. Create a list in FluentCRM to assign contacts to it.",
                  "presto-player"
                )
              : undefined
          }
        />
      )}

      {fetchingTags ? (
        <LoadSelect />
      ) : (
        <SelectControl
          label={__("Choose a tag", "presto-player")}
          value={options?.provider_tag}
          options={tags}
          onChange={(provider_tag) => updateEmailState({ provider_tag })}
          help={
            tags.length <= 1
              ? __(
                  "No tags found in FluentCRM. Create a tag in FluentCRM to apply it to contacts.",
                  "presto-player"
                )
              : undefined
          }
        />
      )}
    </div>
  );
};
