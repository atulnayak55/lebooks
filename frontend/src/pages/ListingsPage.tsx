import { useEffect, useMemo, useState } from "react";
import { ListingCard } from "../components/ListingCard";
import { SearchBar } from "../components/SearchBar";
import { SelectField } from "../components/SelectField";
import { StatusMessage } from "../components/StatusMessage";
import type { AuthSession } from "../features/auth/session";
import { ChatDialog } from "../features/chat/ChatDialog";
import { isOwnListing } from "../features/listings/filter";
import { fetchListings } from "../features/listings/api";
import { SellBookDialog } from "../features/listings/SellBookDialog";
import { fetchDepartments, fetchPrograms } from "../features/taxonomy/api";
import type { useWebSocket } from "../hooks/useWebSocket";
import type { Course, Department, Listing, Program } from "../types/domain";

function toId(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

type ListingsPageProps = {
  authSession: AuthSession | null;
  chatConnection: ReturnType<typeof useWebSocket>;
};

export function ListingsPage({ authSession, chatConnection }: ListingsPageProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [searchText, setSearchText] = useState("");

  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [chatListing, setChatListing] = useState<Listing | null>(null);

  async function refreshListings(subjectId?: number) {
    setLoadingListings(true);
    setError(null);
    try {
      const listingData = await fetchListings(subjectId);
      setListings(listingData);
    } catch {
      setError("Could not load listings for the selected course.");
    } finally {
      setLoadingListings(false);
    }
  }

  useEffect(() => {
    async function loadInitialData() {
      setLoadingFilters(true);
      setLoadingListings(true);
      setError(null);

      try {
        const [departmentData, listingData] = await Promise.all([
          fetchDepartments(),
          fetchListings(),
        ]);
        setDepartments(departmentData);
        setListings(listingData);
      } catch {
        setError("Could not load listings right now. Please retry.");
      } finally {
        setLoadingFilters(false);
        setLoadingListings(false);
      }
    }

    void loadInitialData();
  }, []);

  useEffect(() => {
    async function loadPrograms() {
      const departmentId = toId(selectedDepartmentId);

      if (!departmentId) {
        setPrograms([]);
        setSelectedProgramId("");
        setSelectedCourseId("");
        return;
      }

      setLoadingFilters(true);
      setError(null);

      try {
        const programData = await fetchPrograms(departmentId);
        setPrograms(programData);
      } catch {
        setError("Could not load programs for this department.");
      } finally {
        setLoadingFilters(false);
      }
    }

    void loadPrograms();
  }, [selectedDepartmentId]);

  useEffect(() => {
    async function loadListingsByCourse() {
      await refreshListings(toId(selectedCourseId));
    }

    void loadListingsByCourse();
  }, [selectedCourseId]);

  const selectedProgram = useMemo(() => {
    const programId = toId(selectedProgramId);
    if (!programId) {
      return undefined;
    }

    return programs.find((program) => program.id === programId);
  }, [programs, selectedProgramId]);

  const courses: Course[] = selectedProgram?.subjects ?? [];

  const visibleListings = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const withoutOwnListings = authSession
      ? listings.filter((listing) => !isOwnListing(listing, authSession.userId))
      : listings;

    if (!query) {
      return withoutOwnListings;
    }

    return withoutOwnListings.filter((listing) => {
      return (
        listing.title.toLowerCase().includes(query) ||
        (listing.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [authSession, listings, searchText]);

  return (
    <section className="listings-page">
      <div className="listings-toolbar">
        <div className="toolbar-search">
          <SearchBar value={searchText} onChange={setSearchText} />
        </div>
        <button
          type="button"
          className="sell-book-button"
          onClick={() => {
            if (!authSession) {
              setSellError("Please sign in first to sell a book.");
              return;
            }
            setSellError(null);
            setSellDialogOpen(true);
          }}
          title="Sell a book"
        >
          + Sell Book
        </button>
      </div>

      {sellError ? <p className="sell-inline-error">{sellError}</p> : null}

      <div className="filters-row">
        <SelectField
          id="department-filter"
          label="Department"
          value={selectedDepartmentId}
          onChange={(value) => {
            setSelectedDepartmentId(value);
            setSelectedProgramId("");
            setSelectedCourseId("");
          }}
          disabled={loadingFilters}
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={String(department.id)}>
              {department.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="program-filter"
          label="Program"
          value={selectedProgramId}
          onChange={(value) => {
            setSelectedProgramId(value);
            setSelectedCourseId("");
          }}
          disabled={!selectedDepartmentId || loadingFilters}
        >
          <option value="">All programs</option>
          {programs.map((program) => (
            <option key={program.id} value={String(program.id)}>
              {program.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="course-filter"
          label="Course"
          value={selectedCourseId}
          onChange={setSelectedCourseId}
          disabled={!selectedProgramId || loadingFilters}
        >
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={String(course.id)}>
              {course.name}
            </option>
          ))}
        </SelectField>
      </div>

      {error ? (
        <StatusMessage
          title="Request failed"
          subtitle="Please make sure the backend is running and reachable from this app."
        />
      ) : null}

      {loadingListings ? (
        <StatusMessage title="Loading listings..." />
      ) : visibleListings.length === 0 ? (
        <StatusMessage
          title="No listings found"
          subtitle="Try a different search term or reset filters."
        />
      ) : (
        <div className="listings-grid">
          {visibleListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onMessageClick={(clickedListing) => {
                if (!authSession) {
                  alert("Please sign in to message sellers.");
                  return;
                }

                if (isOwnListing(clickedListing, authSession.userId)) {
                  alert("You cannot message yourself!");
                  return;
                }

                setChatListing(clickedListing);
                setChatDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <SellBookDialog
        open={sellDialogOpen}
        token={authSession?.token ?? ""}
        departments={departments}
        onClose={() => setSellDialogOpen(false)}
        onCreated={() => {
          void refreshListings(toId(selectedCourseId));
        }}
      />

      <ChatDialog
        open={chatDialogOpen}
        listing={chatListing}
        currentUserId={authSession?.userId ?? 0}
        token={authSession?.token ?? ""}
        chatConnection={chatConnection}
        onClose={() => {
          setChatDialogOpen(false);
          setChatListing(null);
        }}
      />
    </section>
  );
}
