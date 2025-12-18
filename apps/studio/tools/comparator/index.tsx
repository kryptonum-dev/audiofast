"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AddIcon,
  CheckmarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DragHandleIcon,
  SearchIcon,
  TrashIcon,
} from "@sanity/icons";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  Flex,
  Heading,
  Label,
  Select,
  Spinner,
  Stack,
  Text,
  TextInput,
  ToastProvider,
  useToast,
} from "@sanity/ui";
import {
  ArrowDownWideNarrow,
  ArrowRightLeft,
  ArrowUpNarrowWide,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GitCompareArrows,
  Package,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "sanity";

// Types
type Category = {
  _id: string;
  name: string;
  parentName?: string;
  parentId?: string;
  productCount: number;
};

type ProductInfo = {
  _id: string;
  name: string;
  brandName?: string;
  brandId?: string;
  imageUrl?: string;
};

type DiscoveredParameter = {
  name: string;
  count: number;
  sampleValues: string[];
  products: ProductInfo[];
  missingProducts: ProductInfo[]; // Products that DON'T have this parameter
};

type EnabledParameter = {
  _key: string;
  name: string;
  displayName?: string;
};

type CategoryConfig = {
  _key: string;
  category: { _ref: string };
  enabledParameters: EnabledParameter[];
};

type ComparatorConfigDoc = {
  _id: string;
  _type: "comparatorConfig";
  categoryConfigs?: CategoryConfig[];
};

// Transform feature types
type TransformPreview = {
  eligible: ProductInfo[];
  skipped: ProductInfo[];
};

type FullProductTechnicalData = {
  _id: string;
  name: string;
  technicalData?: {
    variants?: string[];
    groups?: Array<{
      _key: string;
      title?: string;
      rows?: Array<{
        _key: string;
        title: string;
        values?: unknown[];
      }>;
    }>;
  };
};

// Sortable parameter item component with products dropdown
function SortableParameter({
  param,
  products,
  missingProducts,
  onRemove,
  onDisplayNameChange,
}: {
  param: EnabledParameter;
  products: ProductInfo[];
  missingProducts: ProductInfo[];
  onRemove: () => void;
  onDisplayNameChange: (displayName: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: param._key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const totalProducts = products.length + missingProducts.length;
  const hasAnyProducts = totalProducts > 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      padding={0}
      border
      radius={2}
      tone={isDragging ? "primary" : "default"}
    >
      <Box padding={3}>
        <Flex align="center" gap={3}>
          <Box
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", flexShrink: 0 }}
          >
            <DragHandleIcon />
          </Box>
          <Box flex={1}>
            <Flex align="center" gap={2}>
              <Text size={1} weight="medium">
                {param.name}
              </Text>
              <Badge
                tone="positive"
                fontSize={0}
                padding={1}
                title="Produkty z parametrem"
              >
                {products.length}
              </Badge>
              {missingProducts.length > 0 && (
                <Badge
                  tone="caution"
                  fontSize={0}
                  padding={1}
                  title="Produkty bez parametru"
                >
                  +{missingProducts.length}
                </Badge>
              )}
            </Flex>
          </Box>
          <Box style={{ width: "180px" }}>
            <TextInput
              value={param.displayName || ""}
              onChange={(e) => onDisplayNameChange(e.currentTarget.value)}
              placeholder="Nazwa wyświetlana..."
              fontSize={1}
            />
          </Box>
          {hasAnyProducts && (
            <Button
              icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
              mode="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              padding={2}
              title="Pokaż produkty"
            />
          )}
          <Button
            icon={TrashIcon}
            mode="ghost"
            tone="critical"
            onClick={onRemove}
            padding={2}
          />
        </Flex>
      </Box>

      {/* Products dropdown */}
      {isExpanded && hasAnyProducts && (
        <Box
          padding={3}
          style={{
            borderTop: "1px solid var(--card-border-color)",
            background: "var(--card-bg2-color)",
          }}
        >
          <Stack space={4}>
            {/* Products WITH the parameter */}
            {products.length > 0 && (
              <Stack space={2}>
                <Flex align="center" gap={2}>
                  <Badge tone="positive" fontSize={0} padding={1}>
                    ✓
                  </Badge>
                  <Text size={0} muted weight="medium">
                    Produkty z parametrem ({products.length}):
                  </Text>
                </Flex>
                <Stack space={1}>
                  {products.map((product) => (
                    <Flex key={product._id} align="center" gap={2} padding={1}>
                      <Avatar
                        src={product.imageUrl}
                        size={1}
                        style={{
                          borderRadius: "4px",
                          background: product.imageUrl
                            ? "transparent"
                            : "var(--card-bg-color)",
                        }}
                      />
                      <Box flex={1}>
                        <Text size={0}>{product.name}</Text>
                      </Box>
                      {product.brandName && (
                        <Badge tone="primary" fontSize={0} padding={1}>
                          {product.brandName}
                        </Badge>
                      )}
                    </Flex>
                  ))}
                </Stack>
              </Stack>
            )}

            {/* Products MISSING the parameter */}
            {missingProducts.length > 0 && (
              <Stack space={2}>
                <Flex align="center" gap={2}>
                  <Badge tone="caution" fontSize={0} padding={1}>
                    !
                  </Badge>
                  <Text size={0} muted weight="medium">
                    Produkty BEZ parametru ({missingProducts.length}):
                  </Text>
                </Flex>
                <Stack space={1}>
                  {missingProducts.map((product) => (
                    <Card
                      key={product._id}
                      padding={2}
                      radius={2}
                      tone="caution"
                      style={{ background: "var(--card-bg-color)" }}
                    >
                      <Flex align="center" gap={2}>
                        <Avatar
                          src={product.imageUrl}
                          size={1}
                          style={{
                            borderRadius: "4px",
                            background: product.imageUrl
                              ? "transparent"
                              : "var(--card-border-color)",
                          }}
                        />
                        <Box flex={1}>
                          <Text size={0}>{product.name}</Text>
                        </Box>
                        {product.brandName && (
                          <Badge tone="primary" fontSize={0} padding={1}>
                            {product.brandName}
                          </Badge>
                        )}
                        <Button
                          as="a"
                          href={
                            product.brandId
                              ? `/structure/produkty;produktyWedlugMarek;${product.brandId};${product._id}%2Cview%3Ddane-techniczne`
                              : `/intent/edit/id=${product._id};type=product`
                          }
                          target="_blank"
                          text="Edytuj"
                          mode="ghost"
                          tone="primary"
                          fontSize={0}
                          padding={2}
                        />
                      </Flex>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        </Box>
      )}
    </Card>
  );
}

// Main Comparator Tool Component
export default function ComparatorTool() {
  const client = useClient({ apiVersion: "2024-01-01" });
  const toast = useToast();

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [discoveredParams, setDiscoveredParams] = useState<
    DiscoveredParameter[]
  >([]);
  const [enabledParams, setEnabledParams] = useState<EnabledParameter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingParams, setIsLoadingParams] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [configDocId, setConfigDocId] = useState<string | null>(null);

  // Collapsible state for parent categories
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(
    new Set(),
  );
  // Expanded parameters in discovered list
  const [expandedDiscoveredParams, setExpandedDiscoveredParams] = useState<
    Set<string>
  >(new Set());
  // Sorting and pagination for discovered parameters
  const [sortOrder, setSortOrder] = useState<"most" | "least">("most");
  const [visibleCount, setVisibleCount] = useState(20);
  const PARAMS_PER_PAGE = 20;

  // Transform modal state
  const [transformModalOpen, setTransformModalOpen] = useState(false);
  const [sourceParam, setSourceParam] = useState<DiscoveredParameter | null>(
    null,
  );
  const [selectedExistingParam, setSelectedExistingParam] = useState<string>("");
  const [customParamName, setCustomParamName] = useState<string>("");
  const [transformPreview, setTransformPreview] =
    useState<TransformPreview | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [isTransforming, setIsTransforming] = useState(false);

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Toggle parent category collapse
  const toggleParentCollapse = useCallback((parentId: string) => {
    setCollapsedParents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  }, []);

  // Toggle discovered parameter expansion
  const toggleDiscoveredParamExpand = useCallback((paramName: string) => {
    setExpandedDiscoveredParams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(paramName)) {
        newSet.delete(paramName);
      } else {
        newSet.add(paramName);
      }
      return newSet;
    });
  }, []);

  // Load categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const query = `*[_type == "productCategorySub"] | order(name asc) {
          _id,
          name,
          "parentName": parentCategory->name,
          "parentId": parentCategory->_id,
          "productCount": count(*[_type == "product" && !(_id in path("drafts.**")) && references(^._id)])
        }`;

        const result = await client.fetch<Category[]>(query);
        setCategories(result);

        // Load config document
        const configDoc = await client.fetch<ComparatorConfigDoc | null>(
          `*[_type == "comparatorConfig"][0]`,
        );
        if (configDoc) {
          setConfigDocId(configDoc._id);
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        toast.push({
          status: "error",
          title: "Błąd",
          description: "Nie udało się pobrać kategorii.",
        });
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [client, toast]);

  // Fetch parameters function - extracted so it can be called for refresh
  const fetchParameters = useCallback(
    async (categoryId: string, skipConfigLoad = false) => {
      setIsLoadingParams(true);
      isInitializedRef.current = false;
      if (!skipConfigLoad) {
        setExpandedDiscoveredParams(new Set());
      }

      try {
        // Fetch all products in this category with their technical data (exclude drafts)
        const productsQuery = `*[_type == "product" && !(_id in path("drafts.**")) && references($categoryId)] {
        _id,
        name,
        "brandName": brand->name,
        "brandId": brand._ref,
        "imageUrl": coalesce(previewImage.asset->url, imageGallery[0].asset->url),
        "technicalData": technicalData {
          groups[] {
            title,
            rows[] {
              title,
              values[] {
                "text": pt::text(content)
              }
            }
          }
        }
      }`;

        const products = await client.fetch<
          Array<{
            _id: string;
            name: string;
            brandName?: string;
            brandId?: string;
            imageUrl?: string;
            technicalData?: {
              groups?: Array<{
                title?: string;
                rows?: Array<{
                  title: string;
                  values?: Array<{ text: string }>;
                }>;
              }>;
            };
          }>
        >(productsQuery, { categoryId });

        // Build a map of all products for quick lookup
        const allProductsMap = new Map<string, ProductInfo>();
        for (const product of products) {
          allProductsMap.set(product._id, {
            _id: product._id,
            name: product.name,
            brandName: product.brandName,
            brandId: product.brandId,
            imageUrl: product.imageUrl,
          });
        }

        // Discover all unique parameters with product info
        const paramMap = new Map<
          string,
          {
            count: number;
            sampleValues: Set<string>;
            products: Map<string, ProductInfo>;
          }
        >();

        for (const product of products) {
          if (!product.technicalData?.groups) continue;

          for (const group of product.technicalData.groups) {
            if (!group.rows) continue;

            for (const row of group.rows) {
              if (!row.title) continue;

              const normalizedName = row.title.trim();
              if (!paramMap.has(normalizedName)) {
                paramMap.set(normalizedName, {
                  count: 0,
                  sampleValues: new Set(),
                  products: new Map(),
                });
              }

              const param = paramMap.get(normalizedName)!;
              param.count++;

              // Add product info
              if (!param.products.has(product._id)) {
                param.products.set(product._id, {
                  _id: product._id,
                  name: product.name,
                  brandName: product.brandName,
                  brandId: product.brandId,
                  imageUrl: product.imageUrl,
                });
              }

              // Collect sample values
              if (row.values && row.values.length > 0) {
                for (const val of row.values) {
                  if (val.text && param.sampleValues.size < 3) {
                    param.sampleValues.add(
                      val.text.length > 50
                        ? val.text.substring(0, 50) + "..."
                        : val.text,
                    );
                  }
                }
              }
            }
          }
        }

        // Convert to array and sort by frequency, including missing products
        const discovered: DiscoveredParameter[] = Array.from(paramMap.entries())
          .map(([name, data]) => {
            // Calculate which products are MISSING this parameter
            const productsWithParam = data.products;
            const missingProducts: ProductInfo[] = [];

            for (const [productId, productInfo] of allProductsMap) {
              if (!productsWithParam.has(productId)) {
                missingProducts.push(productInfo);
              }
            }

            return {
              name,
              count: data.count,
              sampleValues: Array.from(data.sampleValues),
              products: Array.from(data.products.values()),
              missingProducts,
            };
          })
          .sort((a, b) => b.count - a.count);

        setDiscoveredParams(discovered);

        // Load enabled parameters for this category from config (unless skipping for refresh)
        if (!skipConfigLoad) {
          const configDoc = await client.fetch<ComparatorConfigDoc | null>(
            `*[_type == "comparatorConfig"][0]`,
          );

          if (configDoc?.categoryConfigs) {
            const categoryConfig = configDoc.categoryConfigs.find(
              (c) => c.category?._ref === categoryId,
            );
            if (categoryConfig?.enabledParameters) {
              setEnabledParams(categoryConfig.enabledParameters);
            } else {
              setEnabledParams([]);
            }
          } else {
            setEnabledParams([]);
          }
        }

        // Mark as initialized after short delay
        setTimeout(() => {
          isInitializedRef.current = true;
        }, 100);

        return true;
      } catch (err) {
        console.error("Error fetching parameters:", err);
        toast.push({
          status: "error",
          title: "Błąd",
          description: "Nie udało się pobrać parametrów.",
        });
        return false;
      } finally {
        setIsLoadingParams(false);
      }
    },
    [client, toast],
  );

  // Load parameters when category changes
  useEffect(() => {
    if (!selectedCategoryId) {
      setDiscoveredParams([]);
      setEnabledParams([]);
      return;
    }

    fetchParameters(selectedCategoryId);
  }, [selectedCategoryId, fetchParameters]);

  // Refresh data (keeps current enabled params, just refreshes discovered params)
  const handleRefreshData = useCallback(async () => {
    if (!selectedCategoryId) return;

    const success = await fetchParameters(selectedCategoryId, true);
    if (success) {
      toast.push({
        status: "success",
        title: "Odświeżono",
        description: "Dane parametrów zostały zaktualizowane.",
      });
    }
  }, [selectedCategoryId, fetchParameters, toast]);

  // Auto-save when enabledParams changes
  const saveConfig = useCallback(async () => {
    if (!selectedCategoryId || !isInitializedRef.current) return;

    setIsSaving(true);
    try {
      // Ensure config document exists
      let docId = configDocId;
      if (!docId) {
        // Create the config document
        const newDoc = await client.create({
          _type: "comparatorConfig",
          categoryConfigs: [],
        });
        docId = newDoc._id;
        setConfigDocId(docId);
      }

      // Fetch current config
      const currentConfig = await client.fetch<ComparatorConfigDoc>(
        `*[_type == "comparatorConfig"][0]`,
      );

      const currentConfigs = currentConfig?.categoryConfigs || [];

      // Find or create category config
      const existingIndex = currentConfigs.findIndex(
        (c) => c.category?._ref === selectedCategoryId,
      );

      const newCategoryConfig: CategoryConfig = {
        _key:
          existingIndex >= 0
            ? currentConfigs[existingIndex]._key
            : Math.random().toString(36).substring(2, 11),
        category: { _ref: selectedCategoryId },
        enabledParameters: enabledParams,
      };

      let updatedConfigs: CategoryConfig[];
      if (existingIndex >= 0) {
        updatedConfigs = [...currentConfigs];
        updatedConfigs[existingIndex] = newCategoryConfig;
      } else {
        updatedConfigs = [...currentConfigs, newCategoryConfig];
      }

      await client
        .patch(docId)
        .set({ categoryConfigs: updatedConfigs })
        .commit();
    } catch (err) {
      console.error("Error saving config:", err);
      toast.push({
        status: "error",
        title: "Błąd zapisu",
        description: "Nie udało się zapisać konfiguracji.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [client, configDocId, selectedCategoryId, enabledParams, toast]);

  // Debounced auto-save
  useEffect(() => {
    if (!isInitializedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveConfig();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabledParams, saveConfig]);

  // Generate key helper
  const generateKey = () => Math.random().toString(36).substring(2, 11);

  // Add parameter to enabled list
  const handleAddParameter = useCallback(
    (name: string) => {
      if (enabledParams.some((p) => p.name === name)) return;
      setEnabledParams((prev) => [...prev, { _key: generateKey(), name }]);
    },
    [enabledParams],
  );

  // Remove parameter from enabled list
  const handleRemoveParameter = useCallback((key: string) => {
    setEnabledParams((prev) => prev.filter((p) => p._key !== key));
  }, []);

  // Update display name
  const handleDisplayNameChange = useCallback(
    (key: string, displayName: string) => {
      setEnabledParams((prev) =>
        prev.map((p) =>
          p._key === key ? { ...p, displayName: displayName || undefined } : p,
        ),
      );
    },
    [],
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEnabledParams((prev) => {
        const oldIndex = prev.findIndex((p) => p._key === active.id);
        const newIndex = prev.findIndex((p) => p._key === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  // Add all discovered parameters
  const handleAddAllParameters = useCallback(() => {
    const newParams: EnabledParameter[] = discoveredParams
      .filter((d) => !enabledParams.some((e) => e.name === d.name))
      .map((d) => ({ _key: generateKey(), name: d.name }));

    setEnabledParams((prev) => [...prev, ...newParams]);
  }, [discoveredParams, enabledParams]);

  // Filter, sort, and paginate discovered parameters
  const { filteredDiscoveredParams, totalFilteredCount } = useMemo(() => {
    // First filter by search
    let filtered = discoveredParams;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = discoveredParams.filter((p) =>
        p.name.toLowerCase().includes(query),
      );
    }

    // Separate enabled and non-enabled parameters
    const enabledParamNames = new Set(enabledParams.map((p) => p.name));
    const enabledFiltered = filtered.filter((p) =>
      enabledParamNames.has(p.name),
    );
    const nonEnabledFiltered = filtered.filter(
      (p) => !enabledParamNames.has(p.name),
    );

    // Sort each group separately
    const sortFn = (a: DiscoveredParameter, b: DiscoveredParameter) => {
      if (sortOrder === "most") {
        return b.products.length - a.products.length;
      } else {
        return a.products.length - b.products.length;
      }
    };

    enabledFiltered.sort(sortFn);
    nonEnabledFiltered.sort(sortFn);

    // Combine: enabled first, then non-enabled
    const sorted = [...enabledFiltered, ...nonEnabledFiltered];

    // Return paginated results and total count
    return {
      filteredDiscoveredParams: sorted.slice(0, visibleCount),
      totalFilteredCount: sorted.length,
    };
  }, [discoveredParams, searchQuery, sortOrder, visibleCount, enabledParams]);

  // Reset pagination when category or search changes
  useEffect(() => {
    setVisibleCount(PARAMS_PER_PAGE);
  }, [selectedCategoryId, searchQuery]);

  // Load more parameters
  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PARAMS_PER_PAGE);
  }, []);

  // Group categories by parent
  const groupedCategories = useMemo(() => {
    const groups = new Map<
      string,
      { parentId: string; parent: string; categories: Category[] }
    >();

    for (const cat of categories) {
      const parentKey = cat.parentId || "no-parent";
      const parentName = cat.parentName || "Bez kategorii nadrzędnej";

      if (!groups.has(parentKey)) {
        groups.set(parentKey, {
          parentId: parentKey,
          parent: parentName,
          categories: [],
        });
      }
      groups.get(parentKey)!.categories.push(cat);
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.parent.localeCompare(b.parent),
    );
  }, [categories]);

  // Selected category details
  const selectedCategory = useMemo(
    () => categories.find((c) => c._id === selectedCategoryId),
    [categories, selectedCategoryId],
  );

  // Get products and missing products for an enabled parameter
  const getParamData = useCallback(
    (paramName: string) => {
      const discovered = discoveredParams.find((d) => d.name === paramName);
      return {
        products: discovered?.products || [],
        missingProducts: discovered?.missingProducts || [],
      };
    },
    [discoveredParams],
  );

  // ============================================
  // TRANSFORM PARAMETER FUNCTIONS
  // ============================================

  // Open transform modal
  const openTransformModal = useCallback((param: DiscoveredParameter) => {
    setSourceParam(param);
    setSelectedExistingParam("");
    setCustomParamName("");
    setTransformPreview(null);
    setSelectedProductIds(new Set());
    setTransformModalOpen(true);
  }, []);

  // Close transform modal
  const closeTransformModal = useCallback(() => {
    setTransformModalOpen(false);
    setSourceParam(null);
    setSelectedExistingParam("");
    setCustomParamName("");
    setTransformPreview(null);
    setSelectedProductIds(new Set());
  }, []);

  // Calculate preview when target changes
  const calculateTransformPreview = useCallback(
    (targetName: string) => {
      if (!sourceParam || !targetName.trim()) {
        setTransformPreview(null);
        setSelectedProductIds(new Set());
        return;
      }

      // Check if target parameter already exists in the category
      const existingTargetParam = discoveredParams.find(
        (p) => p.name === targetName.trim(),
      );

      let eligible: ProductInfo[];
      let skipped: ProductInfo[];

      if (existingTargetParam) {
        // Target exists - check for duplicates
        const targetProductIds = new Set(
          existingTargetParam.products.map((p) => p._id),
        );
        eligible = sourceParam.products.filter(
          (p) => !targetProductIds.has(p._id),
        );
        skipped = sourceParam.products.filter((p) =>
          targetProductIds.has(p._id),
        );
      } else {
        // Target is a NEW name - all products with source are eligible
        eligible = sourceParam.products;
        skipped = [];
      }

      setTransformPreview({ eligible, skipped });
      // Select all eligible products by default
      setSelectedProductIds(new Set(eligible.map((p) => p._id)));
    },
    [sourceParam, discoveredParams],
  );

  // Handle dropdown selection
  const handleExistingParamSelect = useCallback(
    (value: string) => {
      setSelectedExistingParam(value);
      setCustomParamName(""); // Clear custom input when dropdown is used
      calculateTransformPreview(value);
    },
    [calculateTransformPreview],
  );

  // Handle custom name input
  const handleCustomNameChange = useCallback(
    (value: string) => {
      setCustomParamName(value);
      setSelectedExistingParam(""); // Clear dropdown when custom input is used
      calculateTransformPreview(value);
    },
    [calculateTransformPreview],
  );

  // Toggle single product selection
  const toggleProductSelection = useCallback((productId: string) => {
    setSelectedProductIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  // Select all eligible products
  const selectAllProducts = useCallback(() => {
    if (transformPreview?.eligible) {
      setSelectedProductIds(
        new Set(transformPreview.eligible.map((p) => p._id)),
      );
    }
  }, [transformPreview?.eligible]);

  // Deselect all products
  const deselectAllProducts = useCallback(() => {
    setSelectedProductIds(new Set());
  }, []);

  // Computed target name
  const targetParamName = customParamName.trim() || selectedExistingParam;

  // Execute transformation
  const handleTransformConfirm = useCallback(async () => {
    if (
      !sourceParam ||
      !targetParamName ||
      !transformPreview?.eligible.length ||
      selectedProductIds.size === 0
    ) {
      return;
    }

    // Validation: target cannot be same as source
    if (targetParamName === sourceParam.name) {
      toast.push({
        status: "error",
        title: "Błąd",
        description: "Nazwa docelowa nie może być taka sama jak źródłowa.",
      });
      return;
    }

    setIsTransforming(true);

    try {
      // 1. Fetch full product data for SELECTED products only
      const productIds = Array.from(selectedProductIds);
      const fullProducts = await client.fetch<FullProductTechnicalData[]>(
        `*[_type == "product" && _id in $productIds] {
          _id,
          name,
          technicalData {
            variants,
            groups[] {
              _key,
              title,
              rows[] {
                _key,
                title,
                values
              }
            }
          }
        }`,
        { productIds },
      );

      // 2. Build and execute transaction
      const transaction = client.transaction();
      let patchCount = 0;

      for (const product of fullProducts) {
        const groups = product.technicalData?.groups || [];

        for (const group of groups) {
          const rows = group.rows || [];
          for (const row of rows) {
            if (row.title === sourceParam.name) {
              // Use _key based path for reliability
              transaction.patch(product._id, (patch) =>
                patch.set({
                  [`technicalData.groups[_key=="${group._key}"].rows[_key=="${row._key}"].title`]:
                    targetParamName,
                }),
              );
              patchCount++;
              break; // Only patch first occurrence per group
            }
          }
        }
      }

      if (patchCount > 0) {
        await transaction.commit();
      }

      // 3. Success handling
      toast.push({
        status: "success",
        title: "Przekształcono!",
        description: `Zaktualizowano ${patchCount} parametrów w ${selectedProductIds.size} produktach.`,
      });

      // 4. Refresh data and close modal
      await fetchParameters(selectedCategoryId!, true);
      closeTransformModal();
    } catch (error) {
      console.error("Transform error:", error);
      toast.push({
        status: "error",
        title: "Błąd przekształcenia",
        description:
          error instanceof Error
            ? error.message
            : "Nie udało się przekształcić parametrów.",
      });
    } finally {
      setIsTransforming(false);
    }
  }, [
    sourceParam,
    targetParamName,
    transformPreview,
    selectedProductIds,
    client,
    toast,
    fetchParameters,
    selectedCategoryId,
    closeTransformModal,
  ]);

  return (
    <ToastProvider>
      <Flex style={{ height: "100%", overflow: "hidden" }}>
        {/* Left Sidebar - Categories */}
        <Card
          style={{
            width: "320px",
            flexShrink: 0,
            borderRight: "1px solid var(--card-border-color)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Sidebar Header */}
          <Box
            padding={4}
            style={{ borderBottom: "1px solid var(--card-border-color)" }}
          >
            <Flex align="center" gap={2}>
              <GitCompareArrows size={20} />
              <Heading size={1}>Porównywarka</Heading>
            </Flex>
            <Text size={1} muted style={{ marginTop: "0.5rem" }}>
              Wybierz kategorię, aby skonfigurować parametry porównania.
            </Text>
          </Box>

          {/* Category List */}
          <Box padding={3} style={{ flex: 1, overflowY: "auto" }}>
            {isLoadingCategories ? (
              <Flex align="center" justify="center" padding={5}>
                <Spinner muted />
              </Flex>
            ) : (
              <Stack space={2}>
                {groupedCategories.map((group) => {
                  const isCollapsed = collapsedParents.has(group.parentId);

                  return (
                    <Box key={group.parentId}>
                      {/* Parent Category Header */}
                      <Card
                        padding={3}
                        radius={2}
                        tone="primary"
                        style={{
                          cursor: "pointer",
                          background: "var(--card-bg2-color)",
                        }}
                        onClick={() => toggleParentCollapse(group.parentId)}
                      >
                        <Flex align="center" gap={2}>
                          <Box style={{ flexShrink: 0 }}>
                            {isCollapsed ? (
                              <ChevronRight size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </Box>
                          <FolderOpen size={16} />
                          <Box flex={1}>
                            <Text size={1} weight="semibold">
                              {group.parent}
                            </Text>
                          </Box>
                          <Badge
                            tone="default"
                            fontSize={0}
                            padding={1}
                            radius={2}
                          >
                            {group.categories.length}
                          </Badge>
                        </Flex>
                      </Card>

                      {/* Subcategories */}
                      {!isCollapsed && (
                        <Box paddingLeft={3} paddingTop={1}>
                          <Stack space={1}>
                            {group.categories.map((cat) => {
                              const isSelected = cat._id === selectedCategoryId;

                              return (
                                <Card
                                  key={cat._id}
                                  padding={3}
                                  radius={2}
                                  tone={isSelected ? "positive" : "default"}
                                  style={{
                                    cursor: "pointer",
                                    marginLeft: "8px",
                                    borderLeft: "2px solid",
                                    borderLeftColor: isSelected
                                      ? "var(--card-focus-ring-color)"
                                      : "var(--card-border-color)",
                                    background: isSelected
                                      ? "var(--card-bg-color)"
                                      : "transparent",
                                  }}
                                  onClick={() => setSelectedCategoryId(cat._id)}
                                >
                                  <Flex align="center" gap={2}>
                                    <Folder size={14} />
                                    <Box flex={1}>
                                      <Text
                                        size={1}
                                        weight={
                                          isSelected ? "semibold" : "regular"
                                        }
                                      >
                                        {cat.name}
                                      </Text>
                                    </Box>
                                    <Badge
                                      tone={
                                        cat.productCount > 0
                                          ? "default"
                                          : "caution"
                                      }
                                      fontSize={0}
                                      padding={1}
                                      radius={2}
                                    >
                                      {cat.productCount}
                                    </Badge>
                                    {isSelected && <ChevronRightIcon />}
                                  </Flex>
                                </Card>
                              );
                            })}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Card>

        {/* Main Content */}
        <Box
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {!selectedCategoryId ? (
            /* Empty State */
            <Flex
              align="center"
              justify="center"
              style={{ flex: 1 }}
              direction="column"
              gap={4}
            >
              <Box
                style={{
                  padding: "2rem",
                  borderRadius: "50%",
                  background: "var(--card-bg2-color)",
                }}
              >
                <GitCompareArrows size={48} strokeWidth={1.5} />
              </Box>
              <Stack space={2} style={{ textAlign: "center" }}>
                <Text size={2} weight="semibold">
                  Wybierz kategorię
                </Text>
                <Text size={1} muted>
                  Wybierz kategorię z listy po lewej stronie, aby skonfigurować
                  parametry do porównania.
                </Text>
              </Stack>
            </Flex>
          ) : (
            /* Category Configuration */
            <Flex direction="column" style={{ flex: 1, overflow: "hidden" }}>
              {/* Header */}
              <Box
                padding={4}
                style={{ borderBottom: "1px solid var(--card-border-color)" }}
              >
                <Flex align="center" justify="space-between">
                  <Stack space={2}>
                    <Flex align="center" gap={2}>
                      <Package size={18} />
                      <Heading size={2}>{selectedCategory?.name}</Heading>
                    </Flex>
                    <Text size={1} muted>
                      {selectedCategory?.productCount || 0} produktów •{" "}
                      {discoveredParams.length} wykrytych parametrów •{" "}
                      {enabledParams.length} włączonych
                    </Text>
                  </Stack>
                  <Flex align="center" gap={3}>
                    {isSaving && (
                      <Flex align="center" gap={2}>
                        <Spinner muted />
                        <Text size={1} muted>
                          Zapisywanie...
                        </Text>
                      </Flex>
                    )}
                    <Button
                      icon={RefreshCw}
                      text="Odśwież dane"
                      mode="ghost"
                      fontSize={0}
                      padding={2}
                      onClick={handleRefreshData}
                      disabled={isLoadingParams}
                      title="Odśwież dane parametrów z produktów"
                    />
                  </Flex>
                </Flex>
              </Box>

              {/* Content */}
              <Flex style={{ flex: 1, overflow: "hidden" }}>
                {isLoadingParams ? (
                  <Flex align="center" justify="center" style={{ flex: 1 }}>
                    <Spinner muted />
                  </Flex>
                ) : (
                  <>
                    {/* Discovered Parameters */}
                    <Box
                      padding={4}
                      style={{
                        width: "420px",
                        borderRight: "1px solid var(--card-border-color)",
                        overflowY: "auto",
                      }}
                    >
                      <Stack space={4}>
                        <Flex align="center" justify="space-between">
                          <Stack space={1}>
                            <Label size={1}>Wykryte parametry</Label>
                            <Text size={0} muted>
                              {totalFilteredCount} parametrów
                              {visibleCount < totalFilteredCount &&
                                ` (pokazano ${visibleCount})`}
                            </Text>
                          </Stack>
                          <Flex gap={2}>
                            <Button
                              icon={
                                sortOrder === "most"
                                  ? ArrowDownWideNarrow
                                  : ArrowUpNarrowWide
                              }
                              text={
                                sortOrder === "most" ? "Najwięcej" : "Najmniej"
                              }
                              mode="ghost"
                              fontSize={0}
                              padding={2}
                              onClick={() =>
                                setSortOrder(
                                  sortOrder === "most" ? "least" : "most",
                                )
                              }
                              title={
                                sortOrder === "most"
                                  ? "Sortuj od największej liczby produktów"
                                  : "Sortuj od najmniejszej liczby produktów"
                              }
                            />
                            <Button
                              icon={Sparkles}
                              text="Dodaj wszystkie"
                              mode="ghost"
                              tone="positive"
                              fontSize={0}
                              padding={2}
                              onClick={handleAddAllParameters}
                              disabled={
                                filteredDiscoveredParams.length === 0 ||
                                filteredDiscoveredParams.every((d) =>
                                  enabledParams.some((e) => e.name === d.name),
                                )
                              }
                            />
                          </Flex>
                        </Flex>

                        <TextInput
                          icon={SearchIcon}
                          value={searchQuery}
                          onChange={(e) =>
                            setSearchQuery(e.currentTarget.value)
                          }
                          placeholder="Szukaj parametrów..."
                          fontSize={1}
                        />

                        {filteredDiscoveredParams.length === 0 ? (
                          <Card
                            padding={4}
                            border
                            radius={2}
                            tone="transparent"
                          >
                            <Text size={1} muted align="center">
                              {discoveredParams.length === 0
                                ? "Brak parametrów w produktach tej kategorii."
                                : "Nie znaleziono parametrów."}
                            </Text>
                          </Card>
                        ) : (
                          <Stack space={2}>
                            {filteredDiscoveredParams.map((param) => {
                              const isEnabled = enabledParams.some(
                                (e) => e.name === param.name,
                              );
                              const isExpanded = expandedDiscoveredParams.has(
                                param.name,
                              );

                              const hasAnyProducts =
                                param.products.length > 0 ||
                                param.missingProducts.length > 0;

                              return (
                                <Card
                                  key={param.name}
                                  padding={0}
                                  border
                                  radius={2}
                                  tone={isEnabled ? "positive" : "default"}
                                  style={{
                                    opacity: isEnabled ? 0.7 : 1,
                                  }}
                                >
                                  <Flex align="flex-start">
                                    {/* Main content - clickable to add */}
                                    <Box
                                      padding={3}
                                      flex={1}
                                      style={{
                                        cursor: isEnabled
                                          ? "default"
                                          : "pointer",
                                        alignItems: "center",
                                      }}
                                      onClick={() =>
                                        !isEnabled &&
                                        handleAddParameter(param.name)
                                      }
                                    >
                                      <Flex align="flex-start" gap={3}>
                                        <Box style={{ marginTop: "2px" }}>
                                          {isEnabled ? (
                                            <CheckmarkIcon />
                                          ) : (
                                            <AddIcon />
                                          )}
                                        </Box>
                                        <Box flex={1}>
                                          <Flex align="center" gap={2}>
                                            <Text size={1} weight="medium">
                                              {param.name}
                                            </Text>
                                            <Badge
                                              tone="positive"
                                              fontSize={0}
                                              padding={1}
                                              title="Produkty z parametrem"
                                            >
                                              {param.products.length}
                                            </Badge>
                                            {param.missingProducts.length >
                                              0 && (
                                              <Badge
                                                tone="caution"
                                                fontSize={0}
                                                padding={1}
                                                title="Produkty bez parametru"
                                              >
                                                +{param.missingProducts.length}
                                              </Badge>
                                            )}
                                          </Flex>
                                        </Box>
                                      </Flex>
                                    </Box>

                                    {/* Transform button */}
                                    {param.products.length > 0 &&
                                      discoveredParams.length > 1 && (
                                        <Button
                                          icon={() => (
                                            <ArrowRightLeft size={17} />
                                          )}
                                          mode="bleed"
                                          padding={3}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openTransformModal(param);
                                          }}
                                          title="Przekształć w inny parametr"
                                          style={{
                                            paddingTop: "1px",
                                       
                                          }}
                                        />
                                      )}

                                    {/* Expand button */}
                                    {hasAnyProducts && (
                                      <Button
                                        icon={
                                          isExpanded
                                            ? ChevronDownIcon
                                            : ChevronRightIcon
                                        }
                                        mode="bleed"
                                        padding={3}
                                        onClick={() =>
                                          toggleDiscoveredParamExpand(
                                            param.name,
                                          )
                                        }
                                        title="Pokaż produkty"
                                      />
                                    )}
                                  </Flex>

                                  {/* Products list */}
                                  {isExpanded && hasAnyProducts && (
                                    <Box
                                      padding={3}
                                      style={{
                                        borderTop:
                                          "1px solid var(--card-border-color)",
                                        background: "var(--card-bg2-color)",
                                      }}
                                    >
                                      <Stack space={3}>
                                        {/* Products WITH the parameter */}
                                        {param.products.length > 0 && (
                                          <Stack space={2}>
                                            <Flex align="center" gap={2}>
                                              <Badge
                                                tone="positive"
                                                fontSize={0}
                                                padding={1}
                                              >
                                                ✓
                                              </Badge>
                                              <Text
                                                size={0}
                                                muted
                                                weight="medium"
                                              >
                                                Z parametrem (
                                                {param.products.length}):
                                              </Text>
                                            </Flex>
                                            <Stack space={1}>
                                              {param.products.map((product) => (
                                                <Flex
                                                  key={product._id}
                                                  align="center"
                                                  gap={2}
                                                  padding={1}
                                                >
                                                  <Avatar
                                                    src={product.imageUrl}
                                                    size={1}
                                                    style={{
                                                      borderRadius: "4px",
                                                      background:
                                                        product.imageUrl
                                                          ? "transparent"
                                                          : "var(--card-bg-color)",
                                                    }}
                                                  />
                                                  <Box flex={1}>
                                                    <Text size={0}>
                                                      {product.name}
                                                    </Text>
                                                  </Box>
                                                  {product.brandName && (
                                                    <Badge
                                                      tone="primary"
                                                      fontSize={0}
                                                      padding={1}
                                                    >
                                                      {product.brandName}
                                                    </Badge>
                                                  )}
                                                </Flex>
                                              ))}
                                            </Stack>
                                          </Stack>
                                        )}

                                        {/* Products MISSING the parameter */}
                                        {param.missingProducts.length > 0 && (
                                          <Stack space={2}>
                                            <Flex align="center" gap={2}>
                                              <Badge
                                                tone="caution"
                                                fontSize={0}
                                                padding={1}
                                              >
                                                !
                                              </Badge>
                                              <Text
                                                size={0}
                                                muted
                                                weight="medium"
                                              >
                                                Bez parametru (
                                                {param.missingProducts.length}):
                                              </Text>
                                            </Flex>
                                            <Stack space={1}>
                                              {param.missingProducts.map(
                                                (product) => (
                                                  <Card
                                                    key={product._id}
                                                    padding={2}
                                                    radius={2}
                                                    tone="caution"
                                                    style={{
                                                      background:
                                                        "var(--card-bg-color)",
                                                    }}
                                                  >
                                                    <Flex
                                                      align="center"
                                                      gap={2}
                                                    >
                                                      <Avatar
                                                        src={product.imageUrl}
                                                        size={1}
                                                        style={{
                                                          borderRadius: "4px",
                                                          background:
                                                            product.imageUrl
                                                              ? "transparent"
                                                              : "var(--card-border-color)",
                                                        }}
                                                      />
                                                      <Box flex={1}>
                                                        <Text size={0}>
                                                          {product.name}
                                                        </Text>
                                                      </Box>
                                                      {product.brandName && (
                                                        <Badge
                                                          tone="primary"
                                                          fontSize={0}
                                                          padding={1}
                                                        >
                                                          {product.brandName}
                                                        </Badge>
                                                      )}
                                                      <Button
                                                        as="a"
                                                        href={
                                                          product.brandId
                                                            ? `/structure/produkty;produktyWedlugMarek;${product.brandId};${product._id}%2Cview%3Ddane-techniczne`
                                                            : `/intent/edit/id=${product._id};type=product`
                                                        }
                                                        target="_blank"
                                                        text="Edytuj"
                                                        mode="ghost"
                                                        tone="primary"
                                                        fontSize={0}
                                                        padding={2}
                                                      />
                                                    </Flex>
                                                  </Card>
                                                ),
                                              )}
                                            </Stack>
                                          </Stack>
                                        )}
                                      </Stack>
                                    </Box>
                                  )}
                                </Card>
                              );
                            })}

                            {/* Load more button */}
                            {visibleCount < totalFilteredCount && (
                              <Button
                                text={`Pokaż więcej (${totalFilteredCount - visibleCount} pozostało)`}
                                mode="ghost"
                                onClick={handleLoadMore}
                                style={{ width: "100%" }}
                              />
                            )}
                          </Stack>
                        )}
                      </Stack>
                    </Box>

                    {/* Enabled Parameters */}
                    <Box padding={4} style={{ flex: 1, overflowY: "auto" }}>
                      <Stack space={4}>
                        <Stack space={2}>
                          <Label size={1}>
                            Parametry do porównania ({enabledParams.length})
                          </Label>
                          <Text size={1} muted>
                            Przeciągaj, aby zmienić kolejność. Kliknij strzałkę,
                            aby zobaczyć produkty z danym parametrem.
                          </Text>
                        </Stack>

                        {enabledParams.length === 0 ? (
                          <Card
                            padding={5}
                            border
                            radius={2}
                            tone="transparent"
                            style={{ textAlign: "center" }}
                          >
                            <Stack space={3}>
                              <Text size={1} muted>
                                Brak wybranych parametrów.
                              </Text>
                              <Text size={1} muted>
                                Kliknij parametr z listy po lewej, aby dodać go
                                do porównania.
                              </Text>
                            </Stack>
                          </Card>
                        ) : (
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext
                              items={enabledParams.map((p) => p._key)}
                              strategy={verticalListSortingStrategy}
                            >
                              <Stack space={2}>
                                {enabledParams.map((param) => {
                                  const paramData = getParamData(param.name);
                                  return (
                                    <SortableParameter
                                      key={param._key}
                                      param={param}
                                      products={paramData.products}
                                      missingProducts={
                                        paramData.missingProducts
                                      }
                                      onRemove={() =>
                                        handleRemoveParameter(param._key)
                                      }
                                      onDisplayNameChange={(displayName) =>
                                        handleDisplayNameChange(
                                          param._key,
                                          displayName,
                                        )
                                      }
                                    />
                                  );
                                })}
                              </Stack>
                            </SortableContext>
                          </DndContext>
                        )}
                      </Stack>
                    </Box>
                  </>
                )}
              </Flex>
            </Flex>
          )}
        </Box>
      </Flex>

      {/* Transform Parameter Modal */}
      {transformModalOpen && sourceParam && (
        <Dialog
          id="transform-parameter-modal"
          header="Przekształć parametr"
          onClose={closeTransformModal}
          width={1}
        >
          <Box padding={4}>
            <Stack space={4}>
              {/* Source parameter info */}
              <Card padding={3} radius={2} tone="primary">
                <Stack space={2}>
                  <Text size={1} weight="medium">
                    Parametr źródłowy:
                  </Text>
                  <Flex align="center" gap={2}>
                    <Text size={2} weight="semibold">
                      {sourceParam.name}
                    </Text>
                    <Badge tone="positive">
                      {sourceParam.products.length} produktów
                    </Badge>
                  </Flex>
                </Stack>
              </Card>

              {/* Target selection - Dropdown for existing params */}
              <Stack space={2}>
                <Label size={1}>Przekształć w istniejący parametr:</Label>
                <Select
                  value={selectedExistingParam}
                  onChange={(e) =>
                    handleExistingParamSelect(e.currentTarget.value)
                  }
                >
                  <option value="">Wybierz parametr docelowy...</option>
                  {discoveredParams
                    .filter((p) => p.name !== sourceParam.name)
                    .map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.products.length} produktów)
                      </option>
                    ))}
                </Select>
              </Stack>

              {/* Divider */}
              <Flex align="center" gap={3}>
                <Box
                  style={{
                    flex: 1,
                    height: "1px",
                    background: "var(--card-border-color)",
                  }}
                />
                <Text size={0} muted>
                  lub wpisz nową nazwę
                </Text>
                <Box
                  style={{
                    flex: 1,
                    height: "1px",
                    background: "var(--card-border-color)",
                  }}
                />
              </Flex>

              {/* Custom name input */}
              <Stack space={2}>
                <Label size={1}>Nowa nazwa parametru:</Label>
                <TextInput
                  value={customParamName}
                  onChange={(e) => handleCustomNameChange(e.currentTarget.value)}
                  placeholder="Wpisz nową nazwę parametru..."
                />
                {customParamName.trim() &&
                  !discoveredParams.find(
                    (p) => p.name === customParamName.trim(),
                  ) && (
                    <Text size={0} muted>
                      ✨ Ta nazwa nie istnieje jeszcze w tej kategorii - zostanie
                      utworzona
                    </Text>
                  )}
              </Stack>

              {/* Preview with checkboxes */}
              {transformPreview && (
                <Card padding={3} radius={2} border>
                  <Stack space={3}>
                    {/* Eligible products with checkboxes */}
                    {transformPreview.eligible.length > 0 && (
                      <Stack space={2}>
                        <Flex align="center" justify="space-between">
                          <Flex align="center" gap={2}>
                            <Badge tone="positive">✓</Badge>
                            <Text size={1} weight="medium">
                              Produkty do przekształcenia ({selectedProductIds.size}
                              /{transformPreview.eligible.length}):
                            </Text>
                          </Flex>
                          <Flex gap={2}>
                            <Button
                              text="Zaznacz wszystkie"
                              mode="ghost"
                              fontSize={0}
                              padding={2}
                              onClick={selectAllProducts}
                              disabled={
                                selectedProductIds.size ===
                                transformPreview.eligible.length
                              }
                            />
                            <Button
                              text="Odznacz wszystkie"
                              mode="ghost"
                              fontSize={0}
                              padding={2}
                              onClick={deselectAllProducts}
                              disabled={selectedProductIds.size === 0}
                            />
                          </Flex>
                        </Flex>
                        <Stack space={1}>
                          {transformPreview.eligible.map((p) => (
                            <Flex
                              key={p._id}
                              align="center"
                              gap={2}
                              padding={2}
                              style={{
                                background: selectedProductIds.has(p._id)
                                  ? "var(--card-bg2-color)"
                                  : "transparent",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                              onClick={() => toggleProductSelection(p._id)}
                            >
                              <Checkbox
                                checked={selectedProductIds.has(p._id)}
                                onChange={() => toggleProductSelection(p._id)}
                              />
                              <Avatar
                                src={p.imageUrl}
                                size={1}
                                style={{ borderRadius: "4px" }}
                              />
                              <Box flex={1}>
                                <Text size={1}>{p.name}</Text>
                              </Box>
                              {p.brandName && (
                                <Badge tone="primary" fontSize={0} padding={1}>
                                  {p.brandName}
                                </Badge>
                              )}
                            </Flex>
                          ))}
                        </Stack>
                      </Stack>
                    )}

                    {/* Skipped products (no checkboxes - just info) */}
                    {transformPreview.skipped.length > 0 && (
                      <Stack space={2}>
                        <Flex align="center" gap={2}>
                          <Badge tone="caution">⚠</Badge>
                          <Text size={1} weight="medium">
                            Produkty pominięte - mają już &quot;
                            {targetParamName}&quot; (
                            {transformPreview.skipped.length}):
                          </Text>
                        </Flex>
                        <Stack space={1}>
                          {transformPreview.skipped.slice(0, 5).map((p) => (
                            <Flex
                              key={p._id}
                              align="center"
                              gap={2}
                              padding={1}
                            >
                              <Avatar
                                src={p.imageUrl}
                                size={1}
                                style={{
                                  borderRadius: "4px",
                                  opacity: 0.6,
                                }}
                              />
                              <Text size={0} muted>
                                {p.name}
                              </Text>
                            </Flex>
                          ))}
                          {transformPreview.skipped.length > 5 && (
                            <Text size={0} muted>
                              ... i {transformPreview.skipped.length - 5} więcej
                            </Text>
                          )}
                        </Stack>
                      </Stack>
                    )}

                    {/* No eligible products message */}
                    {transformPreview.eligible.length === 0 && (
                      <Card padding={3} radius={2} tone="caution">
                        <Text size={1}>
                          Wszystkie produkty z &quot;{sourceParam.name}&quot; mają
                          już parametr &quot;{targetParamName}&quot;. Nie ma nic
                          do przekształcenia.
                        </Text>
                      </Card>
                    )}
                  </Stack>
                </Card>
              )}

              {/* Actions */}
              <Flex gap={3} justify="flex-end">
                <Button
                  text="Anuluj"
                  mode="ghost"
                  onClick={closeTransformModal}
                  disabled={isTransforming}
                />
                <Button
                  text={
                    isTransforming
                      ? "Przekształcanie..."
                      : selectedProductIds.size > 0
                        ? `Przekształć ${selectedProductIds.size} prod.`
                        : "Przekształć"
                  }
                  tone="positive"
                  onClick={handleTransformConfirm}
                  disabled={
                    !targetParamName ||
                    selectedProductIds.size === 0 ||
                    isTransforming
                  }
                  loading={isTransforming}
                />
              </Flex>
            </Stack>
          </Box>
        </Dialog>
      )}
    </ToastProvider>
  );
}
