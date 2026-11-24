// Leaderboard: who gets to class on time most often.
// Every number here is made-up sample data, including yours.

// Keyed by "you" or a friend's id from friends.js.
const SAMPLE_WALK_STATS = {
  you: { walks: 20, onTimeWalks: 18 },
  priya: { walks: 14, onTimeWalks: 14 },
  jake: { walks: 12, onTimeWalks: 10 },
  marcus: { walks: 10, onTimeWalks: 10 },
  lily: { walks: 13, onTimeWalks: 10 },
  dev: { walks: 15, onTimeWalks: 14 },
  sam: { walks: 11, onTimeWalks: 10 },
  ana: { walks: 9, onTimeWalks: 8 },
};

// The share of someone's walks that got to class on time (0–1).
function onTimeShare(stats) {
  return stats.walks === 0 ? 0 : stats.onTimeWalks / stats.walks;
}

// "90% · 18 of 20 walks"
function describeOnTime(stats) {
  return `${Math.round(onTimeShare(stats) * 100)}% · ${stats.onTimeWalks} of ${stats.walks} walks`;
}

// Sorts people by their on-time share, best first, and numbers them. People with
// the same share share a place, and the next place skips ahead (1, 1, 3).
// Ties list whoever has more walks first.
function rankPeople(people) {
  const sorted = people
    .map((person) => ({ ...person, score: onTimeShare(person.stats) }))
    .sort((a, b) => b.score - a.score || b.stats.walks - a.stats.walks);
  let place = 0;
  return sorted.map((person, index) => {
    if (index === 0 || person.score !== sorted[index - 1].score) place = index + 1;
    return { ...person, place };
  });
}
