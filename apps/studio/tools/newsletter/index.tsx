import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ComposeSparklesIcon,
  DragHandleIcon,
  RefreshIcon,
  SearchIcon,
} from "@sanity/icons";
import {
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
  Switch,
  Text,
  TextInput,
  ToastProvider,
  useToast,
} from "@sanity/ui";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "sanity";

// Types matching our content structure
type ContentItem = {
  _id: string;
  _type: "blog-article" | "review" | "product";
  title?: string; // articles/reviews
  name?: string; // products/reviews/articles
  description?: string; // plain text (for studio preview)
  descriptionBlocks?: Record<string, unknown>[]; // raw Portable Text (for email HTML)
  shortDescription?: string; // products plain text (for studio preview)
  shortDescriptionBlocks?: Record<string, unknown>[]; // raw Portable Text (for email HTML)
  image?: string;
  imageSource?: "publication" | "preview" | "gallery" | "default";
  slug: string;
  destinationType?: "page" | "pdf" | "external" | null; // review types
  openInNewTab?: boolean; // for external/pdf reviews
  _createdAt: string;
  publishedDate?: string; // override date (if set)
  publishDate: string; // computed: coalesce(publishedDate, _createdAt)
  brandName?: string; // products
  authorName?: string; // reviews
};

type GroupedContent = {
  articles: ContentItem[];
  reviews: ContentItem[];
  products: ContentItem[];
};

type ListKey = "reviews" | "articles" | "products";

const SECTION_LABELS: Record<ListKey, string> = {
  articles: "Artykuły Blogowe",
  products: "Produkty",
  reviews: "Recenzje",
};

// Hero configuration type
type HeroConfig = {
  imageUrl: string;
  text: string;
};

// Asset type from Sanity
type SanityAsset = {
  _id: string;
  url: string;
  originalFilename: string;
  metadata?: {
    dimensions?: {
      width: number;
      height: number;
      aspectRatio: number;
    };
  };
  _createdAt: string;
};

const PRODUCTION_NEWSLETTER_API_URL =
  "https://audiofast.pl/api/newsletter/generate/";
const LOCAL_NEWSLETTER_API_URL = "http://localhost:3000/api/newsletter/generate/";

function resolveNewsletterApiUrl() {
  // In local Studio development prefer local web API,
  // so newsletter HTML generation uses current code changes.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return LOCAL_NEWSLETTER_API_URL;
    }
  }

  return PRODUCTION_NEWSLETTER_API_URL;
}

