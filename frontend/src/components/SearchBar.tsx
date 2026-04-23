import { useI18n } from "../i18n/I18nProvider";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useI18n();

  return (
    <label className="search-wrap" htmlFor="listing-search">
      <span className="search-label">{t("search.label")}</span>
      <input
        id="listing-search"
        type="search"
        className="search-input"
        placeholder={t("search.placeholder")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
