/**
 * Transformer for ProductType → productCategorySub migration
 * Handles data transformation and SEO description generation
 */

import type {
  ParentCategoryMapping,
  ProductTypeRecord,
  SubCategory,
  ValidationError,
} from "./types";

/**
 * Parent category mappings: SQL DeviceType ID → Sanity ID
 * These were manually created in Sanity
 */
export const PARENT_CATEGORY_MAPPINGS: ParentCategoryMapping[] = [
  {
    sqlId: 1,
    name: "Źródła cyfrowe i analogowe",
    sanityId: "37982ce0-8bca-4a06-8662-62aa7edb4cc1",
  },
  {
    sqlId: 2,
    name: "Zasilanie i uziemianie",
    sanityId: "712c96e8-bcd5-4082-92a9-f19c357d86c2",
  },
  {
    sqlId: 3,
    name: "Głośniki i subwoofery",
    sanityId: "parent-cat-speakers",
  },
  {
    sqlId: 4,
    name: "Wzmacniacze i przedwzmacniacze",
    sanityId: "parent-cat-amplifiers",
  },
  {
    sqlId: 5,
    name: "Przewody audio",
    sanityId: "parent-cat-cables",
  },
  {
    sqlId: 6,
    name: "Akcesoria",
    sanityId: "7366aa2c-a829-4567-b4ff-7eaec7cbc658",
  },
];

/**
 * Generate a proper Sanity UUID v4 format from category ID
 */
export function generateSanityId(categoryId: number): string {
  const seed = `subcat-${categoryId}`;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const hexChars = "0123456789abcdef";
  const segments = [8, 4, 4, 4, 12];
  const parts: string[] = [];

  let seedValue = Math.abs(hash);

  for (const length of segments) {
    let segment = "";
    for (let i = 0; i < length; i++) {
      const index = (seedValue + categoryId * (i + 1) * 7 + i * 13) % 16;
      segment += hexChars[index];
      seedValue = (seedValue * 31 + i) % 2147483647;
    }
    parts.push(segment);
  }

  return parts.join("-");
}

/**
 * Convert a name to a URL-safe slug
 */
export function slugify(text: string): string {
  const polishChars: Record<string, string> = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
    Ą: "a",
    Ć: "c",
    Ę: "e",
    Ł: "l",
    Ń: "n",
    Ó: "o",
    Ś: "s",
    Ź: "z",
    Ż: "z",
  };

  let result = text.toLowerCase();

  // Replace Polish characters
  for (const [polish, ascii] of Object.entries(polishChars)) {
    result = result.replace(new RegExp(polish, "g"), ascii);
  }

  // Replace spaces and special chars with hyphens
  result = result
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return result;
}

/**
 * Get Sanity parent category ID from SQL DeviceType ID
 */
export function getParentCategorySanityId(deviceTypeId: number): string | null {
  const mapping = PARENT_CATEGORY_MAPPINGS.find(
    (m) => m.sqlId === deviceTypeId,
  );
  return mapping?.sanityId || null;
}

/**
 * Get parent category name from SQL DeviceType ID
 */
export function getParentCategoryName(deviceTypeId: number): string | null {
  const mapping = PARENT_CATEGORY_MAPPINGS.find(
    (m) => m.sqlId === deviceTypeId,
  );
  return mapping?.name || null;
}

/**
 * Generate a professional SEO description for a category
 * Based on Audiofast's professional writing style
 */