// Toolbar preset colors matching the brand palette
const TOOLBAR_COLORS = [
  { hex: "#303030", label: "Ciemny" },
  { hex: "#5b5a5a", label: "Szary" },
  { hex: "#fe0140", label: "Czerwony (główny)" },
  { hex: "#000000", label: "Czarny" },
  { hex: "#ffffff", label: "Biały" },
];

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [isEmpty, setIsEmpty] = useState(!value);
  const [blockType, setBlockType] = useState<"p" | "h2" | "h3">("p");

  // Sync initial value into the contenteditable on mount only
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || "";
      setIsEmpty(!value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = useCallback(
    (command: string, val?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, val);
      const html = editorRef.current?.innerHTML ?? "";
      setIsEmpty(!html || html === "<br>");
      onChange(html);
    },
    [onChange],
  );

  const setBlockTag = useCallback(
    (tag: "p" | "h2" | "h3") => {
      editorRef.current?.focus();
      document.execCommand("formatBlock", false, `<${tag}>`);
      setBlockType(tag);
      const html = editorRef.current?.innerHTML ?? "";
      setIsEmpty(!html || html === "<br>");
      onChange(html);
    },
    [onChange],
  );

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? "";
    setIsEmpty(!html || html === "<br>");
    onChange(html);
  }, [onChange]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
      editorRef.current?.focus();
    }
  }, []);

  const handleInsertLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    restoreSelection();
    document.execCommand("createLink", false, linkUrl.trim());
    // Force target="_blank" on newly created links
    const anchors = editorRef.current?.querySelectorAll("a");
    anchors?.forEach((a) => {
      if (!a.getAttribute("target")) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
    });
    const html = editorRef.current?.innerHTML ?? "";
    onChange(html);
    setShowLinkDialog(false);
    setLinkUrl("");
  }, [linkUrl, onChange, restoreSelection]);

  // Theme-neutral button style — inherits color from Card, transparent bg
  const btnStyle: React.CSSProperties = {
    background: "transparent",
    border: "1px solid rgba(127,127,127,0.3)",
    borderRadius: "3px",
    cursor: "pointer",
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "inherit",
    fontSize: "13px",
    height: "26px",
    minWidth: "26px",
    lineHeight: 1,
  };

  const separator = (
    <div
      style={{
        width: "1px",
        height: "18px",
        backgroundColor: "rgba(127,127,127,0.25)",
        margin: "0 2px",
        flexShrink: 0,
      }}
    />
  );

  return (
    <Card border radius={1} style={{ overflow: "hidden" }}>
      {/* Toolbar — Card tone="transparent" picks up the correct theme bg */}
      <Card
        tone="transparent"
        borderBottom
        radius={0}
        padding={1}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "3px",
          alignItems: "center",
        }}
      >
        {/* Block type selector */}
        <select
          value={blockType}
          aria-label="Wybierz typ akapitu"
          title="Typ tekstu"
          onChange={(e) => setBlockTag(e.currentTarget.value as "p" | "h2" | "h3")}
          style={{
            ...btnStyle,
            minWidth: "72px",
            padding: "0 8px",
            appearance: "auto",
            WebkitAppearance: "menulist",
            MozAppearance: "menulist",
          }}
        >
          <option value="p">Akapit</option>
          <option value="h2">Nagłówek 2</option>
          <option value="h3">Nagłówek 3</option>
        </select>

        {separator}

        {/* Bold */}
        <button
          type="button"
          style={{ ...btnStyle, fontWeight: 700 }}
          title="Pogrubienie"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("bold");
          }}
        >
          B
        </button>

        {/* Italic */}
        <button
          type="button"
          style={{ ...btnStyle, fontStyle: "italic" }}
          title="Kursywa"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("italic");
          }}
        >
          I
        </button>

        {/* Underline */}
        <button
          type="button"
          style={{ ...btnStyle, textDecoration: "underline" }}
          title="Podkreślenie"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("underline");
          }}
        >
          U
        </button>

        {separator}

        {/* Align Left */}
        <button
          type="button"
          style={{ ...btnStyle, fontSize: "11px" }}
          title="Wyrównaj do lewej"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("justifyLeft");
          }}
        >
          ←≡
        </button>

        {/* Align Center */}
        <button
          type="button"
          style={{ ...btnStyle, fontSize: "11px" }}
          title="Wyśrodkuj"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("justifyCenter");
          }}
        >
          ↔≡
        </button>

        {/* Align Right */}
        <button
          type="button"
          style={{ ...btnStyle, fontSize: "11px" }}
          title="Wyrównaj do prawej"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("justifyRight");
          }}
        >
          →≡
        </button>

        {/* Align Justify */}
        <button
          type="button"
          style={{ ...btnStyle, fontSize: "15px", letterSpacing: "-1px" }}
          title="Wyjustuj"
          onMouseDown={(e) => {
            e.preventDefault();
            exec("justifyFull");
          }}
        >
          ≡
        </button>

        {separator}

        {/* Link */}
        <button
          type="button"
          style={btnStyle}
          title="Wstaw hyperlink"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
            setShowLinkDialog(true);
            setLinkUrl("");
          }}
        >
          🔗
        </button>

        {separator}

        {/* Color swatches */}
        {TOOLBAR_COLORS.map(({ hex, label }) => (
          <button
            key={hex}
            type="button"
            title={`Kolor: ${label}`}
            style={{
              width: "18px",
              height: "18px",
              minWidth: "18px",
              padding: 0,
              border: "1px solid rgba(127,127,127,0.4)",
              borderRadius: "50%",
              cursor: "pointer",
              backgroundColor: hex,
              flexShrink: 0,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              exec("foreColor", hex);
            }}
          />
        ))}
      </Card>

      {/* Link dialog — uses Card so it inherits theme colors */}
      {showLinkDialog && (
        <Card borderBottom radius={0} padding={2}>
          <Flex gap={2} align="center">
            <Box flex={1}>
              <TextInput
                type="url"
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.currentTarget.value)}
                placeholder="https://..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleInsertLink();
                  }
                  if (e.key === "Escape") setShowLinkDialog(false);
                }}
              />
            </Box>
            <Button
              text="Wstaw"
              tone="primary"
              fontSize={1}
              padding={2}
              onClick={handleInsertLink}
            />
            <Button
              text="Anuluj"
              mode="ghost"
              fontSize={1}
              padding={2}
              onClick={() => setShowLinkDialog(false)}
            />
          </Flex>
        </Card>
      )}

      {/* Editor area — transparent bg, inherits text color from Card */}
      <Box padding={3} style={{ position: "relative" }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          style={{
            minHeight: "90px",
            outline: "none",
            fontSize: "14px",
            lineHeight: "1.6",
            color: "inherit",
            backgroundColor: "transparent",
          }}
        />
        {isEmpty && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              opacity: 0.4,
              color: "inherit",
              pointerEvents: "none",
              fontSize: "14px",
              lineHeight: "1.6",
              userSelect: "none",
            }}
          >
            {placeholder}
          </div>
        )}
      </Box>
    </Card>
  );
}

