import { EyeClosedIcon } from "@sanity/icons";
import { type DocumentActionComponent,useDocumentOperation } from "sanity";

/**
 * Custom unpublish action for orderable document types.
 * The @sanity/orderable-document-list plugin removes the default unpublish action,
 * so we need to add it back explicitly for document types that should support unpublishing.
 */
export const UnpublishAction: DocumentActionComponent = (props) => {
  const { unpublish } = useDocumentOperation(props.id, props.type);

  // Only show if the document is published
  if (!props.published) {
    return null;
  }

  return {
    label: "Unpublish",
    icon: EyeClosedIcon,
    tone: "caution",
    onHandle: () => {
      unpublish.execute();
      props.onComplete();
    },
  };
};
