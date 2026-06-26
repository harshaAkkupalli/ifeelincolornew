// ─── IFEELINCOLOR Check-In Data ───

export const BODY_ZONES = [
  { id: 'head', label: 'Head', x: 50, y: 7, icon: 'brain' },
  { id: 'eyes_face', label: 'Eyes / Face', x: 78, y: 8.5, icon: 'eye' },
  { id: 'jaw_mouth', label: 'Jaw / Mouth', x: 22, y: 14, icon: 'smile' },
  { id: 'throat', label: 'Throat', x: 50, y: 18.5, icon: 'wind' },
  { id: 'shoulders_neck', label: 'Shoulders / Neck', x: 78, y: 22, icon: 'grip' },
  { id: 'chest_heart', label: 'Chest / Heart', x: 50, y: 32, icon: 'heart' },
  { id: 'stomach_gut', label: 'Stomach / Gut', x: 50, y: 45, icon: 'circle-dot' },
  { id: 'back', label: 'Back', x: 82, y: 38, icon: 'arrow-left' },
  { id: 'arms_hands', label: 'Arms / Hands', x: 14, y: 46, icon: 'hand' },
  { id: 'legs_feet', label: 'Legs / Feet', x: 50, y: 78, icon: 'footprints' },
  { id: 'skin', label: 'Skin / Whole Body', x: 86, y: 58, icon: 'sparkles' },
  { id: 'whole_body', label: 'Whole Body / Energy', x: 50, y: 93, icon: 'zap' },
];

export const ZONE_SENSATIONS = {
  head: ['Racing thoughts', 'Pressure', 'Headache', 'Foggy', 'Dizzy', 'Heavy', 'Clear', 'Busy', 'Overloaded', 'Blank / Numb'],
  eyes_face: ['Teary', 'Burning', 'Twitching', 'Tight', 'Flushed', 'Warm', 'Tense', 'Puffy', 'Stinging'],
  jaw_mouth: ['Clenching', 'Grinding', 'Dry', 'Tight', 'Numb', 'Tingling', 'Sore', 'Locked'],
  throat: ['Lump', 'Tight', 'Choking', 'Dry', 'Scratchy', 'Swelling', 'Constricted'],
  shoulders_neck: ['Tight', 'Tense', 'Stiff', 'Heavy', 'Aching', 'Frozen', 'Locked up', 'Burning'],
  chest_heart: ['Racing', 'Pounding', 'Tight', 'Heavy', 'Fluttery', 'Aching', 'Warm', 'Hollow'],
  stomach_gut: ['Butterflies', 'Nausea', 'Churning', 'Empty', 'Knotted', 'Sinking', 'Bloated', 'Cramping'],
  back: ['Aching', 'Stiff', 'Tight', 'Burning', 'Heavy', 'Pulling', 'Spasming'],
  arms_hands: ['Tingling', 'Shaking', 'Numb', 'Heavy', 'Restless', 'Clenching', 'Weak', 'Cold'],
  legs_feet: ['Restless', 'Heavy', 'Shaking', 'Weak', 'Tingling', 'Jittery', 'Frozen', 'Wobbly'],
  skin: ['Crawling', 'Hot', 'Cold', 'Sweaty', 'Goosebumps', 'Itchy', 'Flushed', 'Prickling'],
  whole_body: ['Exhausted', 'Wired', 'Frozen', 'Floating', 'Buzzing', 'Numb', 'Restless', 'Vibrating', 'Heavy'],
};

export const EMOTION_FAMILIES = {
  happy:     { color: '#FFD166', label: 'Happy',     darkBg: 'rgba(255,209,102,0.08)' },
  sad:       { color: '#118AB2', label: 'Sad',       darkBg: 'rgba(17,138,178,0.08)' },
  disgusted: { color: '#8D99AE', label: 'Disgusted', darkBg: 'rgba(141,153,174,0.08)' },
  angry:     { color: '#EF476F', label: 'Angry',     darkBg: 'rgba(239,71,111,0.08)' },
  fearful:   { color: '#F4845F', label: 'Fearful',   darkBg: 'rgba(244,132,95,0.08)' },
  bad:       { color: '#06D6A0', label: 'Bad',       darkBg: 'rgba(6,214,160,0.08)' },
  surprised: { color: '#B56576', label: 'Surprised', darkBg: 'rgba(181,101,118,0.08)' },
};

