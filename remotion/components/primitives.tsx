import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { colors } from "../lib/colors";

const fontFamily =
  "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 1350], [0, 16]);
  const glow = interpolate(frame, [0, 1350], [0.12, 0.18]);

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `
          radial-gradient(circle at 12% 10%, ${colors.accentStrong}33 0%, transparent 32%),
          radial-gradient(circle at 86% 16%, ${colors.warm}33 0%, transparent 34%),
          linear-gradient(160deg, ${colors.heroStart} 0%, ${colors.heroMid} 42%, ${colors.heroEnd} 100%)
        `,
        color: colors.ink,
        overflow: "hidden",
      }}
    >
      <Img
        src={staticFile("images/cards-bg.png")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.08,
          mixBlendMode: "screen",
        }}
      />
      <Img
        src={staticFile("images/teal-abstract-leaves.svg")}
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 560,
          opacity: glow,
          transform: `translateY(${drift}px)`,
        }}
      />
      <Img
        src={staticFile("images/wave-teal.svg")}
        style={{
          position: "absolute",
          bottom: -40,
          left: -40,
          width: 820,
          opacity: 0.2,
          transform: `translateY(${-drift * 0.5}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const GlassCard: React.FC<{
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ style, children }) => {
  return (
    <div
      style={{
        borderRadius: 36,
        border: `1px solid ${colors.border}33`,
        background: `linear-gradient(160deg, ${colors.surface}F2 0%, ${colors.surface2}E6 100%)`,
        boxShadow: `0 32px 72px -48px ${colors.shadow}55`,
        backdropFilter: "blur(12px)",
        padding: 36,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Chip: React.FC<{ label: string; tone?: "accent" | "muted" }> = ({
  label,
  tone = "muted",
}) => {
  const background =
    tone === "accent"
      ? `linear-gradient(135deg, ${colors.brandStart} 0%, ${colors.accent} 100%)`
      : `${colors.surface}CC`;
  const color = tone === "accent" ? "#ffffff" : colors.inkSoft;
  const border = tone === "accent" ? "transparent" : `${colors.border}88`;

  return (
    <div
      style={{
        padding: "10px 18px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background,
        fontFamily,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: -0.2,
        color,
        boxShadow: `0 16px 32px -24px ${colors.shadow}44`,
      }}
    >
      {label}
    </div>
  );
};

export const IconBubble: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: `linear-gradient(140deg, ${colors.brandStart} 0%, ${colors.accent} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily,
        fontWeight: 700,
        fontSize: 20,
        boxShadow: `0 18px 36px -24px ${colors.shadow}66`,
      }}
    >
      {label}
    </div>
  );
};

export const SceneTitle: React.FC<{
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}> = ({ title, subtitle, align = "center" }) => {
  return (
    <div style={{ textAlign: align, maxWidth: 820 }}>
      <div
        style={{
          fontFamily,
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.05,
          color: "#f6fbff",
          textShadow: `0 22px 46px ${colors.shadow}88`,
          letterSpacing: -0.8,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 18,
            fontFamily,
            fontSize: 28,
            fontWeight: 500,
            color: "rgba(246, 251, 255, 0.78)",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};

export const SubtleTitle: React.FC<{
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}> = ({ title, subtitle, align = "left" }) => {
  return (
    <div style={{ textAlign: align, maxWidth: 840 }}>
      <div
        style={{
          fontFamily,
          fontSize: 58,
          fontWeight: 700,
          color: colors.ink,
          letterSpacing: -0.6,
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 16,
            fontFamily,
            fontSize: 26,
            color: colors.muted,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
