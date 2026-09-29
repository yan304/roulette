export type Participant = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  // Typed in by an admin rather than signed in with Google.
  manual: boolean;
  created_at: string;
};

export type Spin = {
  id: number;
  winner_id: string | null;
  winner_name: string;
  winner_avatar_url: string | null;
  spun_by: string | null;
  excluded_winners: boolean;
  // Winners picked together in one spin share a draw_id.
  draw_id: string | null;
  created_at: string;
};
