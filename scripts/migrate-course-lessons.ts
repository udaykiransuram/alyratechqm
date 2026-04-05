import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import School from "@/models/School";

type LegacyBlock = {
  id?: string;
  type?: string;
  title?: string;
  summary?: string;
  contentHtml?: string;
  imageUrl?: string;
  altText?: string;
  caption?: string;
  imageFit?: string;
  imageWidth?: string;
  imageHeight?: string;
  videoId?: string;
  fileUrl?: string;
  fileName?: string;
  tone?: string;
  questionPaper?: any;
  titleOverride?: string;
  required?: boolean;
  minimumScorePct?: number | null;
  items?: any[];
  estimatedMinutes?: number | null;
};

function toId(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }
  return String(value || "").trim();
}

function createLessonId(courseId: string, index: number) {
  return `lesson-${courseId}-${index}`;
}

function mapLegacyBlockToItem(block: LegacyBlock) {
  const type = String(block.type || "").trim();
  if (type === "text") {
    return {
      type: "text",
      contentHtml: block.contentHtml || "",
    };
  }
  if (type === "image") {
    return {
      type: "image",
      imageUrl: block.imageUrl || "",
      altText: block.altText || "",
      caption: block.caption || "",
      imageFit: block.imageFit || "contain",
      imageWidth: block.imageWidth || "standard",
      imageHeight: block.imageHeight || "large",
    };
  }
  if (type === "youtube") {
    return {
      type: "youtube",
      videoId: block.videoId || "",
      caption: block.caption || "",
    };
  }
  if (type === "resource") {
    return {
      type: "resource",
      title: block.title || "",
      fileUrl: block.fileUrl || "",
      fileName: block.fileName || "",
      caption: block.caption || "",
    };
  }
  return null;
}

function migrateCourseBlocks(courseId: string, blocks: LegacyBlock[]) {
  const nextBlocks: LegacyBlock[] = [];
  const idMap = new Map<string, string>();
  let lessonIndex = 0;
  let pendingItems: any[] = [];
  let pendingLegacyIds: string[] = [];
  let changed = false;

  const flushLesson = () => {
    if (pendingItems.length === 0) {
      return;
    }

    lessonIndex += 1;
    const lessonId = createLessonId(courseId, lessonIndex);
    nextBlocks.push({
      id: lessonId,
      type: "lesson",
      title: `Lesson ${lessonIndex}`,
      summary: "",
      estimatedMinutes: null,
      items: pendingItems,
    });
    pendingLegacyIds.forEach((legacyId) => {
      if (legacyId) {
        idMap.set(legacyId, lessonId);
      }
    });
    pendingItems = [];
    pendingLegacyIds = [];
    changed = true;
  };

  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const type = String(block?.type || "").trim();
    if (type === "module") {
      flushLesson();
      nextBlocks.push(block);
      return;
    }

    if (type === "lesson") {
      flushLesson();
      nextBlocks.push(block);
      return;
    }

    if (type === "announcement" || type === "assessment") {
      flushLesson();
      nextBlocks.push(block);
      return;
    }

    if (type === "text" || type === "image" || type === "youtube" || type === "resource") {
      const item = mapLegacyBlockToItem(block);
      if (item) {
        pendingItems.push(item);
        const legacyId = String(block?.id || "").trim();
        if (legacyId) {
          pendingLegacyIds.push(legacyId);
        }
      }
      changed = true;
      return;
    }

    nextBlocks.push(block);
  });

  flushLesson();

  return { nextBlocks, idMap, changed };
}

function mapIds(values: unknown[], idMap: Map<string, string>) {
  const nextValues = (Array.isArray(values) ? values : [])
    .map((value) => idMap.get(String(value || "").trim()) || String(value || "").trim())
    .filter(Boolean);
  return Array.from(new Set(nextValues));
}

async function main() {
  await connectDB();

  const schools = await School.find({})
    .select("key displayName")
    .sort({ displayName: 1 })
    .lean();

  for (const school of schools as any[]) {
    const schoolKey = String(school?.key || "").trim();
    if (!schoolKey) {
      continue;
    }

    const { Course: CourseModel, CourseProgress: CourseProgressModel } = await getTenantModels(
      schoolKey,
      ["Course", "CourseProgress"],
    );

    const courses = await CourseModel.find({})
      .select("_id title blocks")
      .lean();

    console.log(`[course-lessons] ${schoolKey}: scanning ${courses.length} courses`);

    let updatedCourses = 0;
    let updatedProgress = 0;

    for (const course of courses as any[]) {
      const courseId = toId(course?._id);
      const { nextBlocks, idMap, changed } = migrateCourseBlocks(courseId, course?.blocks || []);

      if (!changed) {
        continue;
      }

      await CourseModel.updateOne(
        { _id: course._id },
        { $set: { blocks: nextBlocks } },
      );
      updatedCourses += 1;

      if (idMap.size > 0) {
        const progressDocs = await CourseProgressModel.find({ course: course._id })
          .select(
            "lastViewedBlockId viewedBlockIds completedBlockIds bookmarkedBlockIds notes",
          )
          .lean();

        for (const progress of progressDocs as any[]) {
          const lastViewedBlockId = idMap.get(String(progress?.lastViewedBlockId || "").trim())
            || progress?.lastViewedBlockId
            || null;
          const viewedBlockIds = mapIds(progress?.viewedBlockIds || [], idMap);
          const completedBlockIds = mapIds(progress?.completedBlockIds || [], idMap);
          const bookmarkedBlockIds = mapIds(progress?.bookmarkedBlockIds || [], idMap);
          const notes = Array.isArray(progress?.notes)
            ? progress.notes
                .map((note: any) => {
                  const mappedId = idMap.get(String(note?.blockId || "").trim()) || note?.blockId;
                  return mappedId ? { ...note, blockId: mappedId } : null;
                })
                .filter(Boolean)
            : [];

          await CourseProgressModel.updateOne(
            { _id: progress._id },
            {
              $set: {
                lastViewedBlockId,
                viewedBlockIds,
                completedBlockIds,
                bookmarkedBlockIds,
                notes,
              },
            },
          );
          updatedProgress += 1;
        }
      }

      console.log(
        `[course-lessons] ${schoolKey}: migrated course ${courseId} (${String(course?.title || "").trim()})`,
      );
    }

    console.log(
      `[course-lessons] ${schoolKey}: updated ${updatedCourses} courses, ${updatedProgress} progress docs`,
    );
  }
}

main().catch((error) => {
  console.error("[course-lessons] migration failed:", error);
  process.exitCode = 1;
});
