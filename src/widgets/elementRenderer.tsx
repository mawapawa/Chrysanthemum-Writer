import React from "react";
import type { ComputedLayout, ComputedStyle, RenderProperties, TextStyleProps, ButtonStyleProps, ContainerStyleProps, ImageStyleProps, ElementEvents } from "../types";

// ─── TextWidgetV2 — pure renderer, receives only props ──

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
        <span style={{ color: "#64748b", fontStyle: "italic", fontSize: "10px" }}>
          {props.isDialogueBox
            ? "Dialogue will appear here during playtest"
            : "Double-click to edit text"}
        </span>
      )}
    </div>
  );
}

// ─── ImageWidgetV2 — pure renderer ──────────────────────────────

function ImageWidgetV2(props: ImageStyleProps) {
  if (!props.source) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b", fontSize: 10, fontStyle: "italic" }}>
        No image set
      </div>
    );
  }
  const bgSize = props.fit === "stretch" ? "100% 100%" : props.fit === "contain" ? "contain" : "cover";
  return (
    <div style={{
      width: "100%", height: "100%",
      backgroundImage: `url(${props.source})`,
      backgroundSize: bgSize,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }} />
  );
}

// ─── ButtonWidgetV2 — pure renderer ─────────────────────────────

function ButtonWidgetV2(props: ButtonStyleProps & { onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        width: "100%",
        height: "100%",
        background: props.disabled ? "#475569" : "#6366f1",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontSize: "12px",
        fontWeight: 700,
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 12px",
      }}
    >
      {props.label}
    </button>
  );
}

// ─── Universal CSS resolver ──────────────────────────────────────

function wrapStyle(computed: ComputedLayout, vis: ComputedStyle): React.CSSProperties {
  return {
    position: "absolute",
    left: computed.x,
    top: computed.y,
    width: computed.width,
    height: computed.height,
    zIndex: computed.zIndex,
    opacity: vis.opacity,
    padding: vis.padding || undefined,
    margin: vis.margin || undefined,
    background: vis.background || undefined,
    boxShadow: vis.boxShadow || undefined,
    borderRadius: vis.borderRadius || undefined,
    borderWidth: vis.borderWidth || undefined,
    borderColor: vis.borderColor || undefined,
    borderStyle: (vis.borderStyle as any) || undefined,
    overflow: computed.clip ? "hidden" : undefined,
    transform: computed.rotation ? `rotate(${computed.rotation}deg)` : undefined,
  };
}

// ─── Element Renderer ────────────────────────────────────────────

export interface ElementRendererProps {
  computed: ComputedLayout;
  computedStyle: ComputedStyle;
  renderProps: RenderProperties;
  events?: ElementEvents;
}

export function ElementRenderer({ computed, computedStyle, renderProps, events }: ElementRendererProps) {
  const content = (() => {
    switch (renderProps.type) {
      case "text":
        return <TextWidgetV2 {...renderProps} />;
      case "button": {
        const bp = renderProps as ButtonStyleProps;
        return (
          <ButtonWidgetV2
            {...bp}
            onClick={(e) => { e.stopPropagation(); events?.onButtonAction?.(bp.action); }}
          />
        );
      }
      case "container":
        return null;
      case "image":
        return <ImageWidgetV2 {...(renderProps as ImageStyleProps)} />;
      default:
        return <div style={{ color: "#94a3b8", fontSize: "10px", padding: 4 }}>Unknown</div>;
    }
  })();

  return <div style={wrapStyle(computed, computedStyle)}>{content}</div>;
}
