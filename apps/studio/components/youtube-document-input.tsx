import { Button, Card, Stack, Text } from '@sanity/ui';
import { parseYouTubeUrl } from '@workspace/youtube';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ObjectInputProps,
  PatchEvent,
  set,
  useClient,
  useWorkspace,
} from 'sanity';

import { getStudioAuthToken, resolveStudioApiUrl } from '../utils/studio-api';

export function YouTubeDocumentInput(props: ObjectInputProps) {
  const client = useClient({ apiVersion: '2025-02-10' });
  const workspace = useWorkspace();
  const latest = useRef(props);
  latest.current = props;
  const request = useRef<AbortController | null>(null);
  const attempted = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    'Wklej link — tytuł i miniatura zostaną uzupełnione. Możesz je potem zmienić.',
  );
  const videoId = parseYouTubeUrl(String(props.value?.videoUrl ?? ''))?.id;
  const metadataVideoId = props.value?.metadataVideoId;

  const loadMetadata = useCallback(async () => {
    const currentVideo = parseYouTubeUrl(
      String(latest.current.value?.videoUrl ?? ''),
    );
    if (!currentVideo || latest.current.readOnly) return;
    attempted.current = currentVideo.id;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const token = getStudioAuthToken(workspace);
      if (!token)
        throw new Error(
          'Zaloguj się ponownie do Sanity, aby pobrać dane filmu.',
        );
      const response = await fetch(
        resolveStudioApiUrl('/api/youtube/metadata/'),
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: currentVideo.url }),
        },
      );
      if (!response.ok)
        throw new Error(
          'Nie udało się pobrać danych. Sprawdź, czy lokalna strona działa na porcie 3000. Możesz też wpisać tytuł i dodać obraz ręcznie.',
        );
      const data = await response.json();
      const isCurrent = () =>
        !controller.signal.aborted &&
        parseYouTubeUrl(String(latest.current.value?.videoUrl ?? ''))?.id ===
          currentVideo.id;
      if (!isCurrent()) return;
      let assetId: string | undefined;
      const beforeUpload = latest.current.value;
      const canReplaceImage =
        !beforeUpload?.image?.asset?._ref ||
        beforeUpload.image.asset._ref === beforeUpload.importedImageRef;
      if (data.thumbnail && canReplaceImage) {
        const bytes = Uint8Array.from(atob(data.thumbnail.base64), (char) =>
          char.charCodeAt(0),
        );
        const asset = await client.assets.upload(
          'image',
          new Blob([bytes], { type: data.thumbnail.contentType }),
          {
            filename: `youtube-${currentVideo.id}.jpg`,
          },
        );
        assetId = asset._id;
      }
      if (!isCurrent()) return;
      const value = latest.current.value;
      const patches = [set(currentVideo.id, ['metadataVideoId'])];
      if (data.title && (!value?.name || value.name === value.importedTitle)) {
        patches.push(
          set(data.title, ['name']),
          set(data.title, ['importedTitle']),
        );
      }
      if (
        assetId &&
        (!value?.image?.asset?._ref ||
          value.image.asset._ref === value.importedImageRef)
      ) {
        patches.push(
          set(
            {
              _type: 'image',
              asset: { _type: 'reference', _ref: assetId },
              alt: data.title || value?.name || 'Miniatura filmu YouTube',
            },
            ['image'],
          ),
          set(assetId, ['importedImageRef']),
        );
      }
      latest.current.onChange(PatchEvent.from(patches));
      setMessage(
        data.title && data.thumbnail
          ? 'Dane pobrane. Własny tytuł i ręcznie zmieniona miniatura pozostają zachowane.'
          : 'Nie wszystkie dane są dostępne. Uzupełnij brakujący tytuł lub miniaturę ręcznie albo ponów pobieranie.',
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Nie udało się pobrać danych.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [client, workspace]);

  useEffect(() => {
    request.current?.abort();
    setBusy(false);
    if (
      !videoId ||
      props.readOnly ||
      metadataVideoId === videoId ||
      attempted.current === videoId
    )
      return;
    const timer = setTimeout(() => void loadMetadata(), 700);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [videoId, metadataVideoId, props.readOnly, loadMetadata]);

  return (
    <Stack space={4}>
      <Card padding={3} border radius={2}>
        <Stack space={3}>
          <Text size={1} aria-live="polite">
            {message}
          </Text>
          <Button
            text={busy ? 'Pobieranie danych…' : 'Pobierz ponownie dane filmu'}
            onClick={() => void loadMetadata()}
            disabled={!videoId || busy || props.readOnly}
            mode="ghost"
          />
        </Stack>
      </Card>
      {props.renderDefault(props)}
    </Stack>
  );
}
