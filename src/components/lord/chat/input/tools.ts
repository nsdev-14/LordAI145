import {
  Image as ImageIcon,
  PenTool,
  Globe,
  Microscope,
  Code2,
  GraduationCap,
  Layers,
  FileText,
  Languages,
  type LucideIcon,
} from "lucide-react";
import type { ToolId } from "./types";

export interface ToolDef {
  id: ToolId;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const TOOLS: ToolDef[] = [
  {
    id: "create-image",
    label: "Create Image",
    description: "Generate visuals from a prompt",
    icon: ImageIcon,
  },
  {
    id: "canvas",
    label: "Canvas",
    description: "Open the drawing canvas",
    icon: PenTool,
  },
  {
    id: "web-search",
    label: "Web Search",
    description: "Search the live web",
    icon: Globe,
  },
  {
    id: "deep-research",
    label: "Deep Research",
    description: "In-depth research reports",
    icon: Microscope,
  },
  {
    id: "code-mode",
    label: "Code Mode",
    description: "Write and run code",
    icon: Code2,
  },
  {
    id: "study-mode",
    label: "Study Mode",
    description: "Learn with structured lessons",
    icon: GraduationCap,
  },
  {
    id: "flashcards",
    label: "Flashcards",
    description: "Generate study flashcards",
    icon: Layers,
  },
  {
    id: "summarize",
    label: "Summarize Document",
    description: "Condense long documents",
    icon: FileText,
  },
  {
    id: "translate",
    label: "Translate",
    description: "Translate between languages",
    icon: Languages,
  },
];

export function getToolDef(id: ToolId): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}