export function generateSEODescription(
  categoryName: string,
  parentCategoryName: string | null,
): string {
  // Category-specific descriptions with Audiofast's professional style
  const specificDescriptions: Record<string, string> = {
    "Przetworniki cyfrowo-analogowe":
      "Przetworniki DAC klasy high-end od renomowanych producentów. Odkryj najlepsze rozwiązania cyfrowo-analogowe w ofercie Audiofast.",
    "Odtwarzacze CD/SACD":
      "Odtwarzacze CD i SACD najwyższej klasy. Audiofast oferuje sprzęt audio premium dla wymagających audiofilów.",
    "Przedwzmacniacze liniowe":
      "Przedwzmacniacze liniowe klasy high-end. Precyzja i czystość sygnału dla najbardziej wymagających systemów audio.",
    "Wzmacniacze zintegrowane":
      "Wzmacniacze zintegrowane premium łączące funkcjonalność z audiofilską jakością dźwięku. Sprawdź ofertę Audiofast.",
    "Wzmacniacze mocy":
      "Wzmacniacze mocy klasy high-end dla systemów audio wymagających najwyższej jakości i dynamiki brzmienia.",
    "Przedwzmacniacze gramofonowe":
      "Przedwzmacniacze gramofonowe dla miłośników analogu. Odkryj pełnię brzmienia winyli z Audiofast.",
    "Głośniki podłogowe":
      "Głośniki podłogowe klasy high-end od najlepszych światowych producentów. Doświadcz prawdziwego brzmienia.",
    "Głośniki podstawkowe":
      "Kompaktowe głośniki podstawkowe o audiofilskiej jakości. Idealne rozwiązanie dla mniejszych pomieszczeń.",
    "Głośniki aktywne":
      "Głośniki aktywne z wbudowanymi wzmacniaczami. Kompletne rozwiązanie audio najwyższej klasy.",
    "Subwoofery domowe":
      "Subwoofery high-end dla pełnego, głębokiego basu. Uzupełnij swój system audio o najlepsze niskie tony.",
    Soundbary:
      "Soundbary premium dla kina domowego i systemów audio. Wyjątkowa jakość dźwięku w eleganckiej formie.",
    Gramofony:
      "Gramofony klasy high-end dla miłośników analogowego brzmienia. Odkryj magię winyli z Audiofast.",
    "Ramiona gramofonowe":
      "Precyzyjne ramiona gramofonowe dla najwyższej jakości odtwarzania płyt winylowych.",
    "Wkładki gramofonowe":
      "Wkładki gramofonowe od renomowanych producentów. Kluczowy element analogowego traktu audio.",
    "Zegary wzorcowe":
      "Referencyjne zegary wzorcowe dla synchronizacji cyfrowych urządzeń audio najwyższej klasy.",
    "Serwery muzyczne":
      "Serwery muzyczne high-end dla bezstratnego strumieniowania i przechowywania muzyki.",
    "Serwery muzyczne z wyjściem analogowym":
      "Serwery muzyczne z wbudowanymi przetwornikami DAC. Kompletne rozwiązanie do streamingu.",
    "Upsamplery i konwertery audio":
      "Upsamplery i konwertery audio dla ulepszonej jakości cyfrowego sygnału.",
    "Interkonekty analogowe":
      "Interkonekty analogowe klasy high-end. Przewody sygnałowe dla najczystszego przekazu audio.",
    "Interkonekty cyfrowe":
      "Interkonekty cyfrowe dla bezbłędnej transmisji sygnału. Przewody coaxial, AES/EBU i optyczne.",
    "Kable głośnikowe":
      "Kable głośnikowe premium dla optymalnego połączenia wzmacniacza z głośnikami.",
    "Kable zasilające":
      "Kable zasilające high-end eliminujące zakłócenia sieciowe. Fundament czystego zasilania.",
    "Kable USB":
      "Kable USB audio klasy high-end dla cyfrowych połączeń najwyższej jakości.",
    "Kable ethernet":
      "Kable ethernet dedykowane audio dla streamingu muzyki bez zakłóceń i jitteru.",
    "Przewody gramofonowe":
      "Przewody phono dla analogowych systemów gramofonowych. Czystość sygnału od igły do przedwzmacniacza.",
    "Kable zegarowe":
      "Kable zegarowe do synchronizacji cyfrowych urządzeń audio. Precyzja taktowania.",
    "Kable uziemiające":
      "Kable uziemiające dla redukcji szumów i zakłóceń w systemach audio.",
    "Kable do subwooferów":
      "Przewody do subwooferów dla pełnego, kontrolowanego basu bez zniekształceń.",
    "Kondycjonery zasilania":
      "Kondycjonery zasilania dla czystej energii elektrycznej. Ochrona i optymalizacja zasilania.",
    "Stacje uziemiające":
      "Stacje uziemiające dla profesjonalnych instalacji audio. Eliminacja pętli masy.",
    Zasilacze:
      "Zewnętrzne zasilacze liniowe dla urządzeń audio. Czyste, stabilne zasilanie.",
    Bezpieczniki:
      "Bezpieczniki audiofilskie dla ochrony i optymalizacji przepływu prądu.",
    Półki:
      "Półki i stojaki audio dla optymalnej organizacji sprzętu. Funkcjonalność i estetyka.",
    Stoliki:
      "Stoliki audio zapewniające izolację i stabilność dla sprzętu high-end.",
    "Podstawki i kolce":
      "Podstawki i kolce antywibracyjne dla izolacji sprzętu od zakłóceń mechanicznych.",
    "Akcesoria akustyczne":
      "Akcesoria akustyczne do optymalizacji pomieszczenia odsłuchowego. Panele, dyfuzory i absorbery dla najlepszego brzmienia.",
    "Akcesoria gramofonowe":
      "Akcesoria gramofonowe dla pielęgnacji płyt i sprzętu analogowego. Sprawdź ofertę Audiofast.",
    "Pozostałe akcesoria":
      "Akcesoria audio dla kompletnego systemu high-end. Dodatki i rozwiązania uzupełniające od najlepszych producentów.",
    "Wzmacniacze słuchawkowe":
      "Wzmacniacze słuchawkowe high-end dla najbardziej wymagających słuchaczy. Odkryj najlepsze rozwiązania w ofercie Audiofast.",
    Słuchawki:
      "Słuchawki audiofilskie najwyższej klasy dla prywatnych odsłuchów bez kompromisów. Sprawdź ofertę Audiofast.",
    "Głośniki instalacyjne":
      "Głośniki instalacyjne do zabudowy dla dyskretnych rozwiązań audio bez utraty jakości. Audiofast oferuje najlepsze produkty.",
    "Głośniki do kina domowego":
      "Zestawy głośników do kina domowego dla przestrzennego dźwięku najwyższej jakości. Sprawdź ofertę Audiofast.",
    "Switche i routery":
      "Switche i routery audio dla optymalnej infrastruktury sieciowej w systemach streamingowych wysokiej jakości.",
    "Kable głośnikowe":
      "Kable głośnikowe premium dla optymalnego połączenia wzmacniacza z głośnikami. Sprawdź ofertę Audiofast.",
    Stoliki:
      "Stoliki audio zapewniające izolację i stabilność dla sprzętu high-end. Odkryj najlepsze rozwiązania w Audiofast.",
    // New categories
    "Referencyjne zegary wzorcowe":
      "Referencyjne zegary wzorcowe dla synchronizacji cyfrowych urządzeń audio. Precyzja taktowania najwyższej klasy.",
    "Zegary wzorcowe":
      "Referencyjne zegary wzorcowe dla synchronizacji cyfrowych urządzeń audio. Precyzja taktowania najwyższej klasy.",
    "Upsamplery i konwertery audio":
      "Upsamplery i konwertery audio klasy high-end dla ulepszonej jakości cyfrowego sygnału. Sprawdź ofertę Audiofast.",
    "Serwery muzyczne":
      "Serwery muzyczne high-end dla bezstratnego strumieniowania i przechowywania muzyki. Najlepsza jakość streamingu.",
    "Serwery muzyczne z wyjściem analogowym":
      "Serwery muzyczne z wbudowanymi przetwornikami DAC. Kompletne rozwiązanie do streamingu najwyższej jakości.",
    "Kable uziemiające":
      "Kable uziemiające high-end dla redukcji szumów i zakłóceń w systemach audio. Czysta masa sygnałowa.",
    Zasilacze:
      "Zewnętrzne zasilacze liniowe klasy high-end dla urządzeń audio. Czyste i stabilne zasilanie bez zakłóceń.",
    "Stacje uziemiające":
      "Stacje uziemiające dla profesjonalnych instalacji audio. Eliminacja pętli masy i zakłóceń.",
    Bezpieczniki:
      "Bezpieczniki audiofilskie wysokiej jakości dla ochrony i optymalizacji przepływu prądu w systemach audio.",
    "Głośniki instalacyjne":
      "Głośniki instalacyjne do zabudowy klasy high-end. Dyskretne rozwiązania audio bez utraty jakości dźwięku.",
    "Głośniki podstawkowe":
      "Kompaktowe głośniki podstawkowe o audiofilskiej jakości. Idealne rozwiązanie dla mniejszych pomieszczeń odsłuchowych.",
    "Głośniki do kina domowego":
      "Zestawy głośników do kina domowego klasy high-end. Przestrzenny dźwięk najwyższej jakości dla filmów.",
    "Soundbary - głośniki do TV i kina domowego":
      "Soundbary premium klasy high-end dla kina domowego. Wyjątkowa jakość dźwięku w eleganckiej formie.",
    "Głośniki aktywne":
      "Głośniki aktywne z wbudowanymi wzmacniaczami klasy high-end. Kompletne rozwiązanie audio najwyższej jakości.",
    "Kable USB - przewody USB do sprzętu audio":
      "Kable USB audio klasy high-end dla cyfrowych połączeń najwyższej jakości. Bezbłędna transmisja danych.",
    "Kable ethernet do sprzętu audio":
      "Kable ethernet dedykowane audio dla streamingu muzyki bez zakłóceń i jitteru. Optymalna sieć audio.",
    "Przewody gramofonowe":
      "Przewody phono dla analogowych systemów gramofonowych. Czystość sygnału od igły do przedwzmacniacza.",
    "Kable do subwooferów":
      "Przewody do subwooferów high-end dla pełnego i kontrolowanego basu bez zniekształceń w systemach audio.",
    "Kable zegarowe":
      "Kable zegarowe do synchronizacji cyfrowych urządzeń audio klasy high-end. Precyzja taktowania bez jitteru.",
  };

  // Check for specific description first
  if (specificDescriptions[categoryName]) {
    return specificDescriptions[categoryName];
  }

  // Generate a generic but professional description
  const parentContext = parentCategoryName
    ? ` z kategorii ${parentCategoryName}`
    : "";

  return `${categoryName}${parentContext} klasy high-end w ofercie Audiofast. Sprawdź najlepsze produkty dla wymagających audiofilów.`;
}

