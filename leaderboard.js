// Leaderboards: who walks fastest and who gets to class on time most often.
// Every number here is made-up sample data, including yours.

// Keyed by "you" or a friend's id from friends.js.
const SAMPLE_WALK_STATS = {
  you: { mph: 3.2, walks: 20, onTimeWalks: 18 },
  priya: { mph: 3.4, walks: 14, onTimeWalks: 14 },
  jake: { mph: 2.9, walks: 12, onTimeWalks: 10 },
  marcus: { mph: 3.8, walks: 10, onTimeWalks: 10 },
  lily: { mph: 2.7, walks: 13, onTimeWalks: 10 },
  dev: { mph: 3.1, walks: 15, onTimeWalks: 14 },
  sam: { mph: 3.3, walks: 11, onTimeWalks: 10 },
  ana: { mph: 2.6, walks: 9, onTimeWalks: 8 },
};

// Each ranking: its button label, the number it sorts by (higher is better),
// and how to show that number.
const RANKINGS = {
  fastest: {
    label: "Fastest walker",
    score: (stats) => stats.mph,
    describe: (stats) => `${stats.mph.toFixed(1)} mph`,
  },
  onTime: {
    label: "On time",
    score: (stats) => (stats.walks === 0 ? 0 : stats.onTimeWalks / stats.walks),
    describe: (stats) =>
      `${Math.round((stats.onTimeWalks / Math.max(1, stats.walks)) * 100)}% · ${stats.onTimeWalks} of ${stats.walks} walks`,
  },
};

// Sorts people best first and numbers them. People with the same score share a
// place, and the next place skips ahead (1, 1, 3). Ties list whoever has more walks first.
function rankPeople(people, rankingName) {
  const ranking = RANKINGS[rankingName];
  const sorted = people
    .map((person) => ({ ...person, score: ranking.score(person.stats) }))
    .sort((a, b) => b.score - a.score || b.stats.walks - a.stats.walks);
  let place = 0;
  return sorted.map((person, index) => {
    if (index === 0 || person.score !== sorted[index - 1].score) place = index + 1;
    return { ...person, place };
  });
}
