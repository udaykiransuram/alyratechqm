import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background, Chip, GlassCard, IconBubble, SceneTitle } from "./components/primitives";
import { colors } from "./lib/colors";

const fontFamily =
  "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

const fps = 30;
const sceneDurations = [120, 150, 180, 210, 210, 180, 180, 120];
const sceneStarts = sceneDurations.reduce<number[]>((acc, duration, index) => {
  const lastStart = acc[index - 1] ?? 0;
  const lastDuration = sceneDurations[index - 1] ?? 0;
  acc.push(lastStart + lastDuration);
  return acc;
}, []);

export const VO_SCRIPT = [
  "Is your child ready for the next term?",
  "Start with a free class-matched diagnostic.",
  "In minutes, see strengths and weak areas.",
  "Parents get a clean, easy report.",
  "We show the next best step right away.",
  "One phone number. Simple every time.",
  "Welcome to Alyra Tech's Summer Crash Course.",
  "Start your free diagnostic now.",
];

type SceneProps = {
  startFrame: number;
  durationInFrames: number;
};

const SceneShell: React.FC<
  SceneProps & { children: (localFrame: number) => React.ReactNode }
> = ({ startFrame, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, Math.min(durationInFrames, frame - startFrame));
  const { fps: videoFps } = useVideoConfig();
  const entry = spring({
    frame: localFrame,
    fps: videoFps,
    config: {
      damping: 26,
      stiffness: 120,
    },
  });
  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(localFrame, [0, 12], [28, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          padding: "96px 96px 110px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity,
          transform: `translateY(${translateY}px) scale(${0.98 + entry * 0.02})`,
        }}
      >
        {children(localFrame)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const HookScene: React.FC<SceneProps> = (props) => {
  return (
    <SceneShell {...props}>
      {() => (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 36,
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 84,
              left: 84,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <IconBubble label="AT" />
            <div
              style={{
                fontFamily,
                fontSize: 26,
                fontWeight: 600,
                color: "rgba(246, 251, 255, 0.84)",
              }}
            >
              Alyra Tech
            </div>
          </div>
          <SceneTitle title="Ready for next term?" />
          <div
            style={{
              width: 240,
              height: 6,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${colors.accentStrong} 0%, ${colors.accent} 100%)`,
              boxShadow: `0 12px 30px -18px ${colors.shadow}88`,
            }}
          />
        </div>
      )}
    </SceneShell>
  );
};

const ClassMatchScene: React.FC<SceneProps> = (props) => {
  return (
    <SceneShell {...props}>
      {() => (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 36,
          }}
        >
          <SceneTitle title="Free class-matched diagnostic" />
          <GlassCard style={{ width: 780 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 14,
              }}
            >
              <Chip label="Class 6" tone="accent" />
              <Chip label="Class 7" />
              <Chip label="Class 8" />
              <Chip label="Class 9" />
            </div>
            <div
              style={{
                marginTop: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <IconBubble label="OK" />
              <div
                style={{
                  fontFamily,
                  fontSize: 26,
                  fontWeight: 600,
                  color: colors.ink,
                }}
              >
                Matched to your class
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </SceneShell>
  );
};

const TimerRing: React.FC<{ progress: number }> = ({ progress }) => {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div style={{ position: "relative", width: 140, height: 140 }}>
      <svg width={140} height={140}>
        <circle
          cx={70}
          cy={70}
          r={radius}
          stroke={`${colors.border}88`}
          strokeWidth={12}
          fill="none"
        />
        <circle
          cx={70}
          cy={70}
          r={radius}
          stroke={colors.accent}
          strokeWidth={12}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          fontSize: 24,
          fontWeight: 700,
          color: colors.ink,
        }}
      >
        15 min
      </div>
    </div>
  );
};

const ClarityScene: React.FC<SceneProps> = ({ startFrame, durationInFrames }) => {
  return (
    <SceneShell startFrame={startFrame} durationInFrames={durationInFrames}>
      {(localFrame) => {
        const progress = interpolate(localFrame, [0, durationInFrames], [0.2, 1], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 36,
            }}
          >
            <SceneTitle title="15-minute clarity" />
            <GlassCard
              style={{
                width: 780,
                display: "flex",
                gap: 28,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <TimerRing progress={progress} />
              <div
                style={{
                  flex: 1,
                  padding: 24,
                  borderRadius: 24,
                  background: `${colors.surface}`,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ fontFamily, fontSize: 20, color: colors.muted }}>Q1</div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily,
                    fontSize: 26,
                    fontWeight: 600,
                    color: colors.ink,
                  }}
                >
                  Which is greater?
                </div>
                <div
                  style={{
                    marginTop: 18,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      style={{
                        height: 12,
                        borderRadius: 999,
                        background: `${colors.surface2}`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        );
      }}
    </SceneShell>
  );
};

const ReportBars: React.FC = () => {
  return (
    <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
      {[
        { label: "Fractions", value: 0.85 },
        { label: "Decimals", value: 0.64 },
        { label: "Ratio", value: 0.42 },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 120,
              fontFamily,
              fontSize: 20,
              color: colors.inkSoft,
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              flex: 1,
              height: 12,
              borderRadius: 999,
              background: `${colors.surface2}`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${row.value * 100}%`,
                height: "100%",
                borderRadius: 999,
                background: `linear-gradient(90deg, ${colors.brandStart} 0%, ${colors.accent} 100%)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const ReportScene: React.FC<SceneProps> = (props) => {
  return (
    <SceneShell {...props}>
      {() => (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 36,
          }}
        >
          <SceneTitle title="Parent-friendly report" />
          <GlassCard style={{ width: 780 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
              }}
            >
              <div
                style={{
                  fontFamily,
                  fontSize: 26,
                  fontWeight: 600,
                  color: colors.ink,
                }}
              >
                Weak topics
              </div>
              <Chip label="Instant" tone="accent" />
            </div>
            <ReportBars />
          </GlassCard>
        </div>
      )}
    </SceneShell>
  );
};

const NextStepScene: React.FC<SceneProps> = (props) => {
  return (
    <SceneShell {...props}>
      {() => (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 36,
          }}
        >
          <SceneTitle title="Next best step" />
          <GlassCard style={{ width: 780 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <IconBubble label="GO" />
              <div
                style={{
                  fontFamily,
                  fontSize: 26,
                  fontWeight: 600,
                  color: colors.ink,
                }}
              >
                Personal practice path
              </div>
            </div>
            <div
              style={{
                marginTop: 26,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <Chip label="Micro-lessons" />
              <Chip label="Practice sets" />
              <Chip label="Confidence boost" />
            </div>
            <div
              style={{
                marginTop: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 2,
                  background: `${colors.accent}AA`,
                }}
              />
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderTop: `2px solid ${colors.accent}`,
                  borderRight: `2px solid ${colors.accent}`,
                  transform: "rotate(45deg)",
                }}
              />
            </div>
          </GlassCard>
        </div>
      )}
    </SceneShell>
  );
};

const PhoneScene: React.FC<SceneProps> = (props) => {
  return (
    <SceneShell {...props}>
      {() => (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 36,
          }}
        >
          <SceneTitle title="Phone-first sign-in" />
          <GlassCard
            style={{
              width: 700,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <IconBubble label="PIN" />
              <div
                style={{
                  fontFamily,
                  fontSize: 26,
                  fontWeight: 600,
                  color: colors.ink,
                }}
              >
                One number. Simple every time.
              </div>
            </div>
            <div
              style={{
                padding: 20,
                borderRadius: 20,
                background: `${colors.surface2}`,
                border: `1px solid ${colors.border}`,
                fontFamily,
                fontSize: 30,
                letterSpacing: 1,
                color: colors.inkSoft,
                textAlign: "center",
              }}
            >
              +91 98XXXX4321
            </div>
          </GlassCard>
        </div>
      )}
    </SceneShell>
  );
};

const CourseScene: React.FC<SceneProps> = (props) => {
  return (
    <SceneShell {...props}>
      {() => (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 36,
          }}
        >
          <SceneTitle title="Summer Crash Course" />
          <div
            style={{
              width: 780,
              padding: "36px 40px",
              borderRadius: 36,
              background: `linear-gradient(135deg, ${colors.brandStart} 0%, ${colors.accent} 100%)`,
              boxShadow: `0 32px 72px -48px ${colors.shadow}88`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily,
                fontSize: 28,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Math Foundations Summer Sprint
            </div>
          </div>
        </div>
      )}
    </SceneShell>
  );
};

const CtaScene: React.FC<SceneProps> = (props) => {
  return (
    <SceneShell {...props}>
      {() => (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
          }}
        >
          <SceneTitle title="Start Free Diagnostic" />
          <div
            style={{
              padding: "18px 36px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${colors.brandStart} 0%, ${colors.accent} 100%)`,
              color: "#fff",
              fontFamily,
              fontSize: 26,
              fontWeight: 700,
              boxShadow: `0 28px 60px -40px ${colors.shadow}88`,
            }}
          >
            Start Free Diagnostic
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 22,
              color: "rgba(255,255,255,0.68)",
            }}
          >
            alyratech.study/summer-crash-course
          </div>
        </div>
      )}
    </SceneShell>
  );
};

