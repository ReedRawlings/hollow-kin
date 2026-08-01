import { GaryDialogueEventId, GARY_ESSENCE_REWARD_ID } from '../systems/Relationships';
import { LastRunSummary, RelationshipProgress } from '../types';

export interface DialoguePage {
  speaker: string;
  text: string;
  choices?: string[];
}

export function garyDialoguePages(
  eventId: GaryDialogueEventId,
  playerName: string,
  progress: RelationshipProgress,
  lastRunSummary: LastRunSummary | null = null,
): DialoguePage[] {
  const turnBackOpening = lastRunSummary?.outcome === 'wiped'
    ? `That was close, ${playerName}. Sit with me a moment. I would like to discuss the future of our village.`
    : lastRunSummary?.outcome === 'fled'
      ? `It was good you got out when you did, ${playerName}. Still, each return from that depth asks more of you.`
      : `It is incredible how far you have made it, ${playerName}. But I wonder whether it is time to choose another path.`;
  const scripts: Record<Exclude<GaryDialogueEventId, 'gary_essence_assistance'>, DialoguePage[]> = {
    gary_intro: [
      { speaker: 'GARY', text: `Easy now, ${playerName}. The tower has waited longer than either of us. It can wait while I make certain these gates still know how to open.` },
      { speaker: 'GARY', text: 'I built them when monsters first began wandering down from above. Back then I spent more time beyond the gate than beside it.' },
      { speaker: 'GARY', text: 'Bring your kin home when you can. If you cannot, I will still be here to open the way again.' },
    ],
    gary_passages: [
      { speaker: 'GARY', text: 'Floor five already. You move with the confidence of someone who has not yet learned to distrust confident footing.' },
      { speaker: 'GARY', text: 'When I adventured, I cut passages around the lower wards. Most have collapsed, but I can repair them and give you a deeper place to begin.' },
      { speaker: 'GARY', text: 'I stopped using them when Garrette was born. Being his father seemed the greater adventure. I only wish he had agreed.' },
    ],
    gary_shortsword_return: [
      { speaker: 'GARY', text: 'That engraving... I put it there myself. Garrette complained the letters made the sword look too handsome to use.' },
      { speaker: 'GARY', text: 'He carried it when he went into the tower. Years without word, and still some foolish corner of me called that hope.' },
      { speaker: 'GARY', text: `Keep watching, ${playerName}. I will search as well. If the old passages yield Essence, I will leave your share here at the gate.` },
    ],
    gary_turn_back: [
      { speaker: 'GARY', text: turnBackOpening },
      { speaker: 'GARY', text: 'We could rebuild the village walls. Hunt only the lower floors. It would be a smaller life, perhaps, but one with everyone still in it.' },
      { speaker: 'GARY', text: 'No. I see your answer already. Then take an old adventurer’s blessing, and enough strength to make your return less a matter of luck.', choices: ['I HAVE TO CONTINUE', 'I WILL COME BACK'] },
    ],
    gary_garrette_rest: [
      { speaker: 'GARY', text: 'So it was truly him. I am grateful he no longer wanders those halls. I am angry that gratitude is what remains to me.' },
      { speaker: 'GARY', text: 'For years, uncertainty left a lamp burning. Now I may finally put it out—and remember my son as he was, not as the tower kept him.' },
      { speaker: 'GARY', text: `Thank you, ${playerName}. The repaired passages and everything I learned within them are yours.` },
    ],
  };
  if (eventId !== 'gary_essence_assistance') return scripts[eventId];
  const amount = progress.scheduledRewards[GARY_ESSENCE_REWARD_ID]?.amount ?? 0;
  return [{
    speaker: 'GARY',
    text: `The upper passages were generous this time. Your share comes to ${amount} Essence. Spend it on bringing everyone home.`
  }];
}
