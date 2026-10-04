export interface FollowedEntry {
  kind: 'player' | 'defense';
  espnId: string; // athlete id for players, team id for defenses
  name: string;
  teamId: string;
  teamAbbr: string;
  position: string; // 'QB', 'LB', 'K', ... or 'D/ST'
  jersey?: string;
  profileId: string;
  side?: 'opponent'; // absent means "mine" (vs mode)
}
