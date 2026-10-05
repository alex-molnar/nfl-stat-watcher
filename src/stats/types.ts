export interface PlayerStats {
  passing?: { completions: number; attempts: number; yards: number; touchdowns: number; interceptions: number; sacked?: number };
  rushing?: { attempts: number; yards: number; touchdowns: number };
  receiving?: { receptions: number; targets: number; yards: number; touchdowns: number };
  fumbles?: { fumbles: number; lost: number; recovered: number };
  defense?: {
    totalTackles: number;
    soloTackles: number;
    sacks: number;
    tacklesForLoss: number;
    passesDefended: number;
    qbHits: number;
    touchdowns: number;
  };
  interceptions?: { interceptions: number; touchdowns: number };
  returns?: { touchdowns: number; kickYards?: number; puntYards?: number }; // kick and punt returns
  kicking?: {
    fgMade: number;
    fgAttempts: number;
    longest: number;
    xpMade: number;
    xpAttempts: number;
    madeDistances: number[]; // parsed from play text
    missedDistances?: number[]; // parsed from play text
  };
  /** Yards of each touchdown the player scored, parsed from play text, for length bonuses. */
  tdYards?: { pass: number[]; rush: number[]; rec: number[] };
  twoPointConversions: number;
  safeties: number;
  /** Kicks the player blocked, read from play text. */
  blockedKicks?: number;
  /** Fumbles the player forced, read from play text. */
  forcedFumbles?: number;
  /** Rushes stopped for no gain or a loss, shared between listed tacklers, read from play text. */
  stuffs?: number;
}

export interface DefenseStats {
  sacks: number;
  interceptions: number;
  fumbleRecoveries: number;
  touchdowns: number; // defensive plus kick and punt return TDs
  safeties: number;
  pointsAllowed: number; // the opponent's score
  yardsAllowed?: number; // the opponent's total yards
  blockedKicks?: number; // field goals, punts and extra points blocked, read from play text
}

export interface Situation {
  possessionTeamId: string;
  /** The drive just ended (score, turnover, punt, missed kick) or a kickoff is next: nobody is on offense yet. Set only when true. */
  driveOver?: true;
  yardsToEndzone: number;
  downDistanceText: string; // for example "2nd & 6 at DEN 12"
  lastPlayText: string;
}

/** A player's injury designation for a game, from ESPN's injury report. */
export interface Injury {
  status: string; // "Out", "Questionable", "Doubtful", ...
  type?: string; // the injury, for example "Ankle"
  returnDate?: string;
}

/** A highlight clip of a game. Players are tagged separately, see getClipAthletes. */
export interface Highlight {
  id: string;
  headline: string;
  publishedAt: string;
  duration?: number;
  thumbnail?: string;
  /** A direct video file, which can play inside the site. */
  mp4?: string;
  /** The clip's page, opened in a new window when there is no video file. */
  page?: string;
}

export interface GameStats {
  players: Record<string, PlayerStats>; // keyed by ESPN athlete id
  defenses: Record<string, DefenseStats>; // keyed by ESPN team id
  situation: Situation | null;
  /** Keyed by ESPN athlete id. */
  injuries?: Record<string, Injury>;
  /** Newest first. */
  highlights?: Highlight[];
}
