import School from "@/models/School";
import {
  DEFAULT_WORKSPACE_APPEARANCE,
  isAppNavMode,
  isAppNavTone,
  isAppPalette,
  isAppTextStyle,
  normalizeAccentHex,
  type WorkspaceAppearanceState,
} from "@/lib/client/workspace-appearance";

type WorkspaceAppearanceLike =
  | Partial<Record<keyof WorkspaceAppearanceState, unknown>>
  | null
  | undefined;

export function normalizeWorkspaceAppearance(
  appearance?: WorkspaceAppearanceLike,
): WorkspaceAppearanceState {
  const candidate = appearance || {};
  const textStyle = String(candidate.textStyle || "").trim();
  const navMode = String(candidate.navMode || "").trim();
  const navTone = String(candidate.navTone || "").trim();
  const palette = String(candidate.palette || "").trim();
  const customAccentHex = normalizeAccentHex(
    String(candidate.customAccentHex || ""),
  );

  return {
    textStyle: isAppTextStyle(textStyle)
      ? textStyle
      : DEFAULT_WORKSPACE_APPEARANCE.textStyle,
    navMode: isAppNavMode(navMode)
      ? navMode
      : DEFAULT_WORKSPACE_APPEARANCE.navMode,
    navTone: isAppNavTone(navTone)
      ? navTone
      : DEFAULT_WORKSPACE_APPEARANCE.navTone,
    palette: isAppPalette(palette)
      ? palette
      : DEFAULT_WORKSPACE_APPEARANCE.palette,
    customAccentHex,
  };
}

export async function getSchoolWorkspaceAppearance(
  schoolKey: string,
): Promise<WorkspaceAppearanceState> {
  const normalizedSchoolKey = String(schoolKey || "").trim().toLowerCase();
  if (!normalizedSchoolKey) {
    return DEFAULT_WORKSPACE_APPEARANCE;
  }

  const school = await School.findOne({ key: normalizedSchoolKey })
    .select("workspaceAppearance")
    .lean();

  return normalizeWorkspaceAppearance(
    (school as { workspaceAppearance?: WorkspaceAppearanceLike } | null)
      ?.workspaceAppearance,
  );
}

export async function saveSchoolWorkspaceAppearance(
  schoolKey: string,
  appearance: WorkspaceAppearanceLike,
): Promise<WorkspaceAppearanceState | null> {
  const normalizedSchoolKey = String(schoolKey || "").trim().toLowerCase();
  if (!normalizedSchoolKey) {
    return null;
  }

  const normalizedAppearance = normalizeWorkspaceAppearance(appearance);
  const school = await School.findOneAndUpdate(
    { key: normalizedSchoolKey },
    {
      $set: {
        workspaceAppearance: normalizedAppearance,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .select("workspaceAppearance")
    .lean();

  if (!school) {
    return null;
  }

  return normalizeWorkspaceAppearance(
    (school as { workspaceAppearance?: WorkspaceAppearanceLike })
      .workspaceAppearance,
  );
}
