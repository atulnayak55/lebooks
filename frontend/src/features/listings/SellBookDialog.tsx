import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { fetchPrograms } from "../taxonomy/api";
import { createListing, uploadListingImages } from "./api";
import type { Department, Program } from "../../types/domain";

type SellBookDialogProps = {
  open: boolean;
  token: string;
  departments: Department[];
  onClose: () => void;
  onCreated: () => void;
};

function toId(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function SellBookDialog({
  open,
  token,
  departments,
  onClose,
  onCreated,
}: SellBookDialogProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [condition, setCondition] = useState("good");
  const [description, setDescription] = useState("");

  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setPrice("");
    setCondition("good");
    setDescription("");
    setDepartmentId("");
    setProgramId("");
    setCourseId("");
    setImageFiles([]);
    setPrograms([]);
    setError(null);
  }

  useEffect(() => {
    async function loadPrograms() {
      const selectedDepartment = toId(departmentId);
      if (!selectedDepartment) {
        setPrograms([]);
        setProgramId("");
        setCourseId("");
        return;
      }

      setLoadingPrograms(true);
      setError(null);
      try {
        const data = await fetchPrograms(selectedDepartment);
        setPrograms(data);
      } catch {
        setError(t("sell.errorPrograms"));
      } finally {
        setLoadingPrograms(false);
      }
    }

    void loadPrograms();
  }, [departmentId]);

  const selectedProgram = useMemo(() => {
    const id = toId(programId);
    if (!id) {
      return undefined;
    }
    return programs.find((program) => program.id === id);
  }, [programId, programs]);

  const courses = useMemo(() => selectedProgram?.subjects ?? [], [selectedProgram]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subjectId = toId(courseId);
    const parsedPrice = Number(price);

    if (!subjectId) {
      setError(t("sell.errorCourse"));
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError(t("sell.errorPrice"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newListing = await createListing(
        {
          title,
          price: parsedPrice,
          condition,
          description,
          subject_id: subjectId,
        },
        token,
      );

      if (imageFiles.length > 0) {
        await uploadListingImages(newListing.id, imageFiles, token);
      }

      onCreated();
      resetForm();
      onClose();
    } catch {
      setError(t("sell.errorCreate"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sell-overlay" role="dialog" aria-modal="true" aria-label={t("sell.dialog")}>
      <div className="sell-dialog">
        <div className="sell-topbar">
          <h2>{t("sell.title")}</h2>
          <button
            type="button"
            className="sell-close"
            onClick={() => {
              resetForm();
              onClose();
            }}
            aria-label={t("sell.close")}
          >
            x
          </button>
        </div>

        <form className="sell-form" onSubmit={handleSubmit}>
          <label>
            <span>{t("sell.bookTitle")}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>

          <label>
            <span>{t("sell.price")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </label>

          <label>
            <span>{t("sell.condition")}</span>
            <select value={condition} onChange={(event) => setCondition(event.target.value)} required>
              <option value="new">{t("card.condition.new")}</option>
              <option value="good">{t("card.condition.good")}</option>
              <option value="fair">{t("card.condition.fair")}</option>
              <option value="used">{t("card.condition.used")}</option>
            </select>
          </label>

          <label>
            <span>{t("sell.description")}</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label>
            <span>{t("sell.images")}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  setImageFiles((previousFiles) => [...previousFiles, ...files]);
                }
                event.currentTarget.value = "";
              }}
              style={{ padding: "0.3rem" }}
            />
            {imageFiles.length > 0 ? (
              <small>
                {t("sell.imagesSelected", {
                  count: imageFiles.length,
                  names: imageFiles.map((file) => file.name).join(", "),
                })}
              </small>
            ) : null}
          </label>

          <div className="sell-filters">
            <label>
              <span>{t("sell.department")}</span>
              <select
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setProgramId("");
                  setCourseId("");
                }}
                required
              >
                <option value="">{t("sell.selectDepartment")}</option>
                {departments.map((department) => (
                  <option key={department.id} value={String(department.id)}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t("sell.program")}</span>
              <select
                value={programId}
                onChange={(event) => {
                  setProgramId(event.target.value);
                  setCourseId("");
                }}
                disabled={!departmentId || loadingPrograms}
                required
              >
                <option value="">{t("sell.selectProgram")}</option>
                {programs.map((program) => (
                  <option key={program.id} value={String(program.id)}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t("sell.course")}</span>
              <select
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                disabled={!programId || loadingPrograms}
                required
              >
                <option value="">{t("sell.selectCourse")}</option>
                {courses.map((course) => (
                  <option key={course.id} value={String(course.id)}>
                    {course.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <p className="sell-error">{error}</p> : null}

          <button type="submit" className="sell-submit" disabled={submitting}>
            {submitting ? t("sell.saving") : t("sell.publish")}
          </button>
        </form>
      </div>
    </div>
  );
}