export default function NewsletterTool() {
  const client = useClient({ apiVersion: "2024-01-01" });
  const toast = useToast();
  const newsletterApiUrl = useMemo(() => resolveNewsletterApiUrl(), []);

  // State
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState<GroupedContent>({
    articles: [],
    reviews: [],
    products: [],
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // List visibility/enabled state (switch)
  const [listsEnabled, setListsEnabled] = useState<Record<ListKey, boolean>>({
    reviews: true,
    articles: true,
    products: true,
  });

  // Collapsed/expanded state for dropdowns
  const [listsExpanded, setListsExpanded] = useState<Record<ListKey, boolean>>({
    reviews: true,
    articles: true,
    products: true,
  });

  // Section order state (configurable by user)
  const [sectionOrder, setSectionOrder] = useState<ListKey[]>([
    "articles",
    "products",
    "reviews",
  ]);

  // Hero configuration state
  const [heroConfig, setHeroConfig] = useState<HeroConfig>({
    imageUrl: "",
    text: "",
  });

  const handleHeroTextChange = useCallback((html: string) => {
    setHeroConfig((prev) => ({ ...prev, text: html }));
  }, []);

  // Asset browser state
  const [isAssetBrowserOpen, setIsAssetBrowserOpen] = useState(false);
  const [assets, setAssets] = useState<SanityAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");

  // 1. Fetch Content
  const fetchContent = async () => {
    setIsLoading(true);
    try {
      const query = `*[_type in ["blog-article", "review", "product"] && !(_id in path("drafts.**")) && coalesce(publishedDate, _createdAt) >= $startDate && coalesce(publishedDate, _createdAt) <= $endDate + "T23:59:59Z"] | order(coalesce(publishedDate, _createdAt) desc) {
        _id,
        _type,
        "title": pt::text(title),
        name,
        "description": pt::text(description),
        "descriptionBlocks": description,
        "shortDescription": pt::text(shortDescription),
        "shortDescriptionBlocks": shortDescription,
        "image": select(
          _type == "product" && defined(publicationImage) => publicationImage.asset->url,
          _type == "product" && defined(previewImage) => previewImage.asset->url,
          _type == "product" => imageGallery[0].asset->url,
          image.asset->url
        ),
        "imageSource": select(
          _type == "product" && defined(publicationImage) => "publication",
          _type == "product" && defined(previewImage) => "preview",
          _type == "product" => "gallery",
          "default"
        ),
        "slug": select(
          _type == "review" && destinationType == "page" => slug.current,
          _type == "review" && destinationType == "pdf" => "/recenzje/pdf/" + string::split(lower(pdfFile.asset->originalFilename), ".pdf")[0],
          _type == "review" && destinationType == "external" => externalUrl,
          slug.current
        ),
        "destinationType": select(
          _type == "review" => coalesce(destinationType, "page"),
          null
        ),
        "openInNewTab": select(
          _type == "review" && destinationType == "external" => true,
          _type == "review" && destinationType == "pdf" => true,
          false
        ),
        _createdAt,
        publishedDate,
        "publishDate": coalesce(publishedDate, _createdAt),
        "brandName": select(
          _type == "product" => brand->name,
          null
        ),
        "authorName": select(
          _type == "review" => author->name,
          null
        )
      }`;

      const result = await client.fetch<ContentItem[]>(query, {
        startDate,
        endDate,
      });

      const grouped = {
        articles: result.filter((item) => item._type === "blog-article"),
        reviews: result.filter((item) => item._type === "review"),
        products: result.filter((item) => item._type === "product"),
      };

      setContent(grouped);
      // Select all by default
      setSelectedIds(new Set(result.map((item) => item._id)));

      toast.push({
        status: "success",
        title: `Znaleziono ${result.length} elementów`,
        description: `Recenzje: ${grouped.reviews.length}, Artykuły: ${grouped.articles.length}, Produkty: ${grouped.products.length}`,
      });
    } catch (err) {
      console.error(err);
      toast.push({
        status: "error",
        title: "Błąd pobierania treści",
        description: err instanceof Error ? err.message : "Nieznany błąd",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Toggle Selection
  const toggleItem = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // 3. Toggle list enabled/disabled
  const toggleListEnabled = (listKey: ListKey) => {
    setListsEnabled((prev) => {
      const newEnabled = !prev[listKey];

      // If disabling, collapse the list
      if (!newEnabled) {
        setListsExpanded((prevExpanded) => ({
          ...prevExpanded,
          [listKey]: false,
        }));
      }

      return { ...prev, [listKey]: newEnabled };
    });
  };

  // 4. Toggle list expanded/collapsed
  const toggleListExpanded = (listKey: ListKey) => {
    // Only allow expanding if the list is enabled
    if (!listsEnabled[listKey]) return;

    setListsExpanded((prev) => ({
      ...prev,
      [listKey]: !prev[listKey],
    }));
  };

  // Drag-and-drop sensors (require 8px movement to start dragging)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as ListKey);
        const newIdx = prev.indexOf(over.id as ListKey);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  // Debounce ref for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 5. Fetch assets for the browser (with optional search query)
  const fetchAssets = useCallback(
    async (searchQuery?: string) => {
      setIsLoadingAssets(true);
      try {
        // Server-side search - query Sanity directly
        const query = searchQuery
          ? `*[_type == "sanity.imageAsset" && originalFilename match $searchPattern] | order(_createdAt desc) [0...100] {
              _id,
              url,
              originalFilename,
              metadata {
                dimensions {
                  width,
                  height,
                  aspectRatio
                }
              },
              _createdAt
            }`
          : `*[_type == "sanity.imageAsset"] | order(_createdAt desc) [0...100] {
              _id,
              url,
              originalFilename,
              metadata {
                dimensions {
                  width,
                  height,
                  aspectRatio
                }
              },
              _createdAt
            }`;

        const params = searchQuery ? { searchPattern: `*${searchQuery}*` } : {};
        const result = await client.fetch<SanityAsset[]>(query, params);
        setAssets(result);
      } catch (err) {
        console.error(err);
        toast.push({
          status: "error",
          title: "Błąd ładowania obrazów",
        });
      } finally {
        setIsLoadingAssets(false);
      }
    },
    [client, toast],
  );

  // Load assets when browser opens
  useEffect(() => {
    if (isAssetBrowserOpen) {
      fetchAssets();
      setAssetSearchQuery("");
    }
  }, [isAssetBrowserOpen, fetchAssets]);

  // Handle search with debouncing
  const handleAssetSearch = (query: string) => {
    setAssetSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the search (wait 400ms after user stops typing)
    searchTimeoutRef.current = setTimeout(() => {
      if (query.trim()) {
        fetchAssets(query.trim());
      } else {
        fetchAssets();
      }
    }, 400);
  };

  // Handle asset selection
  const handleAssetSelect = (asset: SanityAsset) => {
    setHeroConfig((prev) => ({ ...prev, imageUrl: asset.url }));
    setIsAssetBrowserOpen(false);
  };

  // Calculate if there are any items currently selected in enabled lists
  const hasSelectedItems =
    (listsEnabled.articles &&
      content.articles.some((i) => selectedIds.has(i._id))) ||
    (listsEnabled.reviews &&
      content.reviews.some((i) => selectedIds.has(i._id))) ||
    (listsEnabled.products &&
      content.products.some((i) => selectedIds.has(i._id)));

  // 6. Generate Newsletter
  const handleAction = async (
    action: "download-html" | "create-mailchimp-draft",
  ) => {
    // Validate hero image
    if (!heroConfig.imageUrl) {
      toast.push({
        status: "warning",
        title: "Brak obrazu nagłówka",
        description: "Dodaj obraz nagłówka przed generowaniem newslettera.",
      });
      return;
    }

    setIsGenerating(true);

    // Filter content based on selection AND enabled lists
    const payloadContent = {
      articles: listsEnabled.articles
        ? content.articles.filter((i) => selectedIds.has(i._id))
        : [],
      reviews: listsEnabled.reviews
        ? content.reviews.filter((i) => selectedIds.has(i._id))
        : [],
      products: listsEnabled.products
        ? content.products.filter((i) => selectedIds.has(i._id))
        : [],
    };

    if (
      payloadContent.articles.length === 0 &&
      payloadContent.reviews.length === 0 &&
      payloadContent.products.length === 0
    ) {
      toast.push({
        status: "warning",
        title: "Brak wybranych elementów",
        description: "Zaznacz co najmniej jeden element.",
      });
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch(newsletterApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          startDate,
          endDate,
          content: payloadContent,
          hero: heroConfig,
          sectionOrder,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Błąd serwera");
      }

      if (action === "download-html") {
        // Handle file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `newsletter-audiofast-${startDate}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.push({ status: "success", title: "Pobrano plik HTML" });
      } else {
        // Handle Mailchimp success
        const data = await response.json();
        toast.push({
          status: "success",
          title: "Utworzono draft w Mailchimp",
          description: `ID Kampanii: ${data.campaignId}`,
        });
      }
    } catch (err) {
      console.error(err);
      toast.push({
        status: "error",
        title: "Błąd generowania",
        description: err instanceof Error ? err.message : "Nieznany błąd",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const hasItems =
    content.articles.length > 0 ||
    content.reviews.length > 0 ||
    content.products.length > 0;

  // Count selected items per list
  const getSelectedCount = (items: ContentItem[]) => {
    return items.filter((i) => selectedIds.has(i._id)).length;
  };

  return (
    <ToastProvider>
      <Card height="fill" padding={4} overflow="auto">
        <Flex
          direction="column"
          gap={5}
          style={{ maxWidth: "800px", margin: "0 auto" }}
        >
          {/* Header */}
          <Box>
            <Heading as="h1" size={4}>
              Generator Newslettera
            </Heading>
            <Text muted size={1} style={{ marginTop: "0.5rem" }}>
              Wybierz zakres dat, pobierz treści, dostosuj wybór i wygeneruj
              newsletter.
            </Text>
          </Box>

          {/* Date Controls */}
          <Card padding={4} tone="primary" radius={2} shadow={1}>
            <Grid columns={[1, 2, 3]} gap={3} style={{ alignItems: "end" }}>
              <Stack space={2}>
                <Label>Data początkowa</Label>
                <TextInput
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.currentTarget.value)}
                />
              </Stack>
              <Stack space={2}>
                <Label>Data końcowa</Label>
                <TextInput
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.currentTarget.value)}
                />
              </Stack>
              <Button
                icon={RefreshIcon}
                text={isLoading ? "Pobieranie..." : "Pobierz treści"}
                onClick={fetchContent}
                disabled={isLoading}
                tone="primary"
              />
            </Grid>
          </Card>

          {/* Hero Configuration */}
          <Card padding={4} radius={2} border>
            <Stack space={4}>
              <Heading size={1}>Nagłówek newslettera</Heading>

              {/* Hero Image */}
              <Stack space={3}>
                <Label>Obraz nagłówka (wymagany)</Label>
                {heroConfig.imageUrl ? (
                  <Box>
                    <Card
                      border
                      radius={2}
                      tone="transparent"
                      style={{
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={heroConfig.imageUrl}
                        alt="Podgląd nagłówka"
                        style={{
                          width: "100%",
                          maxHeight: "300px",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </Card>
                    <Flex gap={2} marginTop={3}>
                      <Button
                        text="Zmień obraz"
                        mode="ghost"
                        onClick={() => setIsAssetBrowserOpen(true)}
                      />
                      <Button
                        text="Usuń"
                        mode="ghost"
                        tone="critical"
                        onClick={() =>
                          setHeroConfig((prev) => ({ ...prev, imageUrl: "" }))
                        }
                      />
                    </Flex>
                  </Box>
                ) : (
                  <Card
                    padding={5}
                    radius={2}
                    border
                    tone="transparent"
                    style={{
                      textAlign: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => setIsAssetBrowserOpen(true)}
                  >
                    <Stack space={3}>
                      <Text size={4} muted>
                        📷
                      </Text>
                      <Text muted>Kliknij, aby wybrać obraz z biblioteki</Text>
                      <Text size={1} muted>
                        Zalecany format: 16:10
                      </Text>
                    </Stack>
                  </Card>
                )}
              </Stack>

              {/* Hero Text */}
              <Stack space={2}>
                <Label>Tekst nagłówka (opcjonalny)</Label>
                <RichTextEditor
                  value={heroConfig.text}
                  onChange={handleHeroTextChange}
                  placeholder="Opcjonalny tekst wyświetlany pod obrazem nagłówka..."
                />
                <Text size={1} muted>
                  Tekst z formatowaniem wyświetlany pod obrazem. Pozostaw puste,
                  aby nie wyświetlać.
                </Text>
              </Stack>
            </Stack>
          </Card>

          {/* Content List */}
          {hasItems ? (
            <Stack space={4}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSectionDragEnd}
              >
                <SortableContext
                  items={sectionOrder}
                  strategy={verticalListSortingStrategy}
                >
                  <Stack space={3}>
                    {sectionOrder.map((key) => {
                      const items = content[key];
                      if (items.length === 0) return null;
                      return (
                        <SortableContentGroup
                          key={key}
                          id={key}
                          title={SECTION_LABELS[key]}
                          listKey={key}
                          items={items}
                          selectedIds={selectedIds}
                          onToggle={toggleItem}
                          isEnabled={listsEnabled[key]}
                          isExpanded={listsExpanded[key]}
                          onToggleEnabled={() => toggleListEnabled(key)}
                          onToggleExpanded={() => toggleListExpanded(key)}
                          selectedCount={getSelectedCount(items)}
                        />
                      );
                    })}
                  </Stack>
                </SortableContext>
              </DndContext>

              {/* Actions */}
              <Card
                padding={4}
                radius={2}
                border
                tone="default"
                style={{ position: "sticky", bottom: 0 }}
              >
                <Flex gap={3} justify="space-between" align="center">
                  <Text size={1} muted>
                    {!heroConfig.imageUrl
                      ? "⚠️ Dodaj obraz nagłówka"
                      : !hasSelectedItems
                        ? "⚠️ Wybierz co najmniej jeden element"
                        : ""}
                  </Text>
                  <Flex gap={3}>
                    <Button
                      mode="ghost"
                      text="Pobierz HTML"
                      onClick={() => handleAction("download-html")}
                      disabled={
                        isGenerating || !heroConfig.imageUrl || !hasSelectedItems
                      }
                    />
                    <Button
                      icon={
                        hasSelectedItems ? ComposeSparklesIcon : undefined
                      }
                      tone="primary"
                      text="Wyślij do Mailchimp"
                      onClick={() => handleAction("create-mailchimp-draft")}
                      disabled={
                        isGenerating || !heroConfig.imageUrl || !hasSelectedItems
                      }
                    />
                  </Flex>
                </Flex>
              </Card>
            </Stack>
          ) : (
            <Card padding={5} radius={2} border style={{ textAlign: "center" }}>
              <Text muted>
                Brak treści. Wybierz zakres dat i kliknij &quot;Pobierz
                treści&quot;.
              </Text>
            </Card>
          )}
        </Flex>

        {/* Asset Browser Dialog */}
        {isAssetBrowserOpen && (
          <Dialog
            id="asset-browser"
            header="Wybierz obraz z biblioteki"
            onClose={() => setIsAssetBrowserOpen(false)}
            width={3}
          >
            <Box padding={4}>
              <Stack space={4}>
                {/* Search */}
                <TextInput
                  icon={SearchIcon}
                  placeholder="Szukaj po nazwie pliku... (przeszukuje całą bibliotekę)"
                  value={assetSearchQuery}
                  onChange={(e) => handleAssetSearch(e.currentTarget.value)}
                />

                {/* Assets Grid */}
                {isLoadingAssets ? (
                  <Flex justify="center" padding={5}>
                    <Spinner />
                  </Flex>
                ) : assets.length > 0 ? (
                  <Box
                    style={{
                      maxHeight: "60vh",
                      overflowY: "auto",
                    }}
                  >
                    <Grid columns={[2, 3, 4]} gap={3}>
                      {assets.map((asset) => (
                        <Card
                          key={asset._id}
                          radius={2}
                          style={{
                            cursor: "pointer",
                            overflow: "hidden",
                            border: "2px solid transparent",
                            transition: "border-color 150ms",
                          }}
                          onClick={() => handleAssetSelect(asset)}
                        >
                          <Box
                            style={{
                              aspectRatio: "16/10",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                            }}
                          >
                            <img
                              src={`${asset.url}?w=300&h=188&fit=crop`}
                              alt={asset.originalFilename}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </Box>
                          <Box padding={2}>
                            <Text
                              size={0}
                              style={{
                                wordBreak: "break-word",
                                lineHeight: 1.3,
                              }}
                            >
                              {asset.originalFilename || "Bez nazwy"}
                            </Text>
                          </Box>
                        </Card>
                      ))}
                    </Grid>
                  </Box>
                ) : (
                  <Card padding={5} radius={2} border style={{ textAlign: "center" }}>
                    <Text muted>
                      {assetSearchQuery
                        ? "Nie znaleziono obrazów"
                        : "Brak obrazów w bibliotece"}
                    </Text>
                  </Card>
                )}

                {/* Refresh button */}
                <Flex justify="center">
                  <Button
                    text="Odśwież listę"
                    mode="ghost"
                    icon={RefreshIcon}
                    onClick={() => fetchAssets(assetSearchQuery || undefined)}
                    disabled={isLoadingAssets}
                  />
                </Flex>
              </Stack>
            </Box>
          </Dialog>
        )}
      </Card>
    </ToastProvider>
  );
}

// Sortable wrapper that wires dnd-kit into ContentGroup
function SortableContentGroup(
  props: Omit<Parameters<typeof ContentGroup>[0], "dragHandleProps"> & {
    id: string;
  },
) {
  const { id, ...rest } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <ContentGroup
        {...rest}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// Helper Component for Collapsible List Groups
function ContentGroup({
  title,
  listKey,
  items,
  selectedIds,
  onToggle,
  isEnabled,
  isExpanded,
  onToggleEnabled,
  onToggleExpanded,
  selectedCount,
  dragHandleProps,
}: {
  title: string;
  listKey: ListKey;
  items: ContentItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  isEnabled: boolean;
  isExpanded: boolean;
  onToggleEnabled: () => void;
  onToggleExpanded: () => void;
  selectedCount: number;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  return (
    <Card border radius={2} overflow="hidden">
      {/* Header - Fixed height regardless of enabled state */}
      <Card
        tone={isEnabled ? "default" : "transparent"}
        borderBottom={isEnabled && isExpanded}
        padding={3}
        radius={0}
        style={{ opacity: isEnabled ? 1 : 0.7 }}
      >
      <Flex
        align="center"
        justify="space-between"
        style={{ minHeight: "32px" }}
      >
        <Flex align="center" gap={3}>
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            style={{
              display: "flex",
              alignItems: "center",
              cursor: "grab",
              opacity: 0.4,
              color: "inherit",
              touchAction: "none",
              background: "none",
            }}
            title="Przeciągnij, aby zmienić kolejność"
          >
            <DragHandleIcon style={{ fontSize: "20px" }} />
          </div>
          <Switch checked={isEnabled} onChange={onToggleEnabled} />
          <Box
            style={{
              cursor: isEnabled ? "pointer" : "default",
              opacity: isEnabled ? 1 : 0.5,
            }}
            onClick={isEnabled ? onToggleExpanded : undefined}
          >
            <Flex align="center" gap={2}>
              <Heading size={1}>{title}</Heading>
              <Text size={1} muted>
                ({selectedCount}/{items.length})
              </Text>
            </Flex>
          </Box>
        </Flex>
        {/* Always render button container to maintain consistent width */}
        <Box style={{ width: "32px", display: "flex", justifyContent: "center" }}>
          {isEnabled && (
            <Button
              icon={isExpanded ? ChevronUpIcon : ChevronDownIcon}
              mode="bleed"
              onClick={onToggleExpanded}
              padding={2}
            />
          )}
        </Box>
      </Flex>
      </Card>

      {/* Items */}
      {isEnabled && isExpanded && (
        <Box>
          {items.map((item, index) => (
            <Card
              key={item._id}
              padding={3}
              radius={0}
              borderBottom={index < items.length - 1}
              tone="default"
            >
              <Flex align="center" gap={3}>
                <Checkbox
                  checked={selectedIds.has(item._id)}
                  onChange={() => onToggle(item._id)}
                />
                <Box flex={1}>
                  <Text
                    weight="semibold"
                    size={1}
                    style={{ marginBottom: "0.25rem" }}
                  >
                    {item.title || item.name}
                  </Text>
                  <Text size={1} muted textOverflow="ellipsis">
                    {new Date(item.publishDate).toLocaleDateString("pl-PL")}
                    {item.authorName && ` • ${item.authorName}`}
                    {item.brandName && ` • ${item.brandName}`}
                    {(item.shortDescription || item.description) &&
                      ` • ${(item.shortDescription || item.description)?.substring(0, 50)}...`}
                  </Text>
                </Box>
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    style={{
                      width: 48,
                      height: 48,
                      objectFit:
                        item.imageSource === "preview" ? "contain" : "cover",
                      borderRadius: 4,
                      backgroundColor: "transparent",
                    }}
                  />
                )}
              </Flex>
            </Card>
          ))}
        </Box>
      )}
    </Card>
  );
}
