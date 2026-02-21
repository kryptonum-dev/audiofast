"use client";

import {
  Autocomplete,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  Flex,
  Grid,
  Heading,
  Label,
  Spinner,
  Stack,
  Text,
  TextInput,
  useToast,
} from "@sanity/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useClient } from "sanity";

import { fetchReviewAuthorCounts } from "../../utils/review-author-counts";

type ReviewAuthorItem = {
  _id: string;
  name: string;
  reviewCount: number;
};

type OrphanReviewItem = {
  _id: string;
  title: string;
  destinationType: "page" | "pdf" | "external";
  publishedDate?: string;
  createdAt: string;
  path?: string;
};

type MergePreview = {
  totalPublishedReviews: number;
  bySource: Array<{ _id: string; name: string; reviewCount: number }>;
};

type AuthorAutocompleteOption = {
  value: string;
  label: string;
  reviewCount: number;
};

const BATCH_SIZE = 50;
const ORPHAN_LIMIT = 500;

const AUTHORS_WITH_COUNTS_QUERY = `
  *[_type == "reviewAuthor" && !(_id in path("drafts.**"))] | order(coalesce(reviewCount, 0) desc, name asc) {
    _id,
    name,
    "reviewCount": coalesce(reviewCount, 0)
  }
`;

const ORPHAN_REVIEWS_QUERY = `
  *[
    _type == "review"
    && !(_id in path("drafts.**"))
    && !defined(author._ref)
  ] | order(coalesce(publishedDate, _createdAt) desc)[0...$limit] {
    _id,
    destinationType,
    "title": coalesce(pt::text(title), "Bez tytułu"),
    "publishedDate": publishedDate,
    "createdAt": _createdAt,
    "path": select(
      destinationType == "page" => slug.current,
      destinationType == "pdf" => pdfSlug.current,
      destinationType == "external" => externalUrl,
      null
    )
  }
`;

const MERGE_PREVIEW_BY_SOURCE_QUERY = `
  *[_type == "reviewAuthor" && _id in $sourceIds] {
    _id,
    name,
    "reviewCount": count(*[
      _type == "review"
      && !(_id in path("drafts.**"))
      && author._ref == ^._id
    ])
  }
`;

const PUBLISHED_REVIEW_IDS_BY_SOURCE_QUERY = `
  *[
    _type == "review"
    && !(_id in path("drafts.**"))
    && author._ref in $sourceIds
  ]._id
`;

const ALL_REVIEW_IDS_BY_SOURCE_QUERY = `
  *[
    _type == "review"
    && author._ref in $sourceIds
  ]._id
`;

const REVIEW_IDS_BY_CANDIDATE_QUERY = `
  *[_type == "review" && _id in $candidateIds]._id
`;

const REVIEW_REF_COUNT_QUERY = `
  count(*[_type == "review" && author._ref == $authorId])
`;

const chunk = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

