import { ComposeSparklesIcon,RefreshIcon } from '@sanity/icons';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Grid,
  Heading,
  Label,
  Stack,
  Text,
  TextInput,
  ToastProvider,
  useToast,
} from '@sanity/ui';
import { useState } from 'react';
import { useClient } from 'sanity';

// Types matching our content structure
type ContentItem = {
  _id: string;
  _type: 'blog-article' | 'review' | 'product';
  title?: string; // articles/reviews
  name?: string; // products/reviews/articles
  description?: string; // portable text blocks usually
  shortDescription?: string; // products
  image?: string;
  imageSource?: 'preview' | 'gallery' | 'default';
  slug: string;
  destinationType?: 'page' | 'pdf' | 'external' | null; // review types
  openInNewTab?: boolean; // for external/pdf reviews
  _createdAt: string;
};

type GroupedContent = {
  articles: ContentItem[];
  reviews: ContentItem[];
  products: ContentItem[];
};

const NEWSLETTER_API_URL =
  process.env.SANITY_STUDIO_NEWSLETTER_API_URL ||
  'http://localhost:3000/api/newsletter/generate/';

export default function NewsletterTool() {
  const client = useClient({ apiVersion: '2024-01-01' });
  const toast = useToast();

  // State
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState<GroupedContent>({
    articles: [],
    reviews: [],
    products: [],
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 1. Fetch Content
  const fetchContent = async () => {
    setIsLoading(true);
    try {
      const query = `*[_type in ["blog-article", "review", "product"] && !(_id in path("drafts.**")) && _createdAt >= $startDate && _createdAt <= $endDate + "T23:59:59Z"] | order(_createdAt desc) {
        _id,
        _type,
        "title": pt::text(title),
        name,
        "description": pt::text(description),
        "shortDescription": pt::text(shortDescription),
        "image": select(
          _type == "product" && defined(previewImage) => previewImage.asset->url,
          _type == "product" => imageGallery[0].asset->url,
          image.asset->url
        ),
        "imageSource": select(
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
        _createdAt
      }`;

      const result = await client.fetch<ContentItem[]>(query, {
        startDate,
        endDate,
      });

      const grouped = {
        articles: result.filter((item) => item._type === 'blog-article'),
        reviews: result.filter((item) => item._type === 'review'),
        products: result.filter((item) => item._type === 'product'),
      };

      setContent(grouped);
      // Select all by default
      setSelectedIds(new Set(result.map((item) => item._id)));

      toast.push({
        status: 'success',
        title: `Znaleziono ${result.length} elementów`,
      });
    } catch (err) {
      console.error(err);
      toast.push({
        status: 'error',
        title: 'Błąd pobierania treści',
        description: err instanceof Error ? err.message : 'Nieznany błąd',
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

  // 3. Generate Newsletter
  const handleAction = async (
    action: 'download-html' | 'create-mailchimp-draft'
  ) => {
    setIsGenerating(true);

    // Filter content based on selection
    const payloadContent = {
      articles: content.articles.filter((i) => selectedIds.has(i._id)),
      reviews: content.reviews.filter((i) => selectedIds.has(i._id)),
      products: content.products.filter((i) => selectedIds.has(i._id)),
    };

    if (
      payloadContent.articles.length === 0 &&
      payloadContent.reviews.length === 0 &&
      payloadContent.products.length === 0
    ) {
      toast.push({
        status: 'warning',
        title: 'Brak wybranych elementów',
        description: 'Zaznacz co najmniej jeden element.',
      });
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch(NEWSLETTER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          startDate,
          endDate,
          content: payloadContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Błąd serwera');
      }

      if (action === 'download-html') {
        // Handle file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `newsletter-audiofast-${startDate}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.push({ status: 'success', title: 'Pobrano plik HTML' });
      } else {
        // Handle Mailchimp success
        const data = await response.json();
        toast.push({
          status: 'success',
          title: 'Utworzono draft w Mailchimp',
          description: `ID Kampanii: ${data.campaignId}`,
        });
      }
    } catch (err) {
      console.error(err);
      toast.push({
        status: 'error',
        title: 'Błąd generowania',
        description: err instanceof Error ? err.message : 'Nieznany błąd',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const hasItems =
    content.articles.length > 0 ||
    content.reviews.length > 0 ||
    content.products.length > 0;

  return (
    <ToastProvider>
      <Card height="fill" padding={4} overflow="auto">
        <Flex
          direction="column"
          gap={5}
          style={{ maxWidth: '800px', margin: '0 auto' }}
        >
          {/* Header */}
          <Box>
            <Heading as="h1" size={4}>
              Generator Newslettera
            </Heading>
            <Text muted size={1} style={{ marginTop: '0.5rem' }}>
              Wybierz zakres dat, pobierz treści, dostosuj wybór i wygeneruj
              newsletter.
            </Text>
          </Box>

          {/* Controls */}
          <Card padding={4} tone="primary" radius={2} shadow={1}>
            <Grid columns={[1, 2, 3]} gap={3} style={{ alignItems: 'end' }}>
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
                text={isLoading ? 'Pobieranie...' : 'Pobierz treści'}
                onClick={fetchContent}
                disabled={isLoading}
                tone="primary"
              />
            </Grid>
          </Card>

          {/* Content List */}
          {hasItems ? (
            <Stack space={5}>
              {/* Articles */}
              {content.articles.length > 0 && (
                <ContentGroup
                  title="Artykuły Blogowe"
                  items={content.articles}
                  selectedIds={selectedIds}
                  onToggle={toggleItem}
                />
              )}

              {/* Reviews */}
              {content.reviews.length > 0 && (
                <ContentGroup
                  title="Recenzje"
                  items={content.reviews}
                  selectedIds={selectedIds}
                  onToggle={toggleItem}
                />
              )}

              {/* Products */}
              {content.products.length > 0 && (
                <ContentGroup
                  title="Produkty"
                  items={content.products}
                  selectedIds={selectedIds}
                  onToggle={toggleItem}
                />
              )}

              {/* Actions */}
              <Card
                padding={4}
                radius={2}
                border
                style={{ position: 'sticky', bottom: 0, background: 'white' }}
              >
                <Flex gap={3} justify="flex-end">
                  <Button
                    mode="ghost"
                    text="Pobierz HTML (Magazyn AUDIO)"
                    onClick={() => handleAction('download-html')}
                    disabled={isGenerating}
                  />
                  <Button
                    icon={selectedIds.size > 0 ? ComposeSparklesIcon : undefined}
                    tone="primary"
                    text="Wyślij do Mailchimp"
                    onClick={() => handleAction('create-mailchimp-draft')}
                    disabled={isGenerating}
                  />
                </Flex>
              </Card>
            </Stack>
          ) : (
            <Card padding={5} radius={2} border style={{ textAlign: 'center' }}>
              <Text muted>
                Brak treści. Wybierz zakres dat i kliknij &quot;Pobierz
                treści&quot;.
              </Text>
            </Card>
          )}
        </Flex>
      </Card>
    </ToastProvider>
  );
}

// Helper Component for List Groups
function ContentGroup({
  title,
  items,
  selectedIds,
  onToggle,
}: {
  title: string;
  items: ContentItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <Stack space={3}>
      <Heading size={1}>{title}</Heading>
      <Card border radius={2}>
        {items.map((item, index) => (
          <Flex
            key={item._id}
            align="center"
            padding={3}
            style={{ borderBottom: index < items.length - 1 ? '1px solid #e6e8eb' : 'none' }}
            gap={3}
          >
            <Checkbox
              checked={selectedIds.has(item._id)}
              onChange={() => onToggle(item._id)}
            />
            <Box flex={1}>
              <Text weight="semibold" size={1} style={{ marginBottom: '0.75rem' }}>
                {item.title || item.name}
              </Text>
              <Text size={1} muted textOverflow="ellipsis">
                {new Date(item._createdAt).toLocaleDateString('pl-PL')} •{' '}
                {item.shortDescription ||
                  item.description?.substring(0, 60) ||
                  'Brak opisu'}
                ...
              </Text>
            </Box>
            {item.image && (
              <img
                src={item.image}
                alt=""
                style={{
                  width: 40,
                  height: 40,
                  objectFit: item.imageSource === 'preview' ? 'contain' : 'cover',
                  borderRadius: 4,
                }}
              />
            )}
          </Flex>
        ))}
      </Card>
    </Stack>
  );
}
