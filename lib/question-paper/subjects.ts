export type ResolvedPaperSubject = {
  _id: string;
  name: string;
};

function normalizeId(value: unknown) {
  if (!value) return "";

  if (typeof value === "object" && value !== null) {
    if ("_id" in (value as Record<string, unknown>)) {
      return String((value as Record<string, unknown>)._id || "").trim();
    }
  }

  return String(value || "").trim();
}

function normalizeName(value: unknown) {
  if (!value || typeof value !== "object") return "";
  return String((value as Record<string, unknown>).name || "").trim();
}

function sortUniqueIds(values: string[]) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function sortSubjectsByLabel(values: ResolvedPaperSubject[]) {
  return [...values].sort((left, right) => {
    const leftLabel = String(left?.name || left?._id || "").trim();
    const rightLabel = String(right?.name || right?._id || "").trim();
    return leftLabel.localeCompare(rightLabel);
  });
}

export function resolveSectionSubjects(
  section: any,
  fallbackSubjectsInput: Array<{ _id?: string; name?: string }> = [],
): ResolvedPaperSubject[] {
  const subjects = new Map<string, ResolvedPaperSubject>();
  const fallbackSubjects = Array.isArray(fallbackSubjectsInput)
    ? fallbackSubjectsInput
    : [];
  const fallbackSubject = fallbackSubjects.length === 1 ? fallbackSubjects[0] : null;

  const register = (candidate: unknown) => {
    const id = normalizeId(candidate);
    if (!id || subjects.has(id)) return;

    subjects.set(id, {
      _id: id,
      name: normalizeName(candidate) || id,
    });
  };

  (Array.isArray(section?.questions) ? section.questions : []).forEach(
    (entry: any) => {
      register(entry?.question?.subject);
    },
  );

  if (subjects.size === 0 && fallbackSubject) {
    register(fallbackSubject);
  }

  return sortSubjectsByLabel(Array.from(subjects.values()));
}

function buildSubjectNameLookup(paper: any) {
  const lookup = new Map<string, string>();

  const register = (candidate: unknown) => {
    const id = normalizeId(candidate);
    if (!id || lookup.has(id)) return;

    const name = normalizeName(candidate);
    if (!name) return;
    lookup.set(id, name);
  };

  (Array.isArray(paper?.subjectIds) ? paper.subjectIds : []).forEach(register);

  (Array.isArray(paper?.sections) ? paper.sections : []).forEach((section: any) => {
    (Array.isArray(section?.questions) ? section.questions : []).forEach(
      (entry: any) => {
        register(entry?.question?.subject);
      },
    );
  });

  register(paper?.subject);

  return lookup;
}

export function derivePaperSubjectIdsFromQuestions(questions: any[]) {
  return sortUniqueIds(
    (Array.isArray(questions) ? questions : []).map((question) =>
      normalizeId(question?.subject),
    ),
  );
}

export function derivePaperSubjectIdsFromSections(sections: any[]) {
  const questions = (Array.isArray(sections) ? sections : []).flatMap((section: any) =>
    (Array.isArray(section?.questions) ? section.questions : []).map(
      (entry: any) => entry?.question || null,
    ),
  );

  return derivePaperSubjectIdsFromQuestions(questions);
}

export function resolvePaperSubjectIds(paper: any) {
  const explicitSubjectIds = sortUniqueIds(
    (Array.isArray(paper?.subjectIds) ? paper.subjectIds : []).map((subject: any) =>
      normalizeId(subject),
    ),
  );
  if (explicitSubjectIds.length > 0) {
    return explicitSubjectIds;
  }

  const derivedSubjectIds = derivePaperSubjectIdsFromSections(paper?.sections);
  if (derivedSubjectIds.length > 0) {
    return derivedSubjectIds;
  }

  const legacySubjectId = normalizeId(paper?.subject);
  return legacySubjectId ? [legacySubjectId] : [];
}

export function resolvePaperSubjects(paper: any): ResolvedPaperSubject[] {
  const subjectNameLookup = buildSubjectNameLookup(paper);
  const explicitSubjectIds = sortUniqueIds(
    (Array.isArray(paper?.subjectIds) ? paper.subjectIds : []).map((subject: any) =>
      normalizeId(subject),
    ),
  );

  if (explicitSubjectIds.length > 0) {
    return sortSubjectsByLabel(
      explicitSubjectIds.map((subjectId) => ({
        _id: subjectId,
        name: subjectNameLookup.get(subjectId) || "",
      })),
    );
  }

  const derivedSubjects = new Map<string, ResolvedPaperSubject>();
  (Array.isArray(paper?.sections) ? paper.sections : []).forEach((section: any) => {
    (Array.isArray(section?.questions) ? section.questions : []).forEach(
      (entry: any) => {
        const subjectId = normalizeId(entry?.question?.subject);
        if (!subjectId || derivedSubjects.has(subjectId)) {
          return;
        }

        derivedSubjects.set(subjectId, {
          _id: subjectId,
          name: subjectNameLookup.get(subjectId) || normalizeName(entry?.question?.subject),
        });
      },
    );
  });

  if (derivedSubjects.size > 0) {
    return sortSubjectsByLabel(Array.from(derivedSubjects.values()));
  }

  const legacySubjectId = normalizeId(paper?.subject);
  if (!legacySubjectId) {
    return [];
  }

  return [
    {
      _id: legacySubjectId,
      name: subjectNameLookup.get(legacySubjectId) || normalizeName(paper?.subject),
    },
  ];
}

export function getLegacyPaperSubject(paper: any) {
  const subjects = resolvePaperSubjects(paper);
  return subjects.length === 1 ? subjects[0] : null;
}

export function buildStoredPaperSubjectFields(subjectIdsInput: string[]) {
  const subjectIds = sortUniqueIds(subjectIdsInput);
  return {
    subjectIds,
    subject: subjectIds.length === 1 ? subjectIds[0] : null,
  };
}

export function serializePaperSubjects(paper: any) {
  const subjects = resolvePaperSubjects(paper);
  return {
    subjects,
    subject: subjects.length === 1 ? subjects[0] : null,
  };
}