function formatDate(value?: string): string {
  if (!value) return "Brak daty";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Brak daty";

  return new Intl.DateTimeFormat("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("pl-PL")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function matchesSimpleNameSearch(name: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedName = normalizeSearchText(name);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return queryTokens.every((token) => normalizedName.includes(token));
}

export default function ReviewAuthorManager() {
  const client = useClient({ apiVersion: "2024-01-01" });
  const toast = useToast();

  const [authors, setAuthors] = useState<ReviewAuthorItem[]>([]);
  const [orphanReviews, setOrphanReviews] = useState<OrphanReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [targetAuthorId, setTargetAuthorId] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(
    new Set(),
  );
  const [deleteEmptySources, setDeleteEmptySources] = useState(false);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);

  const [assignTargetAuthorId, setAssignTargetAuthorId] = useState("");
  const [orphanSearch, setOrphanSearch] = useState("");
  const [selectedOrphanIds, setSelectedOrphanIds] = useState<Set<string>>(
    new Set(),
  );
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const [lastMergeSummary, setLastMergeSummary] = useState<string | null>(null);
  const [lastAssignSummary, setLastAssignSummary] = useState<string | null>(null);

  const syncReviewAuthorCounts = useCallback(
    async (authorIds?: string[]) => {
      const rows = await fetchReviewAuthorCounts(client, authorIds);

      if (!rows || rows.length === 0) return;

      for (const batch of chunk(rows, BATCH_SIZE)) {
        const tx = client.transaction();
        for (const row of batch) {
          tx.patch(row._id, { set: { reviewCount: row.reviewCount ?? 0 } });
        }
        await tx.commit({ visibility: "sync" });
      }
    },
    [client],
  );

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (isManualRefresh) {
        await syncReviewAuthorCounts();
      }

      const [nextAuthors, nextOrphans] = await Promise.all([
        client.fetch<ReviewAuthorItem[]>(AUTHORS_WITH_COUNTS_QUERY),
        client.fetch<OrphanReviewItem[]>(ORPHAN_REVIEWS_QUERY, {
          limit: ORPHAN_LIMIT,
        }),
      ]);

      setAuthors(nextAuthors ?? []);
      setOrphanReviews(nextOrphans ?? []);
    } catch (error) {
      toast.push({
        status: "error",
        title: "Nie udało się wczytać danych",
        description:
          error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [client, syncReviewAuthorCounts, toast]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await syncReviewAuthorCounts();
      } catch {
        // Ignore sync failures during boot; listing still loads from existing data.
      }

      if (cancelled) return;
      await loadData();
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [loadData, syncReviewAuthorCounts]);

  const targetAuthor = useMemo(
    () => authors.find((author) => author._id === targetAuthorId),
    [authors, targetAuthorId],
  );
  const assignTargetAuthor = useMemo(
    () => authors.find((author) => author._id === assignTargetAuthorId),
    [authors, assignTargetAuthorId],
  );

  const selectedSources = useMemo(
    () => authors.filter((author) => selectedSourceIds.has(author._id)),
    [authors, selectedSourceIds],
  );

  const filteredSourceAuthors = useMemo(() => {
    return authors.filter((author) => {
      if (author._id === targetAuthorId) return false;
      if (author.reviewCount <= 0) return false;
      return matchesSimpleNameSearch(author.name, sourceSearch);
    });
  }, [authors, sourceSearch, targetAuthorId]);

  const mergeTargetAuthors = useMemo(() => {
    return authors.filter(
      (author) => author.reviewCount > 0 || author._id === targetAuthorId,
    );
  }, [authors, targetAuthorId]);

  const mergeTargetAuthorOptions = useMemo<AuthorAutocompleteOption[]>(
    () =>
      mergeTargetAuthors.map((author) => ({
        value: author._id,
        label: author.name,
        reviewCount: author.reviewCount,
      })),
    [mergeTargetAuthors],
  );

  const assignTargetAuthorOptions = useMemo<AuthorAutocompleteOption[]>(
    () =>
      authors.map((author) => ({
        value: author._id,
        label: author.name,
        reviewCount: author.reviewCount,
      })),
    [authors],
  );

  const filteredOrphans = useMemo(() => {
    const phrase = orphanSearch.trim().toLowerCase();
    if (!phrase) return orphanReviews;

    return orphanReviews.filter((review) => {
      return (
        review.title.toLowerCase().includes(phrase) ||
        (review.path ?? "").toLowerCase().includes(phrase)
      );
    });
  }, [orphanReviews, orphanSearch]);

  const selectedOrphanItems = useMemo(() => {
    return orphanReviews.filter((review) => selectedOrphanIds.has(review._id));
  }, [orphanReviews, selectedOrphanIds]);

  const toggleSource = (authorId: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(authorId)) next.delete(authorId);
      else next.add(authorId);
      return next;
    });
    setMergePreview(null);
  };

  const toggleOrphan = (reviewId: string) => {
    setSelectedOrphanIds((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  };

  const selectAllVisibleOrphans = () => {
    setSelectedOrphanIds(new Set(filteredOrphans.map((review) => review._id)));
  };

  const clearOrphanSelection = () => {
    setSelectedOrphanIds(new Set());
  };

  const openMergeDialog = async () => {
    if (!targetAuthorId || selectedSourceIds.size === 0) {
      toast.push({
        status: "warning",
        title: "Uzupełnij dane",
        description: "Wybierz autora docelowego oraz co najmniej jednego autora źródłowego.",
      });
      return;
    }

    setIsPreviewLoading(true);
    setMergePreview(null);
    setDeleteEmptySources(false);

    try {
      const sourceIds = Array.from(selectedSourceIds).filter(
        (id) => id !== targetAuthorId,
      );
      if (sourceIds.length === 0) {
        toast.push({
          status: "warning",
          title: "Nieprawidłowy wybór",
          description: "Autor docelowy nie może znajdować się na liście źródłowej.",
        });
        return;
      }

      const bySource = await client.fetch<
        Array<{ _id: string; name: string; reviewCount: number }>
      >(MERGE_PREVIEW_BY_SOURCE_QUERY, {
        sourceIds,
      });

      const totalPublishedReviews = (bySource ?? []).reduce(
        (sum, item) => sum + (item.reviewCount || 0),
        0,
      );

      setMergePreview({
        totalPublishedReviews,
        bySource: bySource ?? [],
      });
      setIsMergeDialogOpen(true);
    } catch (error) {
      toast.push({
        status: "error",
        title: "Podgląd nie powiódł się",
        description:
          error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const executeMerge = async () => {
    if (!targetAuthorId || selectedSourceIds.size === 0) {
      toast.push({
        status: "warning",
        title: "Brak danych do scalenia",
        description:
          "Wybierz autora docelowego i przynajmniej jednego autora źródłowego.",
      });
      return;
    }

    const sourceIds = Array.from(selectedSourceIds).filter(
      (id) => id !== targetAuthorId,
    );
    if (sourceIds.length === 0) {
      toast.push({
        status: "warning",
        title: "Nieprawidłowy wybór",
        description: "Autor docelowy nie może znajdować się na liście źródłowej.",
      });
      return;
    }

    setIsMerging(true);
    setLastMergeSummary(null);

    try {
      const publishedReviewIds = await client.fetch<string[]>(
        PUBLISHED_REVIEW_IDS_BY_SOURCE_QUERY,
        { sourceIds },
      );

      const uniqueBaseIds = Array.from(new Set(publishedReviewIds ?? []));
      const uniqueBaseCount = uniqueBaseIds.length;
      const allLinkedReviewIds = await client.fetch<string[]>(
        ALL_REVIEW_IDS_BY_SOURCE_QUERY,
        { sourceIds },
      );
      const affectedDocIds = Array.from(new Set(allLinkedReviewIds ?? []));

      let patchedDocCount = 0;

      for (const batch of chunk(affectedDocIds ?? [], BATCH_SIZE)) {
        if (batch.length === 0) continue;
        const tx = client.transaction();

        for (const reviewId of batch) {
          tx.patch(reviewId, {
            set: {
              author: {
                _type: "reference",
                _ref: targetAuthorId,
              },
            },
          });
        }

        await tx.commit({ visibility: "sync" });
        patchedDocCount += batch.length;
      }

      const deletedSources: string[] = [];
      const skippedSources: string[] = [];

      if (deleteEmptySources && sourceIds.length > 0) {
        for (const sourceId of sourceIds) {
          const referencesCount = await client.fetch<number>(
            REVIEW_REF_COUNT_QUERY,
            { authorId: sourceId },
          );

          if (referencesCount === 0) {
            try {
              await client.delete(sourceId);
              deletedSources.push(sourceId);
            } catch {
              skippedSources.push(sourceId);
            }
          } else {
            skippedSources.push(sourceId);
          }
        }
      }

      await syncReviewAuthorCounts([targetAuthorId, ...sourceIds]);

      setSelectedSourceIds(new Set());
      setMergePreview(null);
      setDeleteEmptySources(false);
      setIsMergeDialogOpen(false);

      const summaryParts = [
        `Przeniesiono ${patchedDocCount} rekordów dokumentów (${uniqueBaseCount} unikalnych recenzji).`,
      ];

      if (deleteEmptySources) {
        summaryParts.push(
          `Usunięto pustych autorów: ${deletedSources.length}.`,
          skippedSources.length > 0
            ? `Pominięto (nadal mają referencje, np. drafty): ${skippedSources.length}.`
            : "Wszyscy wybrani autorzy źródłowi są bez referencji po scaleniu.",
        );
      }

      const summary = summaryParts.join(" ");
      setLastMergeSummary(summary);

      toast.push({
        status: "success",
        title: "Scalanie zakończone",
        description: summary,
      });

      await loadData();
    } catch (error) {
      toast.push({
        status: "error",
        title: "Scalanie nie powiodło się",
        description:
          error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.",
      });
    } finally {
      setIsMerging(false);
    }
  };

  const executeAssignMissingAuthors = async () => {
    if (!assignTargetAuthorId || selectedOrphanIds.size === 0) {
      toast.push({
        status: "warning",
        title: "Brak danych",
        description:
          "Wybierz autora docelowego oraz co najmniej jedną recenzję bez autora.",
      });
      return;
    }

    setIsAssigning(true);
    setLastAssignSummary(null);

    try {
      const baseIds = Array.from(selectedOrphanIds);
      const candidateIds = [
        ...baseIds,
        ...baseIds.map((id) => `drafts.${id}`),
      ];

      const existingDocIds = await client.fetch<string[]>(
        REVIEW_IDS_BY_CANDIDATE_QUERY,
        {
          candidateIds,
        },
      );

      let patchedDocCount = 0;
      for (const batch of chunk(existingDocIds ?? [], BATCH_SIZE)) {
        if (batch.length === 0) continue;
        const tx = client.transaction();

        for (const reviewId of batch) {
          tx.patch(reviewId, {
            set: {
              author: {
                _type: "reference",
                _ref: assignTargetAuthorId,
              },
            },
          });
        }

        await tx.commit({ visibility: "sync" });
        patchedDocCount += batch.length;
      }

      await syncReviewAuthorCounts([assignTargetAuthorId]);

      setSelectedOrphanIds(new Set());
      setIsAssignDialogOpen(false);

      const summary = `Przypisano autora do ${baseIds.length} recenzji (${patchedDocCount} rekordów dokumentów).`;
      setLastAssignSummary(summary);

      toast.push({
        status: "success",
        title: "Przypisanie zakończone",
        description: summary,
      });

      await loadData();
    } catch (error) {
      toast.push({
        status: "error",
        title: "Przypisanie nie powiodło się",
        description:
          error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const openAssignDialog = () => {
    if (!assignTargetAuthorId || selectedOrphanIds.size === 0) {
      toast.push({
        status: "warning",
        title: "Brak danych",
        description:
          "Wybierz autora docelowego oraz co najmniej jedną recenzję bez autora.",
      });
      return;
    }

    setIsAssignDialogOpen(true);
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "16rem" }}>
        <Spinner muted />
      </Flex>
    );
  }

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Flex align="center" justify="space-between">
          <Heading size={1}>Scalanie autorów recenzji</Heading>
          <Button
            mode="ghost"
            text={refreshing ? "Odświeżanie..." : "Odśwież dane"}
            disabled={refreshing}
            onClick={() => {
              void loadData(true);
            }}
          />
        </Flex>

        <Box padding={1}>
          <Stack space={4}>
            <Heading size={1}>1. Scal warianty autorów</Heading>
            <Text size={1} muted>
              Wybierz autora docelowego (kanonicznego), następnie zaznacz warianty
              do scalenia. Wszystkie referencje recenzji zostaną przepięte do
              autora docelowego.
            </Text>

            <Grid columns={[1, 1, 2]} gap={3}>
              <Stack space={2}>
                <Label htmlFor="targetAuthor">Autor docelowy</Label>
                <Autocomplete<AuthorAutocompleteOption>
                  id="targetAuthor"
                  openButton
                  openOnFocus
                  options={mergeTargetAuthorOptions}
                  placeholder="Wybierz autora docelowego..."
                  value={targetAuthorId}
                  onChange={(nextTarget) => {
                    setTargetAuthorId(nextTarget);
                    setSelectedSourceIds((prev) => {
                      if (!prev.has(nextTarget)) return prev;
                      const next = new Set(prev);
                      next.delete(nextTarget);
                      return next;
                    });
                    setMergePreview(null);
                  }}
                  filterOption={(query, option) =>
                    matchesSimpleNameSearch(option.label, query)
                  }
                  renderValue={(value, option) =>
                    option?.label ||
                    mergeTargetAuthorOptions.find((item) => item.value === value)
                      ?.label ||
                    ""
                  }
                  renderOption={(option) => (
                    <Flex align="center" justify="space-between" gap={3} padding={2}>
                      <Text size={1}>{option.label}</Text>
                      <Badge tone="default">{option.reviewCount}</Badge>
                    </Flex>
                  )}
                >
                </Autocomplete>
              </Stack>

              <Stack space={2}>
                <Label htmlFor="sourceSearch">Szukaj autorów źródłowych</Label>
                <TextInput
                  id="sourceSearch"
                  value={sourceSearch}
                  onChange={(event) => setSourceSearch(event.currentTarget.value)}
                  placeholder="np. AUDIO"
                />
              </Stack>
            </Grid>

            <Card padding={3} radius={2}>
              <Stack space={2}>
                <Flex align="center" justify="space-between">
                  <Text size={1} weight="semibold">
                    Autorzy źródłowi
                  </Text>
                  <Badge tone="primary">
                    Zaznaczone: {selectedSourceIds.size}
                  </Badge>
                </Flex>

                <Box
                  style={{
                    maxHeight: "16rem",
                    overflowY: "auto",
                  }}
                >
                  <Stack space={1}>
                    {filteredSourceAuthors.length === 0 ? (
                      <Text size={1} muted>
                        Brak wyników dla podanego filtra.
                      </Text>
                    ) : (
                      filteredSourceAuthors.map((author) => (
                        <Card
                          key={author._id}
                          padding={2}
                          radius={2}
                          tone={
                            selectedSourceIds.has(author._id) ? "primary" : "default"
                          }
                        >
                          <Flex align="center" justify="space-between" gap={3}>
                            <Flex align="center" gap={2}>
                              <Checkbox
                                checked={selectedSourceIds.has(author._id)}
                                onChange={() => toggleSource(author._id)}
                              />
                              <Text size={1}>{author.name}</Text>
                            </Flex>
                            <Badge tone="default">{author.reviewCount}</Badge>
                          </Flex>
                        </Card>
                      ))
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Card>

            <Flex align="center" gap={2}>
              <Button
                text={isPreviewLoading ? "Przygotowywanie..." : "Wykonaj scalenie"}
                tone="primary"
                disabled={
                  isPreviewLoading ||
                  isMerging ||
                  !targetAuthorId ||
                  selectedSourceIds.size === 0 ||
                  selectedSources.length === 0
                }
                onClick={() => {
                  void openMergeDialog();
                }}
              />
            </Flex>

            {lastMergeSummary && (
              <Card padding={3} radius={2} tone="positive" border>
                <Text size={1}>{lastMergeSummary}</Text>
              </Card>
            )}
          </Stack>
        </Box>

        <Box
          padding={1}
          style={{
            borderTop: "1px solid var(--card-border-color)",
            paddingTop: "1.5rem",
          }}
        >
          <Stack space={4}>
            <Heading size={1}>2. Przypisz brakujących autorów</Heading>
            <Text size={1} muted>
              Przypisz autora hurtowo do recenzji, które nie mają obecnie ustawionego
              pola `author`.
            </Text>

            <Grid columns={[1, 1, 2]} gap={3}>
              <Stack space={2}>
                <Label htmlFor="assignTargetAuthor">Autor docelowy</Label>
                <Autocomplete<AuthorAutocompleteOption>
                  id="assignTargetAuthor"
                  openButton
                  openOnFocus
                  options={assignTargetAuthorOptions}
                  placeholder="Wybierz autora..."
                  value={assignTargetAuthorId}
                  onChange={setAssignTargetAuthorId}
                  filterOption={(query, option) =>
                    matchesSimpleNameSearch(option.label, query)
                  }
                  renderValue={(value, option) =>
                    option?.label ||
                    assignTargetAuthorOptions.find((item) => item.value === value)
                      ?.label ||
                    ""
                  }
                  renderOption={(option) => (
                    <Flex align="center" justify="space-between" gap={3} padding={2}>
                      <Text size={1}>{option.label}</Text>
                      <Badge tone="default">{option.reviewCount}</Badge>
                    </Flex>
                  )}
                />
              </Stack>

              <Stack space={2}>
                <Label htmlFor="orphanSearch">Szukaj recenzji bez autora</Label>
                <TextInput
                  id="orphanSearch"
                  value={orphanSearch}
                  onChange={(event) => setOrphanSearch(event.currentTarget.value)}
                  placeholder="Tytuł lub URL"
                />
              </Stack>
            </Grid>

            <Flex align="center" gap={2} wrap="wrap">
              <Button
                mode="ghost"
                text="Zaznacz wszystkie widoczne"
                onClick={selectAllVisibleOrphans}
              />
              <Button
                mode="ghost"
                text="Wyczyść zaznaczenie"
                onClick={clearOrphanSelection}
              />
              <Badge tone="caution">
                Zaznaczone: {selectedOrphanIds.size}
              </Badge>
              <Badge tone="default">
                Wszystkie bez autora: {orphanReviews.length}
              </Badge>
            </Flex>

            <Card padding={3} radius={2}>
              <Box
                style={{
                  maxHeight: "20rem",
                  overflowY: "auto",
                }}
              >
                <Stack space={1}>
                  {filteredOrphans.length === 0 ? (
                    <Text size={1} muted>
                      Brak recenzji spełniających kryteria.
                    </Text>
                  ) : (
                    filteredOrphans.map((review) => (
                      <Card
                        key={review._id}
                        padding={2}
                        radius={2}
                        tone={
                          selectedOrphanIds.has(review._id) ? "primary" : "default"
                        }
                      >
                        <Flex align="flex-start" justify="space-between" gap={3}>
                          <Flex align="flex-start" gap={2}>
                            <Checkbox
                              checked={selectedOrphanIds.has(review._id)}
                              onChange={() => toggleOrphan(review._id)}
                            />
                            <Stack space={1}>
                              <Text size={1} weight="semibold">
                                {review.title}
                              </Text>
                              <Text size={1} muted>
                                {review.path || "Brak ścieżki"} •{" "}
                                {formatDate(review.publishedDate || review.createdAt)}
                              </Text>
                            </Stack>
                          </Flex>
                          <Badge tone="primary">{review.destinationType}</Badge>
                        </Flex>
                      </Card>
                    ))
                  )}
                </Stack>
              </Box>
            </Card>

            <Button
              tone="primary"
              text={isAssigning ? "Przypisywanie..." : "Przypisz autora do zaznaczonych"}
              disabled={
                isAssigning ||
                !assignTargetAuthorId ||
                selectedOrphanIds.size === 0
              }
              onClick={() => {
                openAssignDialog();
              }}
            />

            {lastAssignSummary && (
              <Card padding={3} radius={2} tone="positive" border>
                <Text size={1}>{lastAssignSummary}</Text>
              </Card>
            )}
          </Stack>
        </Box>
      </Stack>

      {isMergeDialogOpen && (
        <Dialog
          id="merge-review-authors-dialog"
          header="Potwierdź scalanie autorów"
          onClose={() => {
            if (isMerging) return;
            setIsMergeDialogOpen(false);
          }}
          width={2}
        >
          <Box padding={4}>
            <Stack space={4}>
              <Text size={1}>
                Autor docelowy:{" "}
                <strong>{targetAuthor?.name ?? "Nie wybrano"}</strong>
              </Text>

              <Card padding={3} radius={2} tone="primary" border>
                <Stack space={2}>
                  <Text size={1} weight="semibold">
                    Podgląd operacji
                  </Text>
                  <Text size={1}>
                    Łącznie opublikowanych recenzji do scalenia:{" "}
                    <strong>{mergePreview?.totalPublishedReviews ?? 0}</strong>
                  </Text>
                  <Stack space={1}>
                    {(mergePreview?.bySource ?? []).map((item) => (
                      <Text size={1} key={item._id}>
                        {item.name}: {item.reviewCount}
                      </Text>
                    ))}
                  </Stack>
                </Stack>
              </Card>

              <Flex align="center" gap={2}>
                <Checkbox
                  checked={deleteEmptySources}
                  onChange={(event) =>
                    setDeleteEmptySources(event.currentTarget.checked)
                  }
                />
                <Text size={1}>
                  Usuń autorów źródłowych, jeśli po scaleniu nie mają żadnych referencji
                </Text>
              </Flex>

              <Flex justify="flex-end" gap={2}>
                <Button
                  mode="ghost"
                  text="Anuluj"
                  disabled={isMerging}
                  onClick={() => setIsMergeDialogOpen(false)}
                />
                <Button
                  tone="primary"
                  text={isMerging ? "Scalanie..." : "Potwierdź i scal"}
                  disabled={isMerging}
                  onClick={() => {
                    void executeMerge();
                  }}
                />
              </Flex>
            </Stack>
          </Box>
        </Dialog>
      )}

      {isAssignDialogOpen && (
        <Dialog
          id="assign-review-authors-dialog"
          header="Potwierdź przypisanie autora"
          onClose={() => {
            if (isAssigning) return;
            setIsAssignDialogOpen(false);
          }}
          width={2}
        >
          <Box padding={4}>
            <Stack space={4}>
              <Text size={1}>
                Autor docelowy:{" "}
                <strong>{assignTargetAuthor?.name ?? "Nie wybrano"}</strong>
              </Text>

              <Card padding={3} radius={2} tone="primary" border>
                <Stack space={2}>
                  <Text size={1} weight="semibold">
                    Podgląd operacji
                  </Text>
                  <Text size={1}>
                    Liczba recenzji do przypisania:{" "}
                    <strong>{selectedOrphanItems.length}</strong>
                  </Text>
                  <Stack space={1}>
                    {selectedOrphanItems.slice(0, 8).map((review) => (
                      <Text size={1} key={review._id}>
                        • {review.title}
                      </Text>
                    ))}
                    {selectedOrphanItems.length > 8 && (
                      <Text size={1} muted>
                        ... oraz {selectedOrphanItems.length - 8} kolejnych
                      </Text>
                    )}
                  </Stack>
                </Stack>
              </Card>

              <Flex justify="flex-end" gap={2}>
                <Button
                  mode="ghost"
                  text="Anuluj"
                  disabled={isAssigning}
                  onClick={() => setIsAssignDialogOpen(false)}
                />
                <Button
                  tone="primary"
                  text={isAssigning ? "Przypisywanie..." : "Potwierdź i przypisz"}
                  disabled={isAssigning}
                  onClick={() => {
                    void executeAssignMissingAuthors();
                  }}
                />
              </Flex>
            </Stack>
          </Box>
        </Dialog>
      )}
    </Box>
  );
}
