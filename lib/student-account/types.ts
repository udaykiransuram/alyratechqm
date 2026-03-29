export type StudentAccountProfile = {
  _id: string;
  name: string;
  email?: string;
  rollNumber?: string;
  mobileNumber?: string;
  className?: string;
  academicSectionName?: string;
};

export type StudentAccountReleasedReport = {
  _id: string;
  title: string;
  status: string;
  subject?: { _id: string; name: string } | null;
  onlineEndsAt?: string | null;
  attempt?: {
    _id: string;
    submittedAt?: string | null;
    status?: string;
    totalMarksAwarded?: number;
  } | null;
};

