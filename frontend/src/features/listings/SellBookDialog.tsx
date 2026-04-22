import { useEffect, useMemo, useState } from "react";
import { fetchPrograms } from "../taxonomy/api";
import { createListing } from "./api";
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
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [condition, setCondition] = useState("good");
  const [description, setDescription] = useState("");

  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
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
        setError("Could not load programs for the selected department.");
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
      setError("Please select a course.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Please enter a valid price.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createListing(
        {
          title,
          price: parsedPrice,
          condition,
          description,
          subject_id: subjectId,
        },
        token,
      );
      onCreated();
      resetForm();
      onClose();
    } catch {
      setError("Could not create listing. Please verify your data and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sell-overlay" role="dialog" aria-modal="true" aria-label="Sell book">
      <div className="sell-dialog">
        <div className="sell-topbar">
          <h2>Sell a Book</h2>
          <button
            type="button"
            className="sell-close"
            onClick={() => {
              resetForm();
              onClose();
            }}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <form className="sell-form" onSubmit={handleSubmit}>
          <label>
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>

          <label>
            <span>Price (EUR)</span>
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
            <span>Condition</span>
            <select value={condition} onChange={(event) => setCondition(event.target.value)} required>
              <option value="new">new</option>
              <option value="good">good</option>
              <option value="fair">fair</option>
              <option value="used">used</option>
            </select>
          </label>

          <label>
            <span>Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="sell-filters">
            <label>
              <span>Department</span>
              <select
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setProgramId("");
                  setCourseId("");
                }}
                required
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={String(department.id)}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Program</span>
              <select
                value={programId}
                onChange={(event) => {
                  setProgramId(event.target.value);
                  setCourseId("");
                }}
                disabled={!departmentId || loadingPrograms}
                required
              >
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.id} value={String(program.id)}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Course</span>
              <select
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                disabled={!programId || loadingPrograms}
                required
              >
                <option value="">Select course</option>
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
            {submitting ? "Saving..." : "Publish Listing"}
          </button>
        </form>
      </div>
    </div>
  );
}