export const FEELINGS_WHEEL = {
  happy: {
    playful:    ['Aroused', 'Cheeky', 'Free', 'Joyful', 'Energetic'],
    content:    ['Satisfied', 'Peaceful', 'At ease', 'Fulfilled'],
    interested: ['Curious', 'Inquisitive', 'Engaged', 'Fascinated'],
    proud:      ['Successful', 'Confident', 'Accomplished'],
    accepted:   ['Respected', 'Valued', 'Appreciated'],
    optimistic: ['Hopeful', 'Inspired', 'Open', 'Eager'],
  },
  sad: {
    lonely:     ['Isolated', 'Abandoned', 'Invisible', 'Neglected'],
    vulnerable: ['Fragile', 'Helpless', 'Exposed'],
    despair:    ['Grief', 'Powerless', 'Miserable'],
    guilty:     ['Ashamed', 'Remorseful', 'Sorry'],
    depressed:  ['Empty', 'Inferior', 'Worthless'],
    hurt:       ['Embarrassed', 'Disappointed', 'Let down'],
  },
  disgusted: {
    disapproval: ['Judgmental', 'Critical', 'Skeptical'],
    disappointed: ['Repelled', 'Revolted', 'Appalled'],
    awful:        ['Detestable', 'Horrified', 'Nauseated'],
    avoidance:    ['Withdrawn', 'Averse', 'Hesitant'],
  },
  angry: {
    'let down':   ['Betrayed', 'Resentful', 'Disrespected'],
    humiliated:   ['Ridiculed', 'Disrespected', 'Insulted'],
    bitter:       ['Indignant', 'Violated', 'Furious'],
    mad:          ['Aggressive', 'Frustrated', 'Hostile'],
    aggressive:   ['Provoked', 'Enraged', 'Hateful'],
    frustrated:   ['Infuriated', 'Annoyed', 'Irritated'],
  },
  fearful: {
    scared:       ['Frightened', 'Helpless', 'Panicked'],
    anxious:      ['Overwhelmed', 'Worried', 'Obsessed'],
    insecure:     ['Inadequate', 'Inferior', 'Uncertain'],
    weak:         ['Worthless', 'Insignificant', 'Powerless'],
    rejected:     ['Excluded', 'Persecuted', 'Dismissed'],
    threatened:   ['Nervous', 'Exposed', 'Cornered'],
  },
  bad: {
    bored:        ['Indifferent', 'Apathetic', 'Listless'],
    busy:         ['Pressured', 'Rushed', 'Overwhelmed'],
    stressed:     ['Strained', 'Burned out', 'Overloaded'],
    tired:        ['Sleepy', 'Unfocused', 'Drained'],
  },
  surprised: {
    startled:     ['Shocked', 'Dismayed', 'Stunned'],
    confused:     ['Disillusioned', 'Perplexed', 'Puzzled'],
    amazed:       ['Astonished', 'Awestruck', 'In wonder'],
    excited:      ['Energetic', 'Eager', 'Thrilled'],
  },
};

// Map sensations to most likely emotion family
export const SENSATION_EMOTION_MAP = {
  'Racing thoughts': 'fearful', 'Pressure': 'bad', 'Headache': 'bad', 'Foggy': 'sad',
  'Dizzy': 'surprised', 'Heavy': 'sad', 'Clear': 'happy', 'Busy': 'bad',
  'Overloaded': 'fearful', 'Blank / Numb': 'sad',
  'Teary': 'sad', 'Burning': 'angry', 'Twitching': 'fearful', 'Tight': 'angry',
  'Flushed': 'angry', 'Warm': 'happy', 'Tense': 'angry', 'Puffy': 'sad', 'Stinging': 'bad',
  'Clenching': 'angry', 'Grinding': 'angry', 'Dry': 'fearful', 'Numb': 'sad',
  'Tingling': 'surprised', 'Sore': 'bad', 'Locked': 'angry',
  'Lump': 'sad', 'Choking': 'fearful', 'Scratchy': 'bad', 'Swelling': 'fearful', 'Constricted': 'fearful',
  'Stiff': 'angry', 'Aching': 'bad', 'Frozen': 'fearful', 'Locked up': 'angry',
  'Racing': 'fearful', 'Pounding': 'fearful', 'Fluttery': 'surprised', 'Hollow': 'sad',
  'Butterflies': 'fearful', 'Nausea': 'disgusted', 'Churning': 'disgusted', 'Empty': 'sad',
  'Knotted': 'fearful', 'Sinking': 'sad', 'Bloated': 'bad', 'Cramping': 'bad',
  'Pulling': 'bad', 'Spasming': 'fearful',
  'Shaking': 'fearful', 'Restless': 'fearful', 'Weak': 'sad', 'Cold': 'sad',
  'Jittery': 'fearful', 'Wobbly': 'fearful',
  'Crawling': 'disgusted', 'Hot': 'angry', 'Sweaty': 'fearful', 'Goosebumps': 'surprised',
  'Itchy': 'disgusted', 'Prickling': 'surprised',
  'Exhausted': 'sad', 'Wired': 'fearful', 'Floating': 'surprised', 'Buzzing': 'surprised',
  'Vibrating': 'surprised',
};

