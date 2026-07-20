import React from "react";
import type { ComputedLayout, RenderProperties, TextStyleProps } from "../types";

// ─── TextWidgetV2 — pure renderer, receives only TextRenderProps ──

function TextWidgetV2(props: TextStyleProps) {
  const style: React.CSSProperties = {
    fontSize: props.fontSize,
    color: props.color,
    textAlign: props.align,
    justifyContent: props.align === "center" ? "center" : props.align === "right" ? "flex-end" : "flex-start",
    fontStyle: props.fontStyle as any,
    fontWeight: props.fontWeight as any,
    lineHeight: props.lineHeight,
    height: "100%",
    display: "flex",
    alignItems: "center",
    overflowY: "auto",
  };

  if (props.isDialogueBox) {
    Object.assign(style, {
      background: "linear-gradient(to bottom, #1e293b, #0f172a)",
      border: "1px solid #334155",
      borderRadius: "12px",
      padding: "16px",
      fontSize: "15px",
      lineHeight: 1.6,
    });
  }

  return (
    <div style={style}>
      {props.content ? (
        props.formattedText ? (
          <span dangerouslySetInnerHTML={{ __html: props.formattedText }} />
        ) : (
          <span>{props.content}</span>
        )
      ) : (
        props.isDialogueBox ? (
          <span style={{ color: "#64748b", fontStyle: "italic", fontSize: "10px" }}>
            Dialogue will appear here during playtest
          </span>
        ) : (
          <span style={{ color: "#64748b", fontStyle: "italic", fontSize: "10px" }}>
            Double-click to edit text
          </span>
        )
      )}
    </div>
  );
}

// ─── Element Renderer ────────────────────────────────────────────

export interface ElementRendererProps {
  computed: ComputedLayout;
  renderProps: RenderProperties;
}

export function ElementRenderer({ computed, renderProps }: ElementRendererProps) {
  const wrapStyle: React.CSSProperties = {
    position: "absolute",
    left: computed.x,
    top: computed.y,
    width: computed.width,
    height: computed.height,
    zIndex: computed.zIndex,
    opacity: computed.opacity,
    borderRadius: computed.borderRadius || undefined,
    borderWidth: computed.borderWidth || undefined,
    borderColor: computed.borderColor || undefined,
    borderStyle: (computed.borderStyle as any) || undefined,
    overflow: computed.clip ? "hidden" : undefined,
    transform: computed.rotation ? `rotate(${computed.rotation}deg)` : undefined,
  };

  const content = (() => {
    switch (renderProps.type) {
      case "text":
        return <TextWidgetV2 {...renderProps} />;
      default:
        return <div style={{ color: "#94a3b8", fontSize: "10px", padding: 4 }}>Unknown</div>;
    }
  })();

  return <div style={wrapStyle}>{content}</div>;
}
