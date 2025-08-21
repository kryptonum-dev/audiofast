import { CopyIcon, SyncIcon, WarningOutlineIcon } from '@sanity/icons';
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import type { FocusEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import {
  type ObjectFieldProps,
  type SanityDocument,
  set,
  type SlugValue,
  unset,
  useFormValue,
  useValidationStatus,
} from 'sanity';
import { styled } from 'styled-components';

import { getPresentationUrl } from '../utils/helper';
import { slugify } from '../utils/slugify';
import { WEB_BASE_URL } from '../utils/constant';

const GenerateButton = styled(Button)`
  cursor: pointer;
  > span:nth-of-type(2) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
`;

const CopyButton = styled(Button)`
  margin-left: auto;
  cursor: pointer;
  > span:nth-of-type(2) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
`;

interface PathnameFieldComponentProps extends ObjectFieldProps<SlugValue> {
  prefix?: string;
}

export function PathnameFieldComponent(props: PathnameFieldComponentProps) {
  const document = useFormValue([]) as SanityDocument;
  const validation = useValidationStatus(
    document?._id.replace(/^drafts\./, ''),
    document?._type
  );
  const nameField = useFormValue(['name']) as string;

  const slugValidationError = useMemo(
    () =>
      validation.validation.find(
        (v) =>
          (v?.path.includes('current') || v?.path.includes('slug')) && v.message
      ),
    [validation.validation]
  );
  const {
    inputProps: { onChange, value, readOnly },
    title,
    description,
    prefix,
  } = props;

  // Extract prefix and main content for display
  const { prefixPart, mainContent } = useMemo(() => {
    if (!value?.current) return { prefixPart: '', mainContent: '' };

    // Handle root path specially
    if (value.current === '/') {
      return {
        prefixPart: '',
        mainContent: '',
      };
    }

    if (prefix && value.current.startsWith(prefix)) {
      // Remove the expected prefix and trailing slash to get the main content
      const contentWithoutPrefix = value.current
        .replace(prefix, '')
        .replace(/\/$/, '');
      return {
        prefixPart: prefix.replace(/\/$/, ''), // Remove trailing slash from prefix for display
        mainContent: contentWithoutPrefix,
      };
    }

    // If no defined prefix, treat the whole path as main content (without leading/trailing slashes)
    return {
      prefixPart: '',
      mainContent: value.current.replace(/^\/+|\/+$/g, ''), // Remove leading and trailing slashes
    };
  }, [value, prefix]);

  const fullPathInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (value?: string) => {
      if (!value) {
        onChange(unset());
        return;
      }

      let finalValue: string;

      // If user is typing a full path (starts with /), use it as-is but ensure trailing slash
      if (value.startsWith('/')) {
        finalValue = value === '/' ? value : `${value.replace(/\/+$/, '')}/`;
      } else {
        // If user is typing just the content part, add prefix and trailing slash
        const cleanValue = value.trim();
        if (prefix && cleanValue) {
          finalValue = `${prefix}${cleanValue}/`;
        } else if (cleanValue) {
          finalValue = `/${cleanValue}/`;
        } else {
          finalValue = prefix || '/';
        }
      }

      onChange(
        set({
          current: finalValue,
          _type: 'slug',
        })
      );
    },
    [onChange, prefix]
  );

  const handleBlur = useCallback((e: FocusEvent<HTMLInputElement>) => {
    // No longer need to set folder lock state
  }, []);

  const localizedPathname = `${WEB_BASE_URL}${value?.current || '/'}`;

  // Function to generate slug from name field
  const generateSlug = useCallback(() => {
    if (!nameField) return;

    // Generate the slugified version of the name (this will be the main content)
    const slugified = slugify(nameField);

    // Use handleChange to properly construct the full path with prefix and trailing slash
    handleChange(slugified);
  }, [nameField, handleChange]);

  // Input validation for real-time feedback
  const inputValidation = useMemo(() => {
    if (!mainContent) return null;

    const errors = [];

    // Check for invalid characters at the beginning
    if (mainContent.startsWith('/')) {
      errors.push('Nie można zaczynać od "/"');
    }

    // Check for invalid characters at the end
    if (mainContent.endsWith('-')) {
      errors.push('Nie może kończyć się "-"');
    }

    // Check for invalid characters in general
    const invalidChars = mainContent.match(/[^a-z0-9-]/gi);
    if (invalidChars) {
      const uniqueChars = [...new Set(invalidChars)].join(', ');
      errors.push(`Nieprawidłowe znaki: ${uniqueChars}`);
    }

    // Check for multiple consecutive hyphens
    if (mainContent.includes('--')) {
      errors.push('Wiele następujących po sobie myślników nie jest dozwolone');
    }

    return errors.length > 0 ? errors : null;
  }, [mainContent]);

  // Handle input change with validation
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.currentTarget.value;

      // Clean the input as user types
      let cleanedValue = inputValue;

      // Remove leading slashes as user types
      cleanedValue = cleanedValue.replace(/^\/+/, '');

      // Remove invalid characters (keep only a-z, 0-9, and single hyphens)
      cleanedValue = cleanedValue.replace(/[^a-z0-9-]/gi, '');

      // Replace multiple consecutive hyphens with single hyphen
      cleanedValue = cleanedValue.replace(/-+/g, '-');

      // Remove trailing hyphens (but allow typing them temporarily)
      // This creates a balance - user can type but sees immediate feedback
      const hasTrailingHyphen = cleanedValue.endsWith('-');
      if (hasTrailingHyphen && cleanedValue.length > 1) {
        // Allow one trailing hyphen for typing, but show warning
        cleanedValue = cleanedValue.replace(/-+$/, '-');
      }

      // Update the input field to reflect the cleaned value
      if (e.currentTarget.value !== cleanedValue) {
        e.currentTarget.value = cleanedValue;
      }

      handleChange(cleanedValue);
    },
    [handleChange]
  );

  const pathInput = useMemo(() => {
    // Determine if we should show the generate button
    const showGenerateButton = Boolean(nameField) && !readOnly;

    // Handle special fixed paths
    if (value?.current === '/') {
      return (
        <Stack space={2}>
          <Flex gap={1} align="center">
            {/* Root path display */}
            <Card
              paddingX={2}
              paddingY={2}
              border
              radius={1}
              tone="transparent"
              style={{
                backgroundColor: 'var(--card-muted-bg-color)',
              }}>
              <Text muted size={2}>
                /
              </Text>
            </Card>
            <Text muted size={2}>
              (Strona główna)
            </Text>
          </Flex>
        </Stack>
      );
    }

    // Handle other fixed paths (like /blog, /404, etc.) that don't end with /
    if (value?.current && !value.current.endsWith('/') && readOnly) {
      return (
        <Stack space={2}>
          <Flex gap={1} align="center">
            {/* Fixed path display */}
            <Card
              paddingX={2}
              paddingY={2}
              border
              radius={1}
              tone="transparent"
              style={{
                backgroundColor: 'var(--card-muted-bg-color)',
              }}>
              <Text muted size={2}>
                {value.current}
              </Text>
            </Card>
            <Text muted size={2}>
              (Ścieżka stała)
            </Text>
          </Flex>
        </Stack>
      );
    }

    return (
      <Stack space={2}>
        <Flex gap={1} align="center">
          {/* Leading slash indicator for non-prefix paths */}
          {!prefixPart && (
            <Card
              paddingX={2}
              paddingY={2}
              border
              radius={1}
              tone="transparent"
              style={{
                backgroundColor: 'var(--card-muted-bg-color)',
              }}>
              <Text muted size={2}>
                /
              </Text>
            </Card>
          )}
          {/* Prefix indicator */}
          {prefixPart && (
            <>
              <Card
                paddingX={2}
                paddingY={2}
                border
                radius={1}
                tone="transparent"
                style={{
                  backgroundColor: 'var(--card-muted-bg-color)',
                }}>
                <Text muted size={2}>
                  {prefixPart}
                </Text>
              </Card>
              <Text muted size={2}>
                /
              </Text>
            </>
          )}

          {/* Main content input */}
          <Box flex={1}>
            <TextInput
              value={mainContent}
              onChange={handleInputChange}
              ref={fullPathInputRef}
              onBlur={handleBlur}
              disabled={readOnly}
              placeholder={
                prefixPart ? 'Wprowadź nazwę' : 'Wprowadź nazwę strony'
              }
              style={{ width: '100%' }}
            />
          </Box>

          {/* Trailing slash indicator (only show for non-root paths) */}
          {value?.current !== '/' && (
            <Card
              paddingX={2}
              paddingY={2}
              border
              radius={1}
              tone="transparent"
              style={{
                backgroundColor: 'var(--card-muted-bg-color)',
              }}>
              <Text muted size={2}>
                /
              </Text>
            </Card>
          )}

          {/* Generate button */}
          {showGenerateButton && (
            <GenerateButton
              icon={SyncIcon}
              onClick={generateSlug}
              title="Wygeneruj slug z nazwy"
              mode="bleed"
              tone="primary"
              padding={2}
              fontSize={1}>
              <span />
            </GenerateButton>
          )}
        </Flex>
      </Stack>
    );
  }, [
    value,
    prefixPart,
    mainContent,
    handleInputChange,
    handleBlur,
    readOnly,
    generateSlug,
    nameField,
  ]);

  return (
    <Stack space={3}>
      <Stack space={2} flex={1}>
        <Text size={1} weight="semibold">
          {title}
        </Text>
        {description && (
          <Text
            size={1}
            style={{ color: 'var(--card-fg-color)', marginTop: '8px' }}>
            {description}
          </Text>
        )}
      </Stack>

      {typeof value?.current === 'string' && (
        <Flex direction="column" gap={2}>
          <Flex align="center">
            <p
              style={{
                textOverflow: 'ellipsis',
                margin: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                color: 'var(--card-muted-fg-color)',
                fontSize: '0.8125rem',
              }}>
              {localizedPathname}
            </p>
            <CopyButton
              icon={CopyIcon}
              onClick={() => navigator.clipboard.writeText(localizedPathname)}
              title="Kopiuj link"
              mode="bleed"
              tone="primary"
              fontSize={1}>
              <span />
            </CopyButton>
          </Flex>
        </Flex>
      )}

      {pathInput}

      {/* Input validation warnings */}
      {inputValidation && (
        <Stack space={2}>
          {inputValidation.map((error, index) => (
            <Badge
              key={index}
              tone="critical"
              padding={4}
              style={{
                borderRadius: 'var(--card-radius)',
              }}>
              <Flex gap={4} align="center">
                <WarningOutlineIcon />
                <Text size={1} color="red">
                  {error}
                </Text>
              </Flex>
            </Badge>
          ))}
        </Stack>
      )}

      {slugValidationError ? (
        <Badge
          tone="critical"
          padding={4}
          style={{
            borderRadius: 'var(--card-radius)',
          }}>
          <Flex gap={4} align="center">
            <WarningOutlineIcon />
            <Text size={1} color="red">
              {slugValidationError.message}
            </Text>
          </Flex>
        </Badge>
      ) : null}
    </Stack>
  );
}