/**
 * Validate a transformed subcategory document
 */
export function validateSubCategory(
  subCategory: SubCategory,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!subCategory.name || subCategory.name.trim() === "") {
    errors.push({
      field: "name",
      message: "Name is required",
      value: subCategory.name,
    });
  }

  if (!subCategory.slug?.current || subCategory.slug.current.trim() === "") {
    errors.push({
      field: "slug",
      message: "Slug is required",
      value: subCategory.slug?.current,
    });
  }

  if (!subCategory.parentCategory?._ref) {
    errors.push({
      field: "parentCategory",
      message: "Parent category reference is required",
      value: subCategory.parentCategory,
    });
  }

  if (!subCategory.seo?.title) {
    errors.push({
      field: "seo.title",
      message: "SEO title is required",
      value: subCategory.seo?.title,
    });
  }

  if (!subCategory.seo?.description) {
    errors.push({
      field: "seo.description",
      message: "SEO description is required",
      value: subCategory.seo?.description,
    });
  }

  // Check SEO description length (110-160 chars recommended)
  if (subCategory.seo?.description && subCategory.seo.description.length < 80) {
    errors.push({
      field: "seo.description",
      message: `SEO description too short (${subCategory.seo.description.length} chars, min 80)`,
      value: subCategory.seo.description,
    });
  }

  return errors;
}

