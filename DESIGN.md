---
name: CodeOmniVis
description: A restrained architecture workbench for exploring full-stack repositories.
colors:
  canvas: "#090B0F"
  surface: "#0D1016"
  surface-raised: "#12161E"
  surface-hover: "#181E28"
  border: "#242B36"
  border-strong: "#343E4D"
  text: "#E7EAF0"
  text-secondary: "#A9B1BE"
  text-muted: "#7F8998"
  accent: "#5B8CFF"
  accent-hover: "#78A1FF"
  success: "#47B881"
  warning: "#D6A84B"
  danger: "#E06C75"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-quiet:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "7px 10px"
---

# Design System: CodeOmniVis

## Overview

**Creative North Star: "The Instrument Workbench"**

The interface behaves like a precise development instrument. A stable shell surrounds interchangeable architecture views; controls stay compact and predictable, while the graph remains the dominant surface. Density is intentional and progressive rather than decorative.

## Colors

Neutral charcoal surfaces carry the product. Cold blue is reserved for selection, focus, and primary actions. Semantic green, amber, and red communicate state. Node-type colors remain available inside the graph but do not spill into navigation chrome. Gradients are prohibited.

## Typography

Use one sans-serif family across the application and a monospace stack only for paths, identifiers, and code metadata. Hierarchy comes from weight, spacing, and surface grouping, not oversized headings.

## Elevation

The shell is predominantly flat. Use tonal surface changes and one-pixel borders for hierarchy. Shadows are limited to temporary overlays such as the command palette and mobile drawers; permanent panels do not float.

## Components

The primary layout is a compact command bar, activity rail, contextual explorer, central canvas, optional inspector, and status bar. Controls use 4–10px radii, 28–34px heights, visible focus rings, and 150–200ms state transitions. Empty and loading states teach the next action instead of showing a lone spinner.

## Do's and Don'ts

- Do keep the canvas visually dominant and preserve viewport state across updates.
- Do expose architecture, request flow, data model, and quality as peer views.
- Do show breadcrumbs and current expansion level so users know where they are.
- Do use icons with text or accessible labels; use emoji only in user content.
- Don't render AI chat as a permanent workspace destination.
- Don't use gradients, glassmorphism, large metric cards, or decorative animation.
- Don't make users remember node colors without an accessible legend.
