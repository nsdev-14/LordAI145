export type AttachmentKind = "file" | "image" | "pdf" | "audio" | "video";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  file: File;
  previewUrl?: string;
}

export type ToolId =
  | "create-image"
  | "canvas"
  | "web-search"
  | "deep-research"
  | "code-mode"
  | "study-mode"
  | "flashcards"
  | "summarize"
  | "translate";

export interface ChatSubmitPayload {
  text: string;
  attachments: Attachment[];
  tool: ToolId | null;
}
