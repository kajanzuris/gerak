import React from "react";
import { VectorStory } from "./VectorStory";
import type { StoryProps } from "./VectorStory";
import { Explainer } from "./Explainer";

// Satu komposisi "Cerita": pilih tema berdasarkan "style" di scenes.src.json.
export const Story: React.FC<StoryProps> = (p) =>
  p.data?.style === "explainer" ? <Explainer {...p} /> : <VectorStory {...p} />;
