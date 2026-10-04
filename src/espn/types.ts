// The subset of ESPN's public API responses that the app reads.

export interface EspnTeamRef {
  id: string;
  abbreviation: string;
  displayName: string;
  location?: string;
  name?: string;
  color?: string; // hex without '#'
}

export interface EspnCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  team: EspnTeamRef;
}

export interface EspnStatus {
  period: number;
  displayClock: string;
  type: { state: 'pre' | 'in' | 'post'; completed: boolean; shortDetail: string };
}

export interface EspnEvent {
  id: string;
  date: string;
  status: EspnStatus;
  competitions: { competitors: EspnCompetitor[] }[];
}

export interface EspnScoreboard {
  events: EspnEvent[];
}

export interface EspnAthleteRef {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  jersey?: string;
}

export interface EspnStatCategory {
  name: string;
  keys: string[];
  totals?: string[];
  athletes: { athlete: EspnAthleteRef; stats: string[] }[];
}

export interface EspnPlaySpot {
  team?: { id: string };
  yardsToEndzone?: number;
  downDistanceText?: string;
  possessionText?: string;
}

export interface EspnPlay {
  id: string;
  text: string;
  scoringPlay?: boolean;
  start: EspnPlaySpot;
  end?: EspnPlaySpot;
}

export interface EspnSummary {
  header: { id: string; competitions: { competitors: EspnCompetitor[] }[] };
  boxscore: { players?: { team: { id: string; abbreviation?: string }; statistics: EspnStatCategory[] }[] };
  drives?: { previous?: { plays: EspnPlay[] }[]; current?: { plays: EspnPlay[] } };
}

export interface EspnSearchItem {
  id: string;
  displayName: string;
  league?: string;
}

export interface EspnAthleteResponse {
  athlete: {
    id: string;
    displayName: string;
    jersey?: string;
    position?: { abbreviation: string };
    team?: { id: string; abbreviation: string };
  };
}

export interface EspnStandings {
  children: { standings: { entries: { team: EspnTeamRef }[] } }[];
}