export const REGULATION_ACTIVITIES = {
  happy: [
    { title: 'Gratitude Moment', steps: ['Close your eyes gently', 'Think of 3 things that make you smile', 'Hold each one in your heart for a moment', 'Open your eyes and carry that warmth'] },
    { title: 'Joy Sharing', steps: ['Think of someone who makes you feel good', 'Picture their face smiling at you', 'Send them a warm, happy thought', 'Notice how your body feels lighter'] },
  ],
  sad: [
    { title: 'Comfort Breathing', steps: ['Put one hand on your heart', 'Breathe in slowly... 1, 2, 3, 4', 'Hold gently... 1, 2, 3, 4', 'Breathe out softly... 1, 2, 3, 4, 5, 6', 'Repeat, feeling the warmth of your hand'] },
    { title: 'Gentle Self-Hug', steps: ['Cross your arms and give yourself a hug', 'Squeeze gently', 'Rock softly side to side', 'Whisper: "I am okay, this feeling will pass"'] },
  ],
  angry: [
    { title: 'Cool Down Breathing', steps: ['Breathe in through your nose slowly', 'Imagine cool, blue air flowing in', 'Breathe out through your mouth like blowing through a straw', 'Feel the heat leaving your body', 'Repeat 5 times'] },
    { title: 'Tension Release', steps: ['Unclench your jaw and hands', 'Step back before responding', 'Squeeze both fists as tight as you can', 'Now slowly open your hands wide', 'Shake them out gently'] },
  ],
  fearful: [
    { title: '5-4-3-2-1 Grounding', steps: ['Name 5 things you can SEE right now', 'Name 4 things you can TOUCH', 'Name 3 things you can HEAR', 'Name 2 things you can SMELL', 'Name 1 thing you can TASTE'] },
    { title: 'Safe Place', steps: ['Close your eyes', 'Picture the safest, coziest place you know', 'What colors do you see there?', 'What sounds do you hear?', 'Stay there for a moment. You are safe.'] },
  ],
  disgusted: [
    { title: 'Fresh Air Reset', steps: ['Take a big, deep breath in', 'Imagine breathing in fresh mountain air', 'Breathe out slowly, pushing away what bothers you', 'Repeat 3 more times', 'Feel the freshness fill your lungs'] },
    { title: 'Boundary Reset', steps: ['Name what feels unwelcome', 'Take 3 slow breaths', 'Picture pushing it gently away', 'Notice what feels okay again'] },
  ],
  bad: [
    { title: 'Self-Compassion', steps: ['Place your hand on your heart', 'Feel your heartbeat — it is strong', 'Say: "It is okay to feel this way"', 'Say: "I am doing my best"', 'Take one more slow breath'] },
    { title: 'Body Scan', steps: ['Start at the top of your head', 'Slowly notice each part of your body', 'If you find tension, breathe into it', 'Let it soften with each exhale', 'End at your toes, feeling more relaxed'] },
  ],
  surprised: [
    { title: 'Grounding Touch', steps: ['Press your feet firmly into the floor', 'Feel the solid ground underneath you', 'Press your palms together in front of your chest', 'Take 3 slow breaths', 'You are here. You are present.'] },
    { title: 'Orient & Breathe', steps: ['Look slowly around the room', 'Name 3 colors you see', 'Take a slow breath in', 'Long exhale out', 'Settle into where you are now'] },
  ],
};

// Color-specific regulation strategy intro (Step 6 — spec compliance)
export const COLOR_REGULATION_MESSAGE = {
  angry:     'Your body may be protecting a boundary, need, value, or hurt.',
  fearful:   'Your body may be looking for safety. Let\'s help it feel safe again.',
  sad:       'Your body may be asking for gentle care and rest.',
  happy:     'Your body may want to share or celebrate this joy.',
  disgusted: 'Your body may be telling you something feels off — let\'s clear the air.',
  bad:       'Your body may be overloaded — let\'s lighten the weight.',
  surprised: 'Your body may need a moment to settle and orient.',
};

export const EMOTION_COLORS_FULL = [
  { id: 'happy', hex: '#FFD166', label: 'Happy Yellow' },
  { id: 'sad', hex: '#118AB2', label: 'Sad Blue' },
  { id: 'disgusted', hex: '#8D99AE', label: 'Disgusted Grey' },
  { id: 'angry', hex: '#EF476F', label: 'Angry Red' },
  { id: 'fearful', hex: '#F4845F', label: 'Fearful Orange' },
  { id: 'bad', hex: '#06D6A0', label: 'Bad Green' },
  { id: 'surprised', hex: '#B56576', label: 'Surprised Purple' },
];

export const EMOTION_COLOR_NAMES = {
  happy: 'Sunshine Yellow',
  sad: 'Ocean Blue',
  disgusted: 'Storm Grey',
  angry: 'Fire Red',
  fearful: 'Sunset Orange',
  bad: 'Forest Green',
  surprised: 'Berry Purple',
};

export function getZoneLabel(zoneId) {
  // Handle array (multi-zone) input gracefully
  if (Array.isArray(zoneId)) {
    return zoneId.map(z => getZoneLabel(z)).filter(Boolean).join(', ');
  }
  if (!zoneId || typeof zoneId !== 'string') return '';
  const zone = BODY_ZONES.find(z => z.id === zoneId);
  return zone?.label || zoneId.replace(/_/g, ' ');
}

export function getMajorityEmotion(sensations) {
  const counts = {};
  sensations.forEach(s => {
    const emotion = SENSATION_EMOTION_MAP[s] || 'bad';
    counts[emotion] = (counts[emotion] || 0) + 1;
  });
  let max = 0, result = 'bad';
  Object.entries(counts).forEach(([emotion, count]) => {
    if (count > max) { max = count; result = emotion; }
  });
  return result;
}