/**
 * Transform a ProductType record to a Sanity SubCategory document
 */
export function transformProductTypeToSubCategory(
  record: ProductTypeRecord,
  parentDeviceTypeId: number | undefined,
  warnings: string[],
): SubCategory | null {
  // Get parent category Sanity ID
  if (!parentDeviceTypeId) {
    warnings.push(
      `ProductType ID ${record.id} (${record.title}): No parent category mapping found`,
    );
    return null;
  }

  const parentSanityId = getParentCategorySanityId(parentDeviceTypeId);
  if (!parentSanityId) {
    warnings.push(
      `ProductType ID ${record.id} (${record.title}): Invalid parent DeviceType ID ${parentDeviceTypeId}`,
    );
    return null;
  }

  const parentName = getParentCategoryName(parentDeviceTypeId);

  // Generate slug from URL segment or name (with trailing slash)
  const slug = record.urlSegment || slugify(record.title);

  // Generate SEO description
  const seoDescription = generateSEODescription(record.title, parentName);

  const subCategory: SubCategory = {
    _type: "productCategorySub",
    _id: generateSanityId(record.id),
    name: record.title,
    slug: {
      _type: "slug",
      current: `/kategoria/${slug}/`,
    },
    parentCategory: {
      _type: "reference",
      _ref: parentSanityId,
    },
    seo: {
      title: record.title,
      description: seoDescription,
    },
    doNotIndex: false,
    hideFromList: false,
  };

  return subCategory;
}
