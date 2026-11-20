export type Folder = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color: string;
};

export type NoteSummary = {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  emoji: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  is_public: boolean;
  updated_at: string;
  created_at: string;
  preview: string;
  tag_ids: string[];
  shared: boolean; // true when the current user is a collaborator, not the owner
};

export type Note = {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  emoji: string | null;
  content: unknown;
  content_text: string;
  ydoc: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  is_public: boolean;
  share_token: string | null;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Collaborator = {
  note_id: string;
  user_id: string;
  role: "editor" | "viewer";
  profile?: Profile | null;
};
