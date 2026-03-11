#!/usr/bin/env node

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const normalized = String(entry || '').replace(/^--/, '');
    const [key, ...rest] = normalized.split('=');
    return [key, rest.length ? rest.join('=') : 'true'];
  }),
);

if (args.help === 'true' || args.h === 'true') {
  console.log([
    'Usage: node scripts/smoke-upload-benchmark.mjs --school=greenwood_day [--base=http://127.0.0.1:3000] [--paper=<paperId>] [--section=<sectionId>]',
    '',
    'Checks:',
    '  1. Question paper list for the selected school',
    '  2. Benchmark report for all sections',
    '  3. Benchmark report for one section',
    '  4. Upload history for the paper and section',
    '  5. Upload validation path with a safe no-write request',
  ].join('\n'));
  process.exit(0);
}

const baseUrl = String(args.base || 'http://127.0.0.1:3000').replace(/\/$/, '');
const school = String(args.school || '').trim();
const preferredPaperId = String(args.paper || '').trim();
const preferredSectionId = String(args.section || '').trim();

if (!school) {
  console.error('Missing required --school=<schoolKey> argument.');
  process.exit(1);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`Expected JSON from ${path} but received: ${text.slice(0, 120)}`);
  }

  return { response, data };
}

function getId(value) {
  return String(value?._id || value || '').trim();
}

function getPaperClassId(paper) {
  return getId(paper?.class);
}

function pickPaper(papers) {
  if (preferredPaperId) {
    return papers.find((paper) => getId(paper) === preferredPaperId) || null;
  }

  return (
    papers.find((paper) => Array.isArray(paper?.assignedAcademicSections) && paper.assignedAcademicSections.length > 0) ||
    papers[0] ||
    null
  );
}

function pickSection({ paper, sections }) {
  const assigned = Array.isArray(paper?.assignedAcademicSections) ? paper.assignedAcademicSections : [];

  if (preferredSectionId) {
    return (
      assigned.find((section) => getId(section) === preferredSectionId) ||
      sections.find((section) => getId(section) === preferredSectionId) ||
      null
    );
  }

  if (assigned.length > 0) {
    return assigned[0];
  }

  const paperClassId = getPaperClassId(paper);
  return sections.find((section) => getId(section?.class) === paperClassId) || null;
}

async function main() {
  console.log(`Smoke testing school ${school} via ${baseUrl}`);

  const paperList = await requestJson(`/api/question-papers?school=${encodeURIComponent(school)}`);
  if (!paperList.response.ok || !paperList.data?.success) {
    throw new Error(`Question paper list failed: ${paperList.data?.message || paperList.response.status}`);
  }

  const papers = Array.isArray(paperList.data.papers) ? paperList.data.papers : [];
  if (papers.length === 0) {
    throw new Error(`No question papers found for school ${school}.`);
  }

  const paper = pickPaper(papers);
  if (!paper) {
    throw new Error('Could not resolve a paper to smoke test.');
  }

  const sectionList = await requestJson(`/api/sections?school=${encodeURIComponent(school)}`);
  if (!sectionList.response.ok || !sectionList.data?.success) {
    throw new Error(`Section list failed: ${sectionList.data?.message || sectionList.response.status}`);
  }

  const sections = Array.isArray(sectionList.data.sections) ? sectionList.data.sections : [];
  const section = pickSection({ paper, sections });
  const paperId = getId(paper);
  const sectionId = getId(section);

  console.log(`Paper: ${paper.title || '(untitled)'} (${paperId})`);
  console.log(`Class: ${paper?.class?.name || getPaperClassId(paper) || 'Unknown'}`);
  console.log(`Section: ${section ? `${section?.name || sectionId} (${sectionId})` : 'No section available'}`);

  const benchmarkAll = await requestJson(
    `/api/analytics/benchmark-report/${paperId}?school=${encodeURIComponent(school)}`,
  );
  if (!benchmarkAll.response.ok || !benchmarkAll.data?.success) {
    throw new Error(`Benchmark report (all sections) failed: ${benchmarkAll.data?.message || benchmarkAll.response.status}`);
  }

  const allSummary = {
    coveragePct: benchmarkAll.data?.baseline?.coveragePct ?? null,
    eligibleStudents: benchmarkAll.data?.baseline?.eligibleStudents ?? null,
    respondents: benchmarkAll.data?.baseline?.respondents ?? null,
    cohorts: Array.isArray(benchmarkAll.data?.cohorts) ? benchmarkAll.data.cohorts.length : 0,
    questionBenchmarks: Array.isArray(benchmarkAll.data?.questionBenchmarks)
      ? benchmarkAll.data.questionBenchmarks.length
      : 0,
    insights: Array.isArray(benchmarkAll.data?.insights) ? benchmarkAll.data.insights.length : 0,
  };
  console.table([allSummary]);

  if (sectionId) {
    const benchmarkSection = await requestJson(
      `/api/analytics/benchmark-report/${paperId}?school=${encodeURIComponent(school)}&academicSectionId=${encodeURIComponent(sectionId)}`,
    );
    if (!benchmarkSection.response.ok || !benchmarkSection.data?.success) {
      throw new Error(`Benchmark report (section) failed: ${benchmarkSection.data?.message || benchmarkSection.response.status}`);
    }

    const focus = Array.isArray(benchmarkSection.data?.cohorts)
      ? benchmarkSection.data.cohorts[0]
      : null;
    console.table([
      {
        academicSectionName: focus?.academicSectionName || section?.name || sectionId,
        accuracyPct: focus?.metrics?.accuracyPct ?? null,
        avgScorePct: focus?.metrics?.avgScorePct ?? null,
        unattemptedPct: focus?.metrics?.unattemptedPct ?? null,
        passRatePct: focus?.metrics?.passRatePct ?? null,
      },
    ]);
  }

  const uploadHistoryPath = sectionId
    ? `/api/question-paper-response/upload-history?school=${encodeURIComponent(school)}&paperId=${encodeURIComponent(paperId)}&academicSectionId=${encodeURIComponent(sectionId)}`
    : `/api/question-paper-response/upload-history?school=${encodeURIComponent(school)}&paperId=${encodeURIComponent(paperId)}`;
  const uploadHistory = await requestJson(uploadHistoryPath);
  if (!uploadHistory.response.ok || !uploadHistory.data?.success) {
    throw new Error(`Upload history failed: ${uploadHistory.data?.message || uploadHistory.response.status}`);
  }

  console.table([
    {
      uploadHistoryEntries: Array.isArray(uploadHistory.data?.histories)
        ? uploadHistory.data.histories.length
        : 0,
      latestStatus: uploadHistory.data?.histories?.[0]?.status || null,
      latestFile: uploadHistory.data?.histories?.[0]?.fileName || null,
    },
  ]);

  const uploadValidation = await requestJson(
    `/api/question-paper-response?school=${encodeURIComponent(school)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        paper: paperId,
        student: '000000000000000000000000',
        uploadMode: 'skip_existing',
        sectionAnswers: [],
      }),
    },
  );

  const validationPassed =
    uploadValidation.response.status === 404 &&
    String(uploadValidation.data?.message || '').toLowerCase().includes('student not found');

  console.table([
    {
      uploadValidationStatus: uploadValidation.response.status,
      uploadValidationMessage: uploadValidation.data?.message || null,
      uploadValidationPassed: validationPassed,
    },
  ]);

  if (!validationPassed) {
    throw new Error('Upload validation did not return the expected safe no-write response.');
  }

  console.log('Smoke test completed successfully.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
