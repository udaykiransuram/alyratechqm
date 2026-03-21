'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MultiSelectChecklist from '@/components/multi-select-checklist';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import PageHero from '@/components/layout/PageHero';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { fetchApiJson, buildPartialLoadMessage, resolveClientSchoolKey } from '@/lib/client/api';

interface ClassItem {
  _id: string;
  name: string;
}

interface SubjectItem {
  _id: string;
  name: string;
}

interface AcademicSectionItem {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
}

function getSectionClassId(section: AcademicSectionItem) {
  return typeof section.class === 'string' ? section.class : section.class?._id || '';
}

export default function CreateAdminPage() {
  const router = useRouter();
  const { navigateBack } = useBackNavigation('/workspace/admins');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    mobileNumber: '',
    hasAllClasses: true,
    hasAllSections: true,
    hasAllSubjects: true,
    classIds: [] as string[],
    academicSectionIds: [] as string[],
    subjectIds: [] as string[],
  });
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, setSetupNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setSetupNotice('Select a school workspace to load admin assignment options.');
        return;
      }

      const [classesResult, sectionsResult, subjectsResult] = await Promise.allSettled([
        fetchApiJson<any>('/api/classes', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load classes.',
        }),
        fetchApiJson<any>('/api/sections', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load sections.',
        }),
        fetchApiJson<any>('/api/subjects', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load subjects.',
        }),
      ]);

      const nextClasses =
        classesResult.status === 'fulfilled' && Array.isArray(classesResult.value.classes)
          ? classesResult.value.classes
          : [];
      const nextSections =
        sectionsResult.status === 'fulfilled' && Array.isArray(sectionsResult.value.sections)
          ? sectionsResult.value.sections
          : [];
      const nextSubjects =
        subjectsResult.status === 'fulfilled' && Array.isArray(subjectsResult.value.subjects)
          ? subjectsResult.value.subjects
          : [];

      setClasses(nextClasses);
      setSections(nextSections);
      setSubjects(nextSubjects);
      setSetupNotice(
        buildPartialLoadMessage([
          ...(classesResult.status === 'rejected' ? ['Class options'] : []),
          ...(sectionsResult.status === 'rejected' ? ['Section options'] : []),
          ...(subjectsResult.status === 'rejected' ? ['Subject options'] : []),
        ]) || (!nextClasses.length && !nextSections.length && !nextSubjects.length ? 'No classes, sections, or subjects are available for this school yet.' : null),
      );
    })();
  }, []);

  const availableSections = useMemo(() => {
    if (form.hasAllClasses) {
      return sections;
    }
    const selectedClassIds = new Set(form.classIds);
    return sections.filter((section) => selectedClassIds.has(getSectionClassId(section)));
  }, [form.classIds, form.hasAllClasses, sections]);

  const availableSectionIds = useMemo(
    () => new Set(availableSections.map((section) => section._id)),
    [availableSections],
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const updateToggle = (
    field: 'hasAllClasses' | 'hasAllSections' | 'hasAllSubjects',
    checked: boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: checked,
      ...(field === 'hasAllSections' && checked ? { academicSectionIds: [] } : {}),
    }));
  };

  const updateSelection = (
    field: 'classIds' | 'subjectIds' | 'academicSectionIds',
    nextValues: string[],
  ) => {
    setForm((prev) => {
      if (field !== 'classIds') {
        return { ...prev, [field]: nextValues };
      }

      const nextClassIds = nextValues;
      const nextClassIdSet = new Set(nextClassIds);
      const nextAcademicSectionIds = prev.academicSectionIds.filter((sectionId) => {
        if (prev.hasAllClasses) return true;
        const section = sections.find((item) => item._id === sectionId);
        return section ? nextClassIdSet.has(getSectionClassId(section)) : false;
      });

      return {
        ...prev,
        classIds: nextClassIds,
        academicSectionIds: nextAcademicSectionIds,
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      ...form,
      role: 'admin',
      classIds: form.hasAllClasses ? [] : form.classIds,
      academicSectionIds: form.hasAllSections
        ? []
        : form.academicSectionIds.filter((sectionId) => availableSectionIds.has(sectionId)),
      subjectIds: form.hasAllSubjects ? [] : form.subjectIds,
    };

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Please select a school in the navbar first.');
      }

      await fetchApiJson<any>('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        schoolKey,
        fallbackMessage: 'Error creating admin',
      });

      setMessage('Admin created successfully!');
      setForm({
        name: '',
        email: '',
        password: '',
        mobileNumber: '',
        hasAllClasses: true,
        hasAllSections: true,
        hasAllSubjects: true,
        classIds: [],
        academicSectionIds: [],
        subjectIds: [],
      });
      setTimeout(() => router.push('/workspace/manage/users'), 800);
    } catch (error: any) {
      setMessage(error?.message || 'Error creating admin');
    } finally {
      setLoading(false);
    }
  };

  const messageClassName =
    message?.toLowerCase().includes('error') || message?.toLowerCase().includes('failed')
      ? 'app-feedback app-feedback-error'
      : 'app-feedback app-feedback-success';

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Create Admin"
        description="Create a school-admin account and decide whether it should keep full-school access or operate within a restricted scope."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admins
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">School admin access</span>
            <span className="app-meta-chip">Full or restricted scope</span>
          </>
        }
        stats={[
          {
            label: 'Class scope',
            value: form.hasAllClasses ? 'All' : String(form.classIds.length),
            meta: form.hasAllClasses ? 'Admin will see every class.' : 'Admin is limited to the selected classes.',
          },
          {
            label: 'Section scope',
            value: form.hasAllSections ? 'All' : String(form.academicSectionIds.length),
            meta: form.hasAllSections ? 'Section access is broad inside the allowed class scope.' : 'Only selected sections are enabled.',
          },
          {
            label: 'Subject scope',
            value: form.hasAllSubjects ? 'All' : String(form.subjectIds.length),
            meta: form.hasAllSubjects ? 'Admin will see every subject.' : 'Only selected subjects are enabled.',
          },
          {
            label: 'Form state',
            value: loading ? 'Saving' : 'Ready',
            meta: 'New admin accounts are created inside the current school tenant.',
          },
        ]}
      />
      {message ? <div className={messageClassName}>{message}</div> : null}

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Admin Profile</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="app-field-group">
                  <label className="app-field-label" htmlFor="name">Name</label>
                  <input id="name" name="name" placeholder="Enter name" value={form.name} onChange={handleChange} required className="app-form-input" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="email">Email</label>
                    <input id="email" name="email" placeholder="Enter email" value={form.email} onChange={handleChange} type="email" className="app-form-input" />
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="mobileNumber">Phone Number</label>
                    <input id="mobileNumber" name="mobileNumber" placeholder="Enter phone number" value={form.mobileNumber} onChange={handleChange} required className="app-form-input" />
                  </div>
                </div>

                <div className="app-field-group">
                  <label className="app-field-label" htmlFor="password">Password</label>
                  <input id="password" name="password" placeholder="Create password" value={form.password} onChange={handleChange} type="password" className="app-form-input" />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={form.hasAllClasses}
                      onCheckedChange={(checked) => updateToggle('hasAllClasses', checked === true)}
                      className="mt-0.5"
                    />
                    <span>All Classes</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={form.hasAllSections}
                      onCheckedChange={(checked) => updateToggle('hasAllSections', checked === true)}
                      className="mt-0.5"
                    />
                    <span>All Sections</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={form.hasAllSubjects}
                      onCheckedChange={(checked) => updateToggle('hasAllSubjects', checked === true)}
                      className="mt-0.5"
                    />
                    <span>All Subjects</span>
                  </label>
                </div>

                {!form.hasAllClasses && (
                  <div className="app-field-group">
                    <label className="app-field-label">Classes</label>
                    <MultiSelectChecklist
                      items={classes.map((classItem) => ({
                        id: classItem._id,
                        label: classItem.name,
                      }))}
                      selectedIds={form.classIds}
                      onChange={(ids) => updateSelection('classIds', ids)}
                    />
                  </div>
                )}

                {!form.hasAllSections && (
                  <div className="app-field-group">
                    <label className="app-field-label">Sections</label>
                    <MultiSelectChecklist
                      items={availableSections.map((section) => ({
                        id: section._id,
                        label: (
                          <span>
                            {section.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({classes.find((classItem) => classItem._id === getSectionClassId(section))?.name || 'Class'})
                            </span>
                          </span>
                        ),
                      }))}
                      selectedIds={form.academicSectionIds}
                      onChange={(ids) => updateSelection('academicSectionIds', ids)}
                      emptyContent={form.hasAllClasses
                        ? 'No sections have been created yet.'
                        : 'Select one or more classes to choose sections.'}
                    />
                  </div>
                )}

                {!form.hasAllSubjects && (
                  <div className="app-field-group">
                    <label className="app-field-label">Subjects</label>
                    <MultiSelectChecklist
                      items={subjects.map((subject) => ({
                        id: subject._id,
                        label: subject.name,
                      }))}
                      selectedIds={form.subjectIds}
                      onChange={(ids) => updateSelection('subjectIds', ids)}
                    />
                  </div>
                )}

                <button type="submit" disabled={loading} className="app-button-primary w-full">
                  {loading ? 'Saving...' : 'Create Admin'}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

              </div>
    </div>
  );
}
