export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Note {
  id: string;
  text: string;
  tag_id: string | null;
  is_blocker: boolean;
  created_at: string;
}

export interface Standup {
  id: string;
  standup_date: string;
  yesterday: string | null;
  today: string | null;
  blockers: string | null;
  highlights: string | null;
  tone: string;
  raw_note_ids: string[] | null;
  edited: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  job_title: string | null;
  team_name: string | null;
  avatar_url: string | null;
  default_tone: string;
  standup_format: string;
  name_in_standup: boolean;
}
