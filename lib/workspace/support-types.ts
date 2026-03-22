export type WorkspaceClassItem = {
  _id: string;
  name: string;
  description?: string;
};

export type WorkspaceAcademicSectionClassItem = {
  _id: string;
  name: string;
};

export type WorkspaceAcademicSectionItem = {
  _id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  class?: WorkspaceAcademicSectionClassItem | string;
};

export type WorkspaceTagTypeItem = {
  _id: string;
  name: string;
};

export type WorkspaceSubjectTagItem = {
  _id: string;
  name: string;
  type: WorkspaceTagTypeItem;
};

export type WorkspaceSubjectItem = {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  tags: WorkspaceSubjectTagItem[];
};

export type WorkspaceTagSubjectItem = {
  _id: string;
  name: string;
  code?: string;
};

export type WorkspaceTagItem = {
  _id: string;
  name: string;
  type: WorkspaceTagTypeItem;
  subjects?: WorkspaceTagSubjectItem[];
};
