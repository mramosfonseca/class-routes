// Leaderboard: who walks fastest and who gets to class on time most often.
// Friends' numbers are made-up sample data; yours come from the walks you time
// with Start walk once you have some (see walk-timer.js), and are sample data
// until then.

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

// The share of someone's walks that got to class on time (0–1).
function onTimeShare(stats) {
  return stats.walks === 0 ? 0 : stats.onTimeWalks / stats.walks;
}

// Each ranking: its button label, what it ranks by (higher is better), how to
// show that number, and a line explaining it.
const RANKINGS = {
  fastest: {
    label: "Fastest walker",
    score: (stats) => stats.mph,
    describe: (stats) => `${stats.mph.toFixed(1)} mph`,
    explanation: "Ranked by average walking speed from class to class.",
  },
  onTime: {
    label: "On time",
    score: onTimeShare,
    describe: (stats) => `${Math.round(onTimeShare(stats) * 100)}% · ${stats.onTimeWalks} of ${stats.walks} walks`,
    explanation: "Ranked by how often each person gets to class on time.",
  },
};

// Sorts people best first for a ranking and numbers them. People with the same
// score share a place, and the next place skips ahead (1, 1, 3). Ties list
// whoever has more walks first.
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
