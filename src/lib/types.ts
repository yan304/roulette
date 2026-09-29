export type Participant = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Spin = {
  id: number;
  winner_id: string | null;
  winner_name: string;
  winner_avatar_url: string | null;
  spun_by: string | null;
  created_at: string;
};
