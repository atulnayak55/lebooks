import { useEffect, useMemo, useState } from "react";
import { ListingCard } from "../components/ListingCard";
import { SearchBar } from "../components/SearchBar";
import { SelectField } from "../components/SelectField";
import { StatusMessage } from "../components/StatusMessage";
import type { AuthSession } from "../features/auth/session";
import { ChatDialog } from "../features/chat/ChatDialog";
import { isOwnListing } from "../features/listings/filter";
import { fetchListings } from "../features/listings/api";
import { ListingDetailsDialog } from "../features/listings/ListingDetailsDialog";
import { SellBookDialog } from "../features/listings/SellBookDialog";
import { fetchDepartments, fetchPrograms } from "../features/taxonomy/api";
import type { useWebSocket } from "../hooks/useWebSocket";
import { useI18n } from "../i18n/I18nProvider";
import type { Course, Department, Listing, Program } from "../types/domain";

const LISTINGS_PER_PAGE = 25;

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
  const { t } = useI18n();
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
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsListing, setDetailsListing] = useState<Listing | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  async function refreshListings(subjectId?: number) {
    setLoadingListings(true);
    setError(null);
    try {
      const listingData = await fetchListings(subjectId);
      setListings(listingData);
    } catch {
      setError(t("listings.loadCourseError"));
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
        setError(t("listings.loadError"));
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
        setError(t("listings.loadProgramsError"));
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
  const selectedDepartment = useMemo(() => {
    const departmentId = toId(selectedDepartmentId);
    if (!departmentId) {
      return undefined;
    }

    return departments.find((department) => department.id === departmentId);
  }, [departments, selectedDepartmentId]);

  const selectedCourse = useMemo(() => {
    const courseId = toId(selectedCourseId);
    if (!courseId) {
      return undefined;
    }

    return courses.find((course) => course.id === courseId);
  }, [courses, selectedCourseId]);

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

  const activeFilterChips = [
    searchText.trim() ? t("listings.filterChip.search", { value: searchText.trim() }) : null,
    selectedDepartment
      ? t("listings.filterChip.department", { value: selectedDepartment.name })
      : null,
    selectedProgram ? t("listings.filterChip.program", { value: selectedProgram.name }) : null,
    selectedCourse ? t("listings.filterChip.course", { value: selectedCourse.name }) : null,
  ].filter((value): value is string => Boolean(value));

  const totalPages = Math.max(1, Math.ceil(visibleListings.length / LISTINGS_PER_PAGE));

  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * LISTINGS_PER_PAGE;
    return visibleListings.slice(start, start + LISTINGS_PER_PAGE);
  }, [currentPage, visibleListings]);

  const pageStart = visibleListings.length === 0 ? 0 : (currentPage - 1) * LISTINGS_PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * LISTINGS_PER_PAGE, visibleListings.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selectedCourseId, selectedDepartmentId, selectedProgramId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function resetFilters() {
    setSearchText("");
    setSelectedDepartmentId("");
    setSelectedProgramId("");
    setSelectedCourseId("");
  }

  function handleMessageListing(clickedListing: Listing) {
    if (!authSession) {
      alert(t("listings.messageToChat"));
      return;
    }

    if (isOwnListing(clickedListing, authSession.userId)) {
      alert(t("listings.cannotMessageSelf"));
      return;
    }

    setChatListing(clickedListing);
    setChatDialogOpen(true);
    setDetailsDialogOpen(false);
  }

  return (
    <section className="listings-page">
      <section className="market-controls" aria-label={t("nav.marketplace")}>
        <div className="listings-toolbar">
          <div className="toolbar-search">
            <SearchBar value={searchText} onChange={setSearchText} />
            <p className="listings-toolbar-note">{t("listings.browseHint")}</p>
          </div>
        </div>

        <div className="market-controls-row">
          <div className="filters-row">
            <SelectField
              id="department-filter"
              label={t("listings.filter.department")}
              value={selectedDepartmentId}
              onChange={(value) => {
                setSelectedDepartmentId(value);
                setSelectedProgramId("");
                setSelectedCourseId("");
              }}
              disabled={loadingFilters}
            >
              <option value="">{t("listings.option.allDepartments")}</option>
              {departments.map((department) => (
                <option key={department.id} value={String(department.id)}>
                  {department.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="program-filter"
              label={t("listings.filter.program")}
              value={selectedProgramId}
              onChange={(value) => {
                setSelectedProgramId(value);
                setSelectedCourseId("");
              }}
              disabled={!selectedDepartmentId || loadingFilters}
            >
              <option value="">{t("listings.option.allPrograms")}</option>
              {programs.map((program) => (
                <option key={program.id} value={String(program.id)}>
                  {program.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="course-filter"
              label={t("listings.filter.course")}
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              disabled={!selectedProgramId || loadingFilters}
            >
              <option value="">{t("listings.option.allCourses")}</option>
              {courses.map((course) => (
                <option key={course.id} value={String(course.id)}>
                  {course.name}
                </option>
              ))}
            </SelectField>
          </div>

          <button
            type="button"
            className="sell-book-button"
            onClick={() => {
              if (!authSession) {
                setSellError(t("listings.sellFirst"));
                return;
              }
              setSellError(null);
              setSellDialogOpen(true);
            }}
            title={t("listings.sellButton")}
          >
            {t("listings.sellButton")}
          </button>
        </div>

        {activeFilterChips.length > 0 ? (
          <div className="filter-chip-row">
            {activeFilterChips.map((chip) => (
              <span key={chip} className="filter-chip">
                {chip}
              </span>
            ))}
            <button type="button" className="filter-clear-button" onClick={resetFilters}>
              {t("listings.clearFilters")}
            </button>
          </div>
        ) : null}
      </section>

      {sellError ? <p className="sell-inline-error">{sellError}</p> : null}

      {error ? (
        <StatusMessage
          title={t("listings.requestFailed")}
          subtitle={t("listings.requestFailedSubtitle")}
        />
      ) : null}

      <div className="results-header">
        <div>
          <p className="results-kicker">{t("listings.header")}</p>
          <h3 className="results-title">
            {loadingListings
              ? t("listings.scanning")
              : t("listings.readyToInspect", { count: visibleListings.length })}
          </h3>
        </div>
        {!loadingListings && visibleListings.length > 0 ? (
          <p className="results-page-copy">
            {t("listings.pageSummary", {
              start: pageStart,
              end: pageEnd,
              total: visibleListings.length,
              page: currentPage,
            })}
          </p>
        ) : null}
      </div>

      {loadingListings ? (
        <StatusMessage title={t("listings.loading")} />
      ) : visibleListings.length === 0 ? (
        <StatusMessage
          title={t("listings.empty")}
          subtitle={t("listings.emptySubtitle")}
        />
      ) : (
        <>
          <div className="listings-grid">
            {paginatedListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onOpenDetails={(clickedListing) => {
                  setDetailsListing(clickedListing);
                  setDetailsDialogOpen(true);
                }}
                onMessageClick={handleMessageListing}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Listings pagination">
              <button
                type="button"
                className="pagination-button pagination-arrow"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                {t("listings.pagination.previous")}
              </button>

              <div className="pagination-pages">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`pagination-button ${page === currentPage ? "active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="pagination-button pagination-arrow"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                {t("listings.pagination.next")}
              </button>
            </nav>
          ) : null}
        </>
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

      <ListingDetailsDialog
        open={detailsDialogOpen}
        listing={detailsListing}
        onClose={() => {
          setDetailsDialogOpen(false);
          setDetailsListing(null);
        }}
        onMessageClick={handleMessageListing}
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
