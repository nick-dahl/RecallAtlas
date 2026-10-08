type Facts = { name: string; artist?: string; year?: string; movement?: string };

/** Feedback wording for Great Paintings (spec §6): the fact asked, then who/when/what. */
export function paintingFeedback(
  asks: string | undefined,
  f: { correct: boolean; typo?: boolean; answer: Facts; given?: Facts },
): { headline: string; detail?: string } {
  const { answer: a, given } = f;
  const facts = `${a.artist}, ${a.year} · ${a.movement}`;
  if (asks === 'artist') {
    return {
      headline: `${f.correct ? 'Correct' : 'Not quite'}: ${a.name} is by ${a.artist} (${a.year})`,
      detail: f.correct && f.typo ? `It’s spelled “${a.artist}”.` : given ? `${given.artist} painted ${given.name}.` : undefined,
    };
  }
  if (asks === 'movement') return { headline: `${f.correct ? 'Correct' : 'Not quite'}: ${a.name} is ${a.movement}`, detail: `${a.artist}, ${a.year}` };
  if (f.correct) return { headline: f.typo ? `Correct. It’s spelled “${a.name}”` : `Correct: ${a.name}`, detail: facts };
  if (asks === 'title') return { headline: `Not quite: it’s ${a.name}`, detail: given ? `You named ${given.name}.` : facts };
  return { headline: `Not quite: that’s ${a.name}`, detail: given ? `You picked ${given.name}.` : facts };
}
