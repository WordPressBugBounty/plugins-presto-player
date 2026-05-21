import { Select, Text } from "@bsf/force-ui";
import { __ } from "@wordpress/i18n";

export const TRANSCRIPTION_LANGUAGES = [
  { label: "Arabic", value: "ar" },
  { label: "Armenian", value: "hy" },
  { label: "Azerbaijani", value: "az" },
  { label: "Belarusian", value: "be" },
  { label: "Bosnian", value: "bs" },
  { label: "Bulgarian", value: "bg" },
  { label: "Catalan", value: "ca" },
  { label: "Chinese", value: "zh" },
  { label: "Croatian", value: "hr" },
  { label: "Czech", value: "cs" },
  { label: "Danish", value: "da" },
  { label: "Dutch", value: "nl" },
  { label: "English", value: "en" },
  { label: "Estonian", value: "et" },
  { label: "Finnish", value: "fi" },
  { label: "French", value: "fr" },
  { label: "Galician", value: "gl" },
  { label: "German", value: "de" },
  { label: "Greek", value: "el" },
  { label: "Hebrew", value: "he" },
  { label: "Hindi", value: "hi" },
  { label: "Hungarian", value: "hu" },
  { label: "Icelandic", value: "is" },
  { label: "Indonesian", value: "id" },
  { label: "Italian", value: "it" },
  { label: "Japanese", value: "ja" },
  { label: "Kannada", value: "kn" },
  { label: "Kazakh", value: "kk" },
  { label: "Korean", value: "ko" },
  { label: "Latvian", value: "lv" },
  { label: "Lithuanian", value: "lt" },
  { label: "Macedonian", value: "mk" },
  { label: "Malay", value: "ms" },
  { label: "Maori", value: "mi" },
  { label: "Marathi", value: "mr" },
  { label: "Nepali", value: "ne" },
  { label: "Norwegian", value: "no" },
  { label: "Persian", value: "fa" },
  { label: "Polish", value: "pl" },
  { label: "Portuguese", value: "pt" },
  { label: "Romanian", value: "ro" },
  { label: "Russian", value: "ru" },
  { label: "Serbian", value: "sr" },
  { label: "Slovak", value: "sk" },
  { label: "Slovenian", value: "sl" },
  { label: "Spanish", value: "es" },
  { label: "Swahili", value: "sw" },
  { label: "Swedish", value: "sv" },
  { label: "Tagalog", value: "tl" },
  { label: "Tamil", value: "ta" },
  { label: "Thai", value: "th" },
  { label: "Turkish", value: "tr" },
  { label: "Ukrainian", value: "uk" },
  { label: "Urdu", value: "ur" },
  { label: "Vietnamese", value: "vi" },
  { label: "Welsh", value: "cy" },
];

export const getLanguageLabel = (value) => {
  const lang = TRANSCRIPTION_LANGUAGES.find((l) => l.value === value);
  return lang ? lang.label : value;
};

export const getLanguageValue = (label) => {
  const lang = TRANSCRIPTION_LANGUAGES.find((l) => l.label === label);
  return lang ? lang.value : null;
};

const TranscriptionLanguageSelect = ({
  value = [],
  onChange,
  showWarning = false,
}) => {
  const hasNoLanguages = !value || value.length === 0;
  const helpText = hasNoLanguages && showWarning
    ? __(
        "At least one language is required. Please select at least one language.",
        "presto-player"
      )
    : __(
        "Select one or more languages. Start typing to search.",
        "presto-player"
      );

  return (
    <div className="presto-player__transcription-languages flex flex-col gap-1">
      <Select
        multiple
        combobox
        size="md"
        value={value}
        onChange={onChange}
        searchPlaceholder={__("Search languages…", "presto-player")}
      >
        <Select.Button
          label={__("Languages", "presto-player")}
          placeholder={__("Select languages…", "presto-player")}
          render={(selected) =>
            Array.isArray(selected)
              ? selected.map(getLanguageLabel).join(", ")
              : getLanguageLabel(selected)
          }
        />
        <Select.Options>
          {TRANSCRIPTION_LANGUAGES.map((option) => (
            <Select.Option key={option.value} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select.Options>
      </Select>
      <Text size="xs" className="text-text-tertiary">
        {helpText}
      </Text>
    </div>
  );
};

export default TranscriptionLanguageSelect;
