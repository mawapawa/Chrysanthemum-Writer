import type { UIElementV2, ResolvedBindings, RenderProperties, BindingContext, TextStyleProps, ButtonStyleProps, ContainerStyleProps, ImageStyleProps, ProjectAsset } from "../types";

function resolveTextProps(
  element: UIElementV2,
  bindings: ResolvedBindings,
  context?: BindingContext
): TextStyleProps {
  const p = element.properties;
  const textType = (p.textType as string) ?? "custom";
  const isDialogueBox = textType === "dialogue";
  const content = isDialogueBox && context?.dialogueText != null
    ? context.dialogueText
    : bindings.text;
  const formattedText = isDialogueBox ? context?.dialogueFormattedText : undefined;

  return {
    type: "text",
    content,
    fontSize: (p.fontSize as string) ?? (isDialogueBox ? "15px" : textType === "label" ? "10px" : "12px"),
    color: (p.color as string) ?? (isDialogueBox ? "#e2e8f0" : textType === "label" ? "#94a3b8" : "#e2e8f0"),
    align: (p.align as "left" | "center" | "right") ?? "left",
    fontStyle: isDialogueBox ? undefined : textType === "characterName" ? undefined : undefined,
    fontWeight: textType === "title" ? 700 : textType === "characterName" ? 600 : undefined,
    lineHeight: isDialogueBox ? 1.6 : undefined,
    isDialogueBox,
    formattedText,
  };
}

function resolveContainerProps(element: UIElementV2): ContainerStyleProps {
  return {
    type: "container",
    direction: (element.properties?.direction as "row" | "column") ?? undefined,
  };
}

function resolveImageProps(
  element: UIElementV2,
  assets?: ProjectAsset[]
): ImageStyleProps {
  const p = element.properties;
  const assetId = (p.assetId as string) || (p.src as string) || "";
  const asset = assets?.find(a => a.id === assetId);
  return {
    type: "image",
    assetId,
    source: asset?.source ?? assetId,
    fit: (p.fit as "contain" | "cover" | "stretch") ?? "cover",
  };
}

function resolveButtonProps(
  element: UIElementV2,
  bindings: ResolvedBindings
): ButtonStyleProps {
  const p = element.properties;
  return {
    type: "button",
    label: bindings.text || (p.buttonLabel as string) || "Button",
    action: bindings.action || (p.buttonAction as string) || "custom",
    disabled: (p.disabled as boolean) ?? false,
  };
}

export function resolveProperties(
  element: UIElementV2,
  bindings: ResolvedBindings,
  context?: BindingContext,
  assets?: ProjectAsset[]
): RenderProperties {
  switch (element.type) {
    case "text":
      return resolveTextProps(element, bindings, context);
    case "button":
      return resolveButtonProps(element, bindings);
    case "container":
      return resolveContainerProps(element);
    case "image":
      return resolveImageProps(element, assets);
    default:
      return {
        type: "text",
        content: bindings.text || "Unknown widget",
        fontSize: "12px",
        color: "#e2e8f0",
        align: "left",
        isDialogueBox: false,
      };
  }
}
