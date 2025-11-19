# Newsletter Generation Implementation Plan

## 1. Overview

This document outlines the strategy for implementing a newsletter generation feature for Audiofast. The goal is to allow editors to generate a "Content Digest" newsletter based on content (Blog Articles, Reviews, Products) published within a specific date range.

### Key Requirements
- **Dual Output**:
  1.  **HTML File**: For "Magazyn AUDIO" (with specific reviews excluded manually).
  2.  **Mailchimp Draft**: A draft campaign created directly in the existing Mailchimp account.
- **Content Selection**: Editors must be able to opt-out specific items (specifically for the "Magazyn AUDIO" requirement) without modifying the database schema.
- **Technology**: Sanity Studio for the UI, React Email for HTML generation, and Next.js API for backend processing.

## 2. Architecture

The solution involves a Custom Tool in Sanity Studio that communicates with a Next.js API Route.

```mermaid
graph TD
    A[Sanity Studio (Newsletter Tool)] -->|Select Date Range| B(Fetch Content via GROQ)
    B -->|Display Content List| C[Editor Selection UI]
    C -->|Filter Items| D{Action}
    D -->|Download HTML| E[Next.js API /generate]
    D -->|Send to Mailchimp| E
    E -->|Render Template| F[React Email]
    F -->|Return HTML| G[Browser Download]
    F -->|Create Campaign| H[Mailchimp API]
```

## 3. Tech Stack & Dependencies

- **Frontend (Studio)**: React, Sanity UI, Sanity Connect (for API calls).
- **Backend (Next.js)**: Next.js App Router API Routes.
- **Email Rendering**: `@react-email/components`, `@react-email/render`.
- **Integrations**: `mailchimp-marketing` (existing), Sanity Client.

## 4. Implementation Steps

### Phase 1: Dependencies & Setup

1.  **Install React Email packages** in `apps/web`:
    ```bash
    cd apps/web
    bun add @react-email/components @react-email/render
    ```

### Phase 2: Email Template (Web)

Create a reusable React component that defines the newsletter structure.

-   **Location**: `apps/web/src/emails/newsletter-template.tsx`
-   **Components**:
    -   `Header`: Logo and Title.
    -   `Intro`: Optional text.
    -   `Section`: Repeated block for Articles, Reviews, and Products.
    -   `Footer`: Contact details and unsubscribe links.
-   **Styling**: Use inline styles supported by email clients (handled by React Email).

### Phase 3: Backend API (Web)

Create a secure API route to handle the generation logic. This keeps secrets (Mailchimp API keys) server-side.

-   **Location**: `apps/web/src/app/api/newsletter/generate/route.ts`
-   **Method**: `POST`
-   **Payload**:
    ```typescript
    interface Payload {
      action: 'download-html' | 'create-mailchimp-draft';
      startDate: string;
      endDate: string;
      content: {
        articles: Article[];
        reviews: Review[];
        products: Product[];
      };
    }
    ```
-   **Logic**:
    1.  Receive validated content list from Studio.
    2.  Render HTML using `render(<NewsletterTemplate content={content} />)`.
    3.  **If Download**: Return `new Response(html, { headers: { 'Content-Type': 'text/html', 'Content-Disposition': 'attachment...' } })`.
    4.  **If Mailchimp**:
        -   Use `mailchimpClient` (from `apps/web/src/global/mailchimp/client.ts`).
        -   Create a campaign (`campaigns.create`).
        -   Set campaign content (`campaigns.setContent`).
        -   Return success message.

### Phase 4: Sanity Studio Tool

Create a custom tool accessible via the Studio navigation bar.

1.  **Tool Definition**:
    -   **Location**: `apps/studio/tools/newsletter/index.ts`
    -   **Config**: Register the tool in `sanity.config.ts`.

2.  **Tool Interface (`NewsletterTool.tsx`)**:
    -   **State Management**: `startDate`, `endDate`, `selectedItems` (Set of IDs), `isLoading`.
    -   **UI Components**:
        -   `Card`: Container for the tool.
        -   `Flex/Grid`: Layouts.
        -   `TextInput` (type="date"): Date pickers.
        -   `Button`: "Fetch Content", "Generate HTML", "Create Draft".
        -   `Stack`: List of fetched items.

3.  **Interaction Flow**:
    -   **Step 1**: User selects dates and clicks "Find Content".
    -   **Step 2**: Tool executes a GROQ query to find documents in range.
        ```groq
        *[_type in ["blog-article", "review", "product"] && publishedAt >= $start && publishedAt <= $end] {
          _id, _type, title, name, description, shortDescription,
          "image": image.asset->url,
          "slug": slug.current
        }
        ```
    -   **Step 3**: Tool displays items in groups (Articles, Reviews, Products) with Checkboxes. All checked by default.
    -   **Step 4**: Editor unchecks specific reviews (e.g., "Not for Audio Magazine").
    -   **Step 5**: Editor clicks action button. Tool sends *only checked items* to the Next.js API.

### Phase 5: Refinement & Security

-   **CORS**: Ensure Studio can talk to the Web API (same domain in production, or configured CORS for localhost).
-   **Validation**: Ensure at least one item is selected before generation.
-   **Error Handling**: Handle Mailchimp API errors or empty content results gracefully.

## 5. Schema Considerations

-   **No Schema Changes**: We purposefully avoid adding "Exclude from Audio" boolean to the schema to keep the data model clean and logic flexible. The exclusion happens at the *generation time* via the Studio UI selection.

## 6. Testing Strategy

1.  **Template Test**: Create a temporary page in Next.js to preview the React Email component in the browser.
2.  **End-to-End**: Run Studio locally, select content, generate HTML, and verify the downloaded file opens correctly in a browser/email client.
3.  **Mailchimp**: Verify a draft appears in the Mailchimp dashboard.

