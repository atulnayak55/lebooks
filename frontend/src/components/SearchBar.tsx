import { useI18n } from "../i18n/useI18n";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useI18n();

  return (
    <label className="search-wrap" htmlFor="listing-search">
      <span className="search-label">{t("search.label")}</span>
      <span className="search-input-shell">
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          id="listing-search"
          type="search"
          className="search-input"
          placeholder={t("search.placeholder")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}