export const SummerCrash45s: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={sceneStarts[0]} durationInFrames={sceneDurations[0]}>
        <HookScene startFrame={sceneStarts[0]} durationInFrames={sceneDurations[0]} />
      </Sequence>
      <Sequence from={sceneStarts[1]} durationInFrames={sceneDurations[1]}>
        <ClassMatchScene
          startFrame={sceneStarts[1]}
          durationInFrames={sceneDurations[1]}
        />
      </Sequence>
      <Sequence from={sceneStarts[2]} durationInFrames={sceneDurations[2]}>
        <ClarityScene startFrame={sceneStarts[2]} durationInFrames={sceneDurations[2]} />
      </Sequence>
      <Sequence from={sceneStarts[3]} durationInFrames={sceneDurations[3]}>
        <ReportScene startFrame={sceneStarts[3]} durationInFrames={sceneDurations[3]} />
      </Sequence>
      <Sequence from={sceneStarts[4]} durationInFrames={sceneDurations[4]}>
        <NextStepScene
          startFrame={sceneStarts[4]}
          durationInFrames={sceneDurations[4]}
        />
      </Sequence>
      <Sequence from={sceneStarts[5]} durationInFrames={sceneDurations[5]}>
        <PhoneScene startFrame={sceneStarts[5]} durationInFrames={sceneDurations[5]} />
      </Sequence>
      <Sequence from={sceneStarts[6]} durationInFrames={sceneDurations[6]}>
        <CourseScene startFrame={sceneStarts[6]} durationInFrames={sceneDurations[6]} />
      </Sequence>
      <Sequence from={sceneStarts[7]} durationInFrames={sceneDurations[7]}>
        <CtaScene startFrame={sceneStarts[7]} durationInFrames={sceneDurations[7]} />
      </Sequence>
    </AbsoluteFill>
  );
};
